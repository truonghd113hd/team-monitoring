import axios from 'axios';

/**
 * Send a Telegram message. When `chatIdOverride` is provided it is used instead of the
 * env-level TELEGRAM_CHAT_ID — useful for per-project routing.
 * Errors are swallowed so callers can continue even if Telegram is down.
 */
export const sendTelegramMessage = async (
  message: string,
  chatIdOverride?: string | null
): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride || process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[TELEGRAM] Bot token or chat ID not configured, skipping notification');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    console.log(`[TELEGRAM] Sending to chatId=${chatId} (override=${!!chatIdOverride})`);
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('[TELEGRAM] Message sent successfully');
  } catch (error) {
    const err = error as any;
    console.error(
      '[TELEGRAM] Failed to send message:',
      err.message,
      '| chatId used:',
      chatId,
      '| status:',
      err.response?.status,
      '| response body:',
      JSON.stringify(err.response?.data)
    );
  }
};
