import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from "@google/genai";

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
];

interface ScraperResult {
  title: string;
  price: number;
  imageUrl: string;
  success: boolean;
  error?: string;
  methodUsed: string;
}

// Extract price, title, image using cheerio and regex patterns
function parseHtmlLocally(html: string): Omit<ScraperResult, 'success' | 'methodUsed'> {
  const $ = cheerio.load(html);

  let title = '';
  let price = 0;
  let imageUrl = '';

  // 1. Try Meta Tags (Highly reliable for server-side SEO render)
  title = $('meta[property="og:title"]').attr('content') || 
          $('meta[name="twitter:title"]').attr('content') || 
          $('title').text() || '';

  imageUrl = $('meta[property="og:image"]').attr('content') || 
             $('meta[name="twitter:image"]').attr('content') || '';

  const metaPrice = $('meta[property="og:price:amount"]').attr('content') ||
                    $('meta[property="product:price:amount"]').attr('content') ||
                    $('meta[name="twitter:price:amount"]').attr('content');

  if (metaPrice) {
    const parsed = parseFloat(metaPrice.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed)) price = parsed;
  }

  // Clean title
  title = title.replace('| Lazada.co.th', '').replace('| Lazada', '').trim();

  // 2. Try Standard Lazada selectors/regexes if meta price is missing
  if (price === 0) {
    // Only inspect scripts known to carry real product price data.
    // The broad '"price":' guard is intentionally removed — it fires on
    // shipping, VAT, ad-bid, and voucher keys that appear earlier in page order.
    $('script').each((_, elem) => {
      if (price !== 0) return; // stop once found
      const content = $(elem).html() || '';
      const isProductScript =
        content.includes('pdp-price') ||
        content.includes('current_price') ||
        content.includes('__NEXT_DATA__') ||
        content.includes('window.__pageData');

      if (!isProductScript) return;

      // Prefer the specific 'current_price' key (most reliable in Lazada bundles)
      const currentPriceMatch = content.match(/"current_price"\s*:\s*"?([0-9.,]+)"?/i);
      if (currentPriceMatch) {
        const parsed = parseFloat(currentPriceMatch[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) { price = parsed; return; }
      }

      // Fallback: find "price" only within a narrow window after "pdp-price"
      const pdpMatch = content.match(/"pdp-price"[^}]{0,120}"price"\s*:\s*"?([0-9.,]+)"?/i);
      if (pdpMatch) {
        const parsed = parseFloat(pdpMatch[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) { price = parsed; return; }
      }
    });
  }

  // 3. Fallback to common CSS selectors
  if (!imageUrl) {
    imageUrl = $('.pdp-mod-common-image').attr('src') || 
               $('.gallery-preview-panel__image').attr('src') || '';
  }

  // Clean imageUrl protocol if relative
  if (imageUrl && imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl;
  }

  return { title, price, imageUrl };
}

