'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { installTelegramBot } = require('../utils/telegramBot');

function fixture() {
  const calls = [];
  const app = express(); app.use(express.json());
  installTelegramBot(app, { env: { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_WEBHOOK_SECRET: 'test-secret', AUTH_BASE_URL: 'https://dodola.uz' }, fetcher: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, status: 200 }; } });
  return { app, calls };
}

test('Telegram webhook rejects spoofing and duplicate updates', async () => {
  const { app, calls } = fixture();
  const update = { update_id: 7, message: { text: '/start', chat: { id: 42 }, from: { language_code: 'uz' } } };
  await request(app).post('/api/telegram/webhook').send(update).expect(401);
  await request(app).post('/api/telegram/webhook').set('x-telegram-bot-api-secret-token', 'test-secret').send(update).expect(200);
  await request(app).post('/api/telegram/webhook').set('x-telegram-bot-api-secret-token', 'test-secret').send(update).expect(200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.chat_id, 42);
  assert.match(calls[0].body.reply_markup.inline_keyboard[0][1].url, /track-order\.html$/);
});

test('Russian support reply contains no payment-success claim or card request', async () => {
  const { app, calls } = fixture();
  await request(app).post('/api/telegram/webhook').set('x-telegram-bot-api-secret-token', 'test-secret').send({ update_id: 8, message: { text: 'Помощь', chat: { id: 77 }, from: { language_code: 'ru' } } }).expect(200);
  assert.match(calls[0].body.text, /Не отправляйте данные банковской карты/);
  assert.doesNotMatch(calls[0].body.text, /оплачен|успешн/i);
});
