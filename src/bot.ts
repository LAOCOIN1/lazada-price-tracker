import { 
  initDb, 
  getProducts, 
  addProduct, 
  deleteProduct, 
  updateProductPrice, 
  getTelegramSettings, 
  saveTelegramSettings 
} from './db/index.js';
import { scrapeLazadaProduct } from './services/scraper.js';
import { formatPriceDropMessage, sendTelegramMessage } from './services/telegram.js';
import dotenv from 'dotenv';

dotenv.config();

let botToken = process.env.TELEGRAM_TOKEN || '';
let chatID = process.env.TELEGRAM_CHAT_ID || '';

async function startBot() {
  console.log('==================================================');
  console.log('[Bot] Starting Standalone Telegram Bot daemon...');
  console.log('==================================================');

  // 1. Initialize database
  await initDb();

  // 2. Resolve token & Chat ID from DB if not in env
  if (!botToken || !chatID) {
    console.log('[Bot] No environment variables for Telegram. Checking database settings...');
    const settings = await getTelegramSettings();
    if (settings.token) botToken = settings.token;
    if (settings.chatId) chatID = settings.chatId;
  }

  // Sanitize
  botToken = botToken.trim();
  if (botToken.toLowerCase().startsWith('bot')) {
    botToken = botToken.substring(3);
  }
  if (chatID) chatID = chatID.trim();

  if (!botToken) {
    console.error('[Bot] ERROR: Telegram Bot Token is missing. Please configure TELEGRAM_TOKEN in your .env file or save it via the web dashboard settings.');
    console.log('[Bot] Standing by... Polling database settings every 15 seconds.');
    
    // Poll DB settings periodically if not configured, allowing the user to configure it via the web later
    while (!botToken) {
      await new Promise(resolve => setTimeout(resolve, 15000));
      const settings = await getTelegramSettings();
      if (settings.token) {
        botToken = settings.token.trim();
        if (botToken.toLowerCase().startsWith('bot')) {
          botToken = botToken.substring(3);
        }
        if (settings.chatId) chatID = settings.chatId.trim();
        console.log('[Bot] Bot Token successfully retrieved from database settings!');
        break;
      }
    }
  }

  console.log(`[Bot] Active Bot Token: ${botToken.substring(0, 4)}${'*'.repeat(Math.max(0, botToken.length - 4))}`);
  if (chatID) {
    console.log(`[Bot] Pre-configured Chat ID: ${chatID}`);
  } else {
    console.log('[Bot] WARNING: No Chat ID configured. Send a message to the bot to link your account!');
  }

  console.log('[Bot] Telegram Bot is ONLINE and listening for commands...');

  let offset = 0;
  let running = true;

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Bot] Shutting down Telegram Bot daemon...');
    running = false;
    process.exit(0);
  });

  // Long polling loop
  while (running) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=10`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Bot] Telegram API returned error: ${res.status}`, errorText);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      const data = await res.json();
      if (!data.ok) {
        console.error('[Bot] Telegram API getUpdates ok=false:', data.description);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      const updates = data.result || [];
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleTelegramUpdate(update);
      }

    } catch (err: any) {
      console.error('[Bot] Error in polling loop:', err.message || err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function handleTelegramUpdate(update: any) {
  const message = update.message;
  if (!message || !message.text) return;

  const text: string = message.text.trim();
  const chatId = message.chat.id.toString();
  const username = message.from?.username || message.from?.first_name || 'User';

  console.log(`[Bot] Received message from ${username} (${chatId}): "${text}"`);

  // Help/Start menu
  if (text === '/start' || text === '/help') {
    let welcome = `<b>🌟 Welcome ${username} to Lazada Price Tracker Bot!</b>\n\n`;
    welcome += `I am a standalone price tracking bot that monitors price changes on Lazada and alerts you instantly.\n\n`;
    welcome += `<b>📋 Available Commands:</b>\n`;
    welcome += `• <code>/list</code> - List all your tracked products\n`;
    welcome += `• <code>/add [Lazada URL] [Target Price]</code> - Start tracking a new product\n`;
    welcome += `• <code>/remove [Product ID]</code> - Stop tracking a product\n`;
    welcome += `• <code>/check</code> - Force an immediate price check on all items\n`;
    welcome += `• <code>/link</code> - Link this Chat ID (<code>${chatId}</code>) to your tracker\n`;
    welcome += `• <code>/status</code> - Check database & connection status\n\n`;
    welcome += `<i>💡 Tip: To link this Telegram chat to your web dashboard, copy this Chat ID (<b>${chatId}</b>) and paste it into the Settings of your Lazada Tracker Web App.</i>`;

    await sendTelegramMessage(botToken, chatId, welcome);
    return;
  }

  // Link Chat ID command
  if (text === '/link') {
    // Save to Settings automatically if requested
    await saveTelegramSettings(botToken, chatId);
    const linkMsg = `<b>✅ Chat ID Linked Successfully!</b>\n\nSaved Chat ID <code>${chatId}</code> to your tracker's settings. You will now receive automatic notifications on this channel when prices drop!`;
    await sendTelegramMessage(botToken, chatId, linkMsg);
    return;
  }

  // Status command
  if (text === '/status') {
    try {
      const products = await getProducts();
      let statusMsg = `<b>📊 Lazada Tracker Status:</b>\n\n`;
      statusMsg += `• <b>Database Type:</b> <code>${process.env.DATABASE_TYPE || 'sqlite'}</code>\n`;
      statusMsg += `• <b>Tracked Products:</b> ${products.length}\n`;
      statusMsg += `• <b>Linked Chat ID:</b> <code>${chatId}</code>\n`;
      statusMsg += `• <b>API Status:</b> Online 🟢\n`;
      await sendTelegramMessage(botToken, chatId, statusMsg);
    } catch (err: any) {
      await sendTelegramMessage(botToken, chatId, `❌ Error checking status: ${err.message}`);
    }
    return;
  }

  // List command
  if (text === '/list') {
    try {
      const products = await getProducts();
      if (products.length === 0) {
        await sendTelegramMessage(botToken, chatId, `ℹ️ No products are currently being tracked. Use <code>/add [URL]</code> to start tracking!`);
        return;
      }

      let listMsg = `<b>📦 Tracked Products (${products.length}):</b>\n\n`;
      products.forEach((p, idx) => {
        listMsg += `<b>${idx + 1}. [ID: ${p.id}]</b> ${p.title.substring(0, 50)}...\n`;
        listMsg += `• Current Price: <b>฿${p.currentPrice.toLocaleString()}</b> (Initial: ฿${p.initialPrice.toLocaleString()})\n`;
        if (p.targetPrice) {
          listMsg += `• Target: ฿${p.targetPrice.toLocaleString()}\n`;
        }
        listMsg += `• Status: <code>${p.status}</code>\n\n`;
      });

      await sendTelegramMessage(botToken, chatId, listMsg);
    } catch (err: any) {
      await sendTelegramMessage(botToken, chatId, `❌ Error fetching list: ${err.message}`);
    }
    return;
  }

  // Add product command
  if (text.startsWith('/add')) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      await sendTelegramMessage(botToken, chatId, `❌ <b>Usage:</b> <code>/add [Lazada URL] [Target Price (Optional)]</code>`);
      return;
    }

    const url = parts[1];
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      await sendTelegramMessage(botToken, chatId, `❌ Invalid URL. Please provide a full Lazada product URL.`);
      return;
    }

    let targetPrice: number | null = null;
    if (parts.length >= 3) {
      const parsed = parseFloat(parts[2]);
      if (!isNaN(parsed) && parsed > 0) {
        targetPrice = parsed;
      }
    }

    await sendTelegramMessage(botToken, chatId, `🔍 Fetching and analyzing product page. Please wait... ⏳`);

    try {
      const result = await scrapeLazadaProduct(url);
      if (!result.success) {
        await sendTelegramMessage(botToken, chatId, `❌ <b>Scraping Failed:</b> ${result.error || 'Could not parse Lazada page.'}\n\n<i>Try tracking this product via the Web Dashboard, where you can paste the HTML directly!</i>`);
        return;
      }

      const product = await addProduct({
        url,
        title: result.title,
        imageUrl: result.imageUrl,
        initialPrice: result.price,
        currentPrice: result.price,
        targetPrice,
      });

      let addedMsg = `<b>🎉 Product Added Successfully!</b>\n\n`;
      addedMsg += `📦 <b>Title:</b> ${product.title}\n`;
      addedMsg += `💰 <b>Current Price:</b> ฿${product.currentPrice.toLocaleString()}\n`;
      if (product.targetPrice) {
        addedMsg += `🎯 <b>Target Price Set:</b> ฿${product.targetPrice.toLocaleString()}\n`;
      }
      addedMsg += `🆔 <b>Product ID:</b> <code>${product.id}</code>\n\n`;
      addedMsg += `We are now tracking this product for price drops!`;

      await sendTelegramMessage(botToken, chatId, addedMsg);
    } catch (err: any) {
      await sendTelegramMessage(botToken, chatId, `❌ Error adding product: ${err.message}`);
    }
    return;
  }

  // Remove product command
  if (text.startsWith('/remove')) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      await sendTelegramMessage(botToken, chatId, `❌ <b>Usage:</b> <code>/remove [Product ID]</code>`);
      return;
    }

    const id = parseInt(parts[1]);
    if (isNaN(id)) {
      await sendTelegramMessage(botToken, chatId, `❌ Product ID must be a valid number.`);
      return;
    }

    try {
      await deleteProduct(id);
      await sendTelegramMessage(botToken, chatId, `✅ <b>Success:</b> Stopped tracking product with ID: <code>${id}</code>`);
    } catch (err: any) {
      await sendTelegramMessage(botToken, chatId, `❌ Error removing product: ${err.message}`);
    }
    return;
  }

  // Check command
  if (text === '/check') {
    await sendTelegramMessage(botToken, chatId, `🔄 <b>Force check triggered!</b> Scanning all products... ⏳`);
    try {
      const products = await getProducts();
      if (products.length === 0) {
        await sendTelegramMessage(botToken, chatId, `ℹ️ No products to check.`);
        return;
      }

      let checkedCount = 0;
      let dropsCount = 0;

      for (const prod of products) {
        const result = await scrapeLazadaProduct(prod.url);
        if (result.success) {
          const { priceDropped, dropAmount } = await updateProductPrice(
            prod.id,
            result.price,
            'active',
            new Date().toISOString()
          );

          checkedCount++;
          if (priceDropped && dropAmount > 0) {
            dropsCount++;
            const dropMsg = formatPriceDropMessage(
              prod.title,
              prod.url,
              prod.currentPrice,
              result.price,
              dropAmount,
              prod.targetPrice
            );
            await sendTelegramMessage(botToken, chatId, dropMsg);
          }
        }
      }

      await sendTelegramMessage(botToken, chatId, `✅ <b>Check Completed!</b>\n\n• Checked: ${checkedCount}/${products.length} products\n• New Price Drops: ${dropsCount}`);
    } catch (err: any) {
      await sendTelegramMessage(botToken, chatId, `❌ Error running check: ${err.message}`);
    }
    return;
  }

  // Unrecognized command
  await sendTelegramMessage(botToken, chatId, `❓ <b>Unknown command:</b> "${text}"\nSend <code>/help</code> to view available options.`);
}

startBot();
