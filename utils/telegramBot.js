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

function installTelegramBot(app, { env = process.env, fetcher = global.fetch } = {}) {
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const secret = String(env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  const adminChatId = String(env.TELEGRAM_CHAT_ID || '').trim();
  const baseUrl = String(env.AUTH_BASE_URL || 'https://dodola.uz').replace(/\/$/, '');
  const configured = Boolean(token && secret && typeof fetcher === 'function');
  const seen = new Set();
  const languages = new Map();

  async function telegram(method, payload) {
    const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  }

  const send = (chatId, text, extra = {}) => telegram('sendMessage', { chat_id: chatId, text, ...extra });

  app.post('/api/telegram/webhook', async (req, res) => {
    if (!configured) return res.sendStatus(404);
    if (!sameSecret(req.get('x-telegram-bot-api-secret-token'), secret)) return res.sendStatus(401);
    const updateId = Number(req.body && req.body.update_id);
    if (!Number.isInteger(updateId)) return res.sendStatus(400);
    if (seen.has(updateId)) return res.sendStatus(200);
    seen.add(updateId);
    if (seen.size > 500) seen.delete(seen.values().next().value);

    const callback = req.body && req.body.callback_query;
    const message = (req.body && req.body.message) || (callback && callback.message);
    const actor = (req.body && req.body.message && req.body.message.from) || (callback && callback.from) || {};
    const chatId = message && message.chat && message.chat.id;
    if (!chatId) return res.sendStatus(200);
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
        return res.sendStatus(200);
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
      return res.sendStatus(200);
    } catch (error) {
      seen.delete(updateId);
      console.error('[telegram-bot] Request failed:', error.message);
      return res.sendStatus(503);
    }
  });

  return { configured, adminConfigured: Boolean(adminChatId) };
}

module.exports = { installTelegramBot, sameSecret, copy, hasSensitiveNumber, startKeyboard };