// Fallback to Gemini Parser
async function parseHtmlWithGemini(html: string): Promise<Omit<ScraperResult, 'methodUsed'>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('Gemini API key is not configured.');
  }

  console.log('[Scraper] Using Gemini fallback parser...');

  // Strip excessive HTML scripts/styles to fit context size and stay highly cost-efficient
  const cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .substring(0, 15000); // Take the first 15k characters which contain meta and top specs/prices

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const prompt = `
    You are a Lazada web page data extractor.
    Extract the product title, current price, and primary image URL from the raw Lazada HTML snippet.
    - Title must be the actual human product name.
    - Price must be a pure number (e.g. 1250, 450.50). Do not include Baht or ฿.
    - Image URL must be the product main photo.
    
    Raw HTML Snippet:
    ${cleanHtml}
  `;

  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Product name" },
              price: { type: Type.NUMBER, description: "Current price" },
              imageUrl: { type: Type.STRING, description: "Product photo URL" },
              success: { type: Type.BOOLEAN, description: "Whether the product info was successfully parsed" },
            },
            required: ["title", "price", "imageUrl", "success"]
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.success && parsed.price > 0) {
        return {
          title: parsed.title,
          price: parsed.price,
          imageUrl: parsed.imageUrl || '',
          success: true
        };
      }

      throw new Error('Gemini could not identify product data in HTML.');
    } catch (error: any) {
      lastError = error;
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      const isTransient = errorStr.includes('503') || 
                          errorStr.includes('UNAVAILABLE') || 
                          errorStr.includes('high demand') || 
                          error.status === 503 ||
                          (error.message && (
                            error.message.includes('503') || 
                            error.message.includes('UNAVAILABLE') || 
                            error.message.includes('high demand')
                          ));

      if (isTransient && attempt < 3) {
        const delay = attempt * 1500;
        console.warn(`[Scraper] Gemini parse attempt ${attempt} failed with 503/UNAVAILABLE. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  console.error('[Scraper] Gemini parser error after retries:', lastError.message || lastError);
  throw lastError;
}

// Core scrape controller
export async function scrapeLazadaProduct(url: string, manualHtml?: string): Promise<ScraperResult> {
  console.log(`[Scraper] Starting scrape for URL: ${url}`);

  // Scenario 1: Manual HTML paste (100% anti-bot proof fallback)
  if (manualHtml && manualHtml.trim().length > 100) {
    console.log('[Scraper] Manual HTML provided. Parsing directly.');
    try {
      const localResult = parseHtmlLocally(manualHtml);
      if (localResult.price > 0 && localResult.title) {
        return {
          ...localResult,
          success: true,
          methodUsed: 'manual_local'
        };
      }

      // Try Gemini parsing on manual HTML
      const geminiResult = await parseHtmlWithGemini(manualHtml);
      if (geminiResult.success) {
        return {
          ...geminiResult,
          methodUsed: 'manual_gemini'
        };
      }
    } catch (err: any) {
      return {
        title: 'Error Parsing Manual Input',
        price: 0,
        imageUrl: '',
        success: false,
        error: `Failed parsing manual HTML: ${err.message}`,
        methodUsed: 'manual_failed'
      };
    }
  }

  // Handle Lazada simulations for easy demonstration/testing
  if (url.includes('demo') || url.includes('simulate') || url.includes('test')) {
    console.log('[Scraper] Demo URL detected. Generating simulated product.');
    const randomPrice = Math.floor(Math.random() * 500) + 1500;
    return {
      title: 'Lazada Simulator Pro Tracked Item',
      price: randomPrice,
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
      success: true,
      methodUsed: 'simulation'
    };
  }

  // Scenario 2: Active HTTP Scrape
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const headers = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'th,en-US;q=0.9,en;q=0.8',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1'
  };

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();

    // Try Local Parse first
    const localResult = parseHtmlLocally(html);
    if (localResult.price > 0 && localResult.title) {
      return {
        ...localResult,
        success: true,
        methodUsed: 'http_local'
      };
    }

    // Try Gemini Parser Fallback if local parse fails (Lazada dynamic JS / anti-bot block)
    const geminiResult = await parseHtmlWithGemini(html);
    return {
      ...geminiResult,
      methodUsed: 'http_gemini'
    };

  } catch (error: any) {
    console.warn(`[Scraper] Active scrape failed: ${error.message}. Returning failure status or trying demo backup.`);
    
    // Last-ditch option: If the user has NO real Lazada page available and it's a test or fails,
    // we return a simulation block so they can see how the UI looks, but with a warning.
    return {
      title: 'Tracked Lazada Product (Anti-Bot Active)',
      price: 0,
      imageUrl: '',
      success: false,
      error: `Scraping blocked: ${error.message}. Try copy-pasting the Page HTML source in the "Manual Import" tab of the dashboard.`,
      methodUsed: 'failed'
    };
  }
}
