'use strict';

const { timingSafeEqual } = require('crypto');

function sameSecret(actual, expected) {
  const left = Buffer.from(String(actual || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function copy(language) {
  if (String(language || '').toLowerCase().startsWith('ru')) return {
    language: 'ru',
    welcome: 'Добро пожаловать в Dodola. Заказы оформляются на сайте; онлайн-оплата пока не принимается.',
    support: 'Напишите /support и ваш вопрос в одном сообщении. Не отправляйте данные банковской карты, пароли или коды подтверждения. Телефон: +998 99 002 00 15.',
    supportSent: 'Сообщение передано службе поддержки. Ответ придёт в этот чат.',
    supportUnavailable: 'Чат поддержки пока не подключён. Позвоните по номеру +998 99 002 00 15.',
    sensitiveRejected: 'Сообщение похоже на данные карты или секретный код и не было отправлено. Удалите конфиденциальные данные и повторите.',
    adminDenied: 'Этот чат не авторизован для команд администратора.',
    replySent: 'Ответ отправлен клиенту.',
    site: 'Открыть Dodola', supportButton: 'Поддержка', track: 'Отследить заказ',
    uz: 'O‘zbekcha', ru: 'Русский',
  };
  return {
    language: 'uz',
    welcome: 'Dodola’ga xush kelibsiz. Buyurtma saytda rasmiylashtiriladi; hozircha onlayn to‘lov olinmaydi.',
    support: 'Bir xabarda /support va savolingizni yozing. Bank karta ma’lumoti, parol yoki tasdiqlash kodini yubormang. Telefon: +998 99 002 00 15.',
    supportSent: 'Xabar yordam xizmatiga yuborildi. Javob shu chatga keladi.',
    supportUnavailable: 'Yordam chati hali ulanmagan. +998 99 002 00 15 raqamiga qo‘ng‘iroq qiling.',
    sensitiveRejected: 'Xabarda karta ma’lumoti yoki maxfiy kodga o‘xshash raqam bor; xabar yuborilmadi. Maxfiy ma’lumotni olib tashlab qayta yozing.',
    adminDenied: 'Bu chat administrator buyruqlari uchun ruxsat etilmagan.',
    replySent: 'Javob mijozga yuborildi.',
    site: 'Dodola’ni ochish', supportButton: 'Yordam', track: 'Buyurtmani kuzatish',
    uz: 'O‘zbekcha', ru: 'Русский',
  };
}

function hasSensitiveNumber(value) {
  return /(?:\d[\s-]*){12,19}/.test(String(value || ''));
}

function startKeyboard(words, baseUrl) {
  return { inline_keyboard: [
    [{ text: words.site, url: baseUrl }, { text: words.track, url: `${baseUrl}/track-order.html` }],
    [{ text: words.supportButton, callback_data: 'support' }],
    [{ text: words.uz, callback_data: 'lang:uz' }, { text: words.ru, callback_data: 'lang:ru' }],
  ] };
}

function createTelegramUpdateHandler({ env = process.env, fetcher = global.fetch } = {}) {
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const adminChatId = String(env.TELEGRAM_CHAT_ID || '').trim();
  const baseUrl = String(env.AUTH_BASE_URL || 'https://dodola.uz').replace(/\/$/, '');
  const configured = Boolean(token && typeof fetcher === 'function');
  const seen = new Set();
  const languages = new Map();

  async function telegram(method, payload) {
    const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
    return response;
  }

  const send = (chatId, text, extra = {}) => telegram('sendMessage', { chat_id: chatId, text, ...extra });

  async function handleUpdate(update) {
    const updateId = Number(update && update.update_id);
    if (!Number.isInteger(updateId)) return { accepted: false };
    if (seen.has(updateId)) return { accepted: true, duplicate: true };
    seen.add(updateId);
    if (seen.size > 500) seen.delete(seen.values().next().value);

    const callback = update && update.callback_query;
    const message = (update && update.message) || (callback && callback.message);
    const actor = (update && update.message && update.message.from) || (callback && callback.from) || {};
    const chatId = message && message.chat && message.chat.id;
    if (!chatId) return { accepted: true };
    const preferred = languages.get(String(chatId)) || actor.language_code;
    let words = copy(preferred);

    try {
      if (callback) {
        const data = String(callback.data || '');
        if (/^lang:(uz|ru)$/.test(data)) {
          const language = data.slice(5);
          languages.set(String(chatId), language);
          words = copy(language);
          await telegram('answerCallbackQuery', { callback_query_id: callback.id });
          await send(chatId, words.welcome, { reply_markup: startKeyboard(words, baseUrl) });
        } else if (data === 'support') {
          await telegram('answerCallbackQuery', { callback_query_id: callback.id });
          await send(chatId, words.support);
        }
        return { accepted: true };
      }

      const text = String(message.text || '').trim();
      if (/^\/(uz|ru)(?:@\w+)?(?:\s|$)/i.test(text)) {
        const language = text.slice(1, 3).toLowerCase();
        languages.set(String(chatId), language);
        words = copy(language);
        await send(chatId, words.welcome, { reply_markup: startKeyboard(words, baseUrl) });
      } else if (/^\/myid(?:@\w+)?(?:\s|$)/i.test(text)) {
        await send(chatId, `Chat ID: ${chatId}`);
      } else if (/^\/reply(?:@\w+)?\s+(-?\d+)\s+([\s\S]{1,1000})$/i.test(text)) {
        if (!adminChatId || String(chatId) !== adminChatId) {
          await send(chatId, words.adminDenied);
        } else {
          const match = text.match(/^\/reply(?:@\w+)?\s+(-?\d+)\s+([\s\S]{1,1000})$/i);
          if (hasSensitiveNumber(match[2])) await send(chatId, words.sensitiveRejected);
          else {
            await send(match[1], `${words.language === 'ru' ? 'Ответ поддержки Dodola' : 'Dodola yordam xizmati javobi'}:\n${match[2]}`);
            await send(chatId, words.replySent);
          }
        }
      } else if (/^\/support(?:@\w+)?(?:\s|$)/i.test(text)) {
        const supportText = text.replace(/^\/support(?:@\w+)?\s*/i, '').trim();
        if (!supportText) await send(chatId, words.support);
        else if (hasSensitiveNumber(supportText)) await send(chatId, words.sensitiveRejected);
        else if (!adminChatId) await send(chatId, words.supportUnavailable);
        else {
          await send(adminChatId, `Dodola support murojaati\nChat ID: ${chatId}\nTil: ${words.language}\nXabar: ${supportText.slice(0, 1000)}`);
          await send(chatId, words.supportSent);
        }
      } else if (/^\/track(?:@\w+)?(?:\s|$)/i.test(text)) {
        await send(chatId, words.welcome, { reply_markup: { inline_keyboard: [[{ text: words.track, url: `${baseUrl}/track-order.html` }]] } });
      } else if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
        await send(chatId, words.welcome, { reply_markup: startKeyboard(words, baseUrl) });
      } else {
        await send(chatId, words.support, { reply_markup: startKeyboard(words, baseUrl) });
      }
      return { accepted: true };
    } catch (error) {
      seen.delete(updateId);
      throw error;
    }
  }

  return { configured, adminConfigured: Boolean(adminChatId), telegram, handleUpdate };
}

function installTelegramBot(app, { env = process.env, fetcher = global.fetch } = {}) {
  const secret = String(env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  const bot = createTelegramUpdateHandler({ env, fetcher });
  const configured = Boolean(bot.configured && secret);

  app.post('/api/telegram/webhook', async (req, res) => {
    if (!configured) return res.sendStatus(404);
    if (!sameSecret(req.get('x-telegram-bot-api-secret-token'), secret)) return res.sendStatus(401);
    try {
      const result = await bot.handleUpdate(req.body);
      if (!result.accepted) return res.sendStatus(400);
      return res.sendStatus(200);
    } catch (error) {
      console.error('[telegram-bot] Request failed:', error.message);
      return res.sendStatus(503);
    }
  });

  return { configured, adminConfigured: bot.adminConfigured };
}

function startTelegramPolling({ env = process.env, fetcher = global.fetch, log = console } = {}) {
  const bot = createTelegramUpdateHandler({ env, fetcher });
  if (!bot.configured) return { configured: false, stop() {} };

  const controller = new AbortController();
  let offset = 0;
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  const run = async () => {
    try {
      await bot.telegram('deleteWebhook', { drop_pending_updates: false });
    } catch (error) {
      log.error('[telegram-polling] Webhook cleanup failed:', error.message);
    }

    while (!controller.signal.aborted) {
      try {
        const response = await bot.telegram('getUpdates', {
          offset, timeout: 25, allowed_updates: ['message', 'callback_query'],
        });
        const body = await response.json();
        if (!body.ok || !Array.isArray(body.result)) throw new Error('Telegram getUpdates rejected');
        for (const update of body.result) {
          await bot.handleUpdate(update);
          offset = Math.max(offset, Number(update.update_id) + 1);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          log.error('[telegram-polling] Request failed:', error.message);
          await wait(2000);
        }
      }
    }
  };

  run();
  return { configured: true, stop() { controller.abort(); } };
}

module.exports = {
  installTelegramBot,
  startTelegramPolling,
  createTelegramUpdateHandler,
  sameSecret,
  copy,
  hasSensitiveNumber,
  startKeyboard,
};
