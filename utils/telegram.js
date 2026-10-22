/**
 * Dodola — Telegram Order Notifications
 * Fault-isolated: missing config or API failures never crash the checkout.
 */

/**
 * Format a price as "230,000 UZS".
 * @param {number|string} value
 * @returns {string}
 */
function formatPrice(value) {
  const n = Math.round(Number(value) || 0);
  return n.toLocaleString("en-US").replace(/,/g, " ") + " UZS";
}

/**
 * Build the Telegram notification message for a new order.
 * @param {Object} order
 * @returns {string}
 */
function buildMessage(order) {
  const items = (Array.isArray(order.items) ? order.items : [])
    .filter(Boolean);
  const quantity = items.reduce((sum, item) =>
    sum + Math.max(1, Number(item.qty || item.quantity || 1)), 0);
  const paymentLabels = {
    click: "Click", payme: "Payme", uzum: "Uzum",
    card: "Bank kartasi", karta: "Bank kartasi",
  };
  const paymentKey = String(order.paymentPreference || order.paymentType || "").toLowerCase();
  const orderNumber = order.orderNumber || order.id || "—";
  const adminBaseUrl = String(process.env.AUTH_BASE_URL || "https://dodola.uz").replace(/\/$/, "");

  return [
    "🛒 Dodola — yangi buyurtma",
    "",
    `📦 Buyurtma: ${orderNumber}`,
    "⏳ Holat: mavjudlik tasdig‘i kutilmoqda",
    `🧾 Mahsulotlar: ${items.length} tur, ${quantity} dona`,
    `💰 Jami: ${formatPrice(order.total || 0)}`,
    `💳 To‘lov istagi: ${paymentLabels[paymentKey] || "Belgilanmagan"}`,
    "🔒 Onlayn to‘lov olinmagan.",
    "",
    `${adminBaseUrl}/admin.html`,
  ].join("\n");
}

/**
 * Send an order notification to a Telegram chat.
 *
 * Rules:
 *   - Silent no-op when TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.
 *   - Aborts after 5 seconds.
 *   - Never throws — errors are logged but never propagate to callers.
 *
 * @param {Object} order  The saved order object.
 * @returns {Promise<void>}
 */
async function sendOrderNotification(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Missing env → silent no-op (warned at startup in server.js)
  if (!token || !chatId) {
    return;
  }

  // Node < 18 doesn't have global fetch
  if (typeof fetch !== "function") {
    console.warn(
      "[telegram] global fetch is not available (Node < 18). Skipping order notification."
    );
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    console.warn(
      "[telegram] Notification timed out (5s) for order",
      order && order.id
    );
  }, 5000);

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: buildMessage(order),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[telegram] API error ${res.status}`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      return; // timeout already logged above
    }
    console.error("[telegram] sendOrderNotification failed:", err.message);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { sendOrderNotification, buildMessage, formatPrice };
