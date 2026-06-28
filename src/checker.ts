import { initDb, getProducts, updateProductPrice, getTelegramSettings } from './db/index.js';
import { scrapeLazadaProduct } from './services/scraper.js';
import { sendTelegramMessage, formatPriceDropMessage } from './services/telegram.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runPriceChecker() {
  console.log('==================================================');
  console.log(`[Checker] Price check started at: ${new Date().toLocaleString()}`);
  console.log('==================================================');

  try {
    // 1. Initialize database
    await initDb();

    // 2. Load active tracked products
    const products = await getProducts();
    if (products.length === 0) {
      console.log('[Checker] No products currently tracked. Exiting.');
      return;
    }

    console.log(`[Checker] Found ${products.length} product(s) to check.`);

    // 3. Load Telegram settings
    const tgSettings = await getTelegramSettings();
    const hasTelegram = tgSettings.token && tgSettings.chatId;

    if (!hasTelegram) {
      console.log('[Checker] Telegram alerts are not configured. Price check will run locally.');
    } else {
      console.log('[Checker] Telegram alerts are enabled.');
    }

    // 4. Iterate and check prices
    for (const prod of products) {
      console.log(`\n[Checker] Checking: "${prod.title}" (ID: ${prod.id})`);
      console.log(`[Checker] URL: ${prod.url}`);

      const scrapeResult = await scrapeLazadaProduct(prod.url);

      if (!scrapeResult.success) {
        console.error(`[Checker] Failed to scrape product (ID: ${prod.id}): ${scrapeResult.error}`);
        // Update product last checked timestamp with error status if appropriate
        await updateProductPrice(prod.id, prod.currentPrice, 'error_scrape', new Date().toISOString());
        continue;
      }

      const newPrice = scrapeResult.price;
      console.log(`[Checker] Old Price: ฿${prod.currentPrice} | New Price: ฿${newPrice}`);

      // Update product current price & record history
      const { priceDropped, dropAmount } = await updateProductPrice(
        prod.id,
        newPrice,
        'active',
        new Date().toISOString()
      );

      if (priceDropped && dropAmount > 0) {
        console.log(`[Checker] 🎉 PRICE DROP DETECTED! Saved ฿${dropAmount}`);

        // Handle Telegram alert
        if (hasTelegram && tgSettings.token && tgSettings.chatId) {
          const alertMessage = formatPriceDropMessage(
            prod.title,
            prod.url,
            prod.currentPrice,
            newPrice,
            dropAmount,
            prod.targetPrice
          );
          
          await sendTelegramMessage(tgSettings.token, tgSettings.chatId, alertMessage);
        }
      } else {
        console.log('[Checker] Price stable or increased. No alert sent.');
      }
    }

    console.log('\n==================================================');
    console.log('[Checker] Price check finished successfully.');
    console.log('==================================================');

  } catch (err: any) {
    console.error('[Checker] Fatal error during checking execution:', err.message || err);
  } finally {
    // Exit script cleanly
    process.exit(0);
  }
}

// Start execution
runPriceChecker();
