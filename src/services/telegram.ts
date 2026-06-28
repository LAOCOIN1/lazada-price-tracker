export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
  let cleanToken = (token || '').trim();
  if (cleanToken.toLowerCase().startsWith('bot')) {
    cleanToken = cleanToken.substring(3);
  }

  if (!cleanToken || !chatId) {
    console.warn('[Telegram] Sending aborted: Bot token or Chat ID is missing.');
    return false;
  }

  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      console.error('[Telegram] Failed to send message:', data.description || 'Unknown error');
      return false;
    }

    console.log('[Telegram] Message sent successfully.');
    return true;
  } catch (err) {
    console.error('[Telegram] Fetch error:', err);
    return false;
  }
}

export async function testTelegramConnection(token: string, chatId: string): Promise<boolean> {
  const text = `<b>🔌 Lazada Tracker Test Connection</b>\n\nConnection successful! This bot is now linked to your Lazada Price Tracker dashboard. You will receive notifications here when tracked product prices drop.`;
  return await sendTelegramMessage(token, chatId, text);
}

export function formatPriceDropMessage(
  title: string,
  url: string,
  prevPrice: number,
  currentPrice: number,
  dropAmount: number,
  targetPrice: number | null
): string {
  const percent = Math.round((dropAmount / prevPrice) * 100);
  
  let msg = `<b>📉 Lazada Price Drop Alert!</b>\n\n`;
  msg += `📦 <b>Product:</b> ${title}\n`;
  msg += `💰 <b>Previous Price:</b> ฿${prevPrice.toLocaleString()}\n`;
  msg += `🔥 <b>New Price:</b> ฿${currentPrice.toLocaleString()} (-${percent}%)\n`;
  msg += `✨ <b>Saved:</b> ฿${dropAmount.toLocaleString()}\n`;
  
  if (targetPrice) {
    msg += `🎯 <b>Target Price:</b> ฿${targetPrice.toLocaleString()}\n`;
    if (currentPrice <= targetPrice) {
      msg += `🎉 <b>Alert:</b> Product has reached your target price! 🏆\n`;
    }
  }

  msg += `\n🔗 <a href="${url}">View Product on Lazada</a>`;
  return msg;
}
