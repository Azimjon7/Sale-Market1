'use strict';

const { timingSafeEqual } = require('crypto');

function sameSecret(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function copy(language) {
  if (String(language || '').toLowerCase().startsWith('ru')) return {
    welcome: 'Добро пожаловать в Dodola. Заказы оформляются на сайте; онлайн-оплата пока не принимается.',
    support: 'Поддержка: +998 99 002 00 15. Не отправляйте данные банковской карты в чат.',
    site: 'Открыть Dodola', track: 'Отследить заказ',
  };
  return {
    welcome: 'Dodola’ga xush kelibsiz. Buyurtma saytda rasmiylashtiriladi; hozircha onlayn to‘lov olinmaydi.',
    support: 'Yordam: +998 99 002 00 15. Bank karta ma’lumotlarini chatga yubormang.',
    site: 'Dodola’ni ochish', track: 'Buyurtmani kuzatish',
  };
}

function installTelegramBot(app, { env = process.env, fetcher = global.fetch } = {}) {
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const secret = String(env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  const baseUrl = String(env.AUTH_BASE_URL || 'https://dodola.uz').replace(/\/$/, '');
  const configured = Boolean(token && secret && typeof fetcher === 'function');
  const seen = new Set();

  app.post('/api/telegram/webhook', async (req, res) => {
    if (!configured) return res.sendStatus(404);
    if (!sameSecret(req.get('x-telegram-bot-api-secret-token'), secret)) return res.sendStatus(401);
    const updateId = Number(req.body && req.body.update_id);
    if (!Number.isInteger(updateId)) return res.sendStatus(400);
    if (seen.has(updateId)) return res.sendStatus(200);
    seen.add(updateId);
    if (seen.size > 500) seen.delete(seen.values().next().value);

    const message = req.body && req.body.message;
    const chatId = message && message.chat && message.chat.id;
    if (!chatId) return res.sendStatus(200);
    const language = message.from && message.from.language_code;
    const text = String(message.text || '').trim();
    const words = copy(language);
    const responseText = /^\/(start|track)(?:@\w+)?(?:\s|$)/i.test(text) ? words.welcome : words.support;
    const payload = {
      chat_id: chatId,
      text: responseText,
      reply_markup: { inline_keyboard: [[
        { text: words.site, url: baseUrl },
        { text: words.track, url: `${baseUrl}/track-order.html` },
      ]] },
    };
    try {
      const response = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
      return res.sendStatus(200);
    } catch (error) {
      console.error('[telegram-bot] Reply failed:', error.message);
      return res.sendStatus(503);
    }
  });

  return { configured };
}

module.exports = { installTelegramBot, sameSecret, copy };
