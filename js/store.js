(function () {
  const CART_KEY = 'mujskoy_cart';
  const ORDERS_KEY = 'mujskoy_orders';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
  }

  function getLocalOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch (e) { return []; }
  }

  function normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.startsWith("998") && digits.length > 9 ? digits.slice(-9) : digits;
  }

  function productSnapshot(product) {
    if (!product || typeof product !== "object") return null;
    const images = Array.isArray(product.images) ? product.images : [];
    return {
      id: String(product.id || product.productId || ""),
      name: product.name || "Mahsulot",
      price: Number(product.price || 0),
      oldPrice: Number(product.oldPrice || 0),
      image: product.image || images[0] || "img/placeholders/dodola-product.svg",
      images: images.length ? images : [product.image || "img/placeholders/dodola-product.svg"],
      category: product.category || "",
      stock: Number(product.stock ?? 999),
      available: Number(product.available ?? product.stock ?? 999),
      inventoryManaged: product.inventoryManaged === true,
      inventoryVersion: product.inventoryVersion,
      lowStockThreshold: Number(product.lowStockThreshold ?? 5),
      _inventoryMode: product._inventoryMode || 'standard',
      _productionDays: product._productionDays,
      _acceptsMTO: product._acceptsMTO,
    };
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCounters();
  }
  function addToCart(item) {
    const cart = getCart();
    if (item.product) {
      const error = window.MBProductRules.additionError(item.product, Number(item.qty), cart);
      if (error) return { ok: false, error };
    }
    const snapshot = productSnapshot(item.product);
    const normalizedItem = {
      ...item,
      productId: String(item.productId),
      qty: Math.max(1, Number(item.qty) || 1),
      size: item.size || "",
      color: item.color || "",
      product: snapshot || item.product || null,
    };
    const found = cart.find(x =>
      String(x.productId) === normalizedItem.productId &&
      String(x.size || "") === normalizedItem.size &&
      String(x.color || "") === normalizedItem.color
    );
    if ((found ? Number(found.qty) : 0) + normalizedItem.qty > 999) return { ok: false, error: 'Bir variant miqdori 999 dan oshmasligi kerak.' };
    if (found) {
      found.qty = Math.max(1, Number(found.qty) || 1) + normalizedItem.qty;
      if (normalizedItem.product) found.product = normalizedItem.product;
    }
    else cart.push(normalizedItem);
    saveCart(cart);
    return { ok: true };
  }
  function removeFromCart(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
  }
  function updateQty(index, qty) {
    const cart = getCart();
    if (!cart[index]) return;
    cart[index].qty = Math.max(1, Number(qty) || 1);
    saveCart(cart);
  }
  function findCartIndex(productId, size = '', color = '') {
    return getCart().findIndex(item => String(item.productId) === String(productId) &&
      String(item.size || '') === String(size || '') && String(item.color || '') === String(color || ''));
  }
  function getItemQty(productId, size = '', color = '') {
    const cart = getCart();
    const index = cart.findIndex(item => String(item.productId) === String(productId) &&
      String(item.size || '') === String(size || '') && String(item.color || '') === String(color || ''));
    return index < 0 ? 0 : Math.max(0, Number(cart[index].qty) || 0);
  }
  function setItemQty(item, qty) {
    const cart = getCart();
    const productId = String(item.productId);
    const size = String(item.size || '');
    const color = String(item.color || '');
    const index = cart.findIndex(row => String(row.productId) === productId && String(row.size || '') === size && String(row.color || '') === color);
    const nextQty = Math.max(0, Math.min(999, Math.floor(Number(qty) || 0)));
    if (nextQty === 0) {
      if (index >= 0) cart.splice(index, 1);
      saveCart(cart);
      return { ok: true, qty: 0 };
    }
    const currentQty = index >= 0 ? Math.max(0, Number(cart[index].qty) || 0) : 0;
    if (item.product && nextQty > currentQty) {
      const withoutCurrent = cart.filter((_, cartIndex) => cartIndex !== index);
      const error = window.MBProductRules.additionError(item.product, nextQty, withoutCurrent);
      if (error) return { ok: false, error, qty: currentQty };
    }
    const snapshot = productSnapshot(item.product);
    const next = { ...item, productId, size, color, qty: nextQty, product: snapshot || item.product || null };
    if (index >= 0) cart[index] = { ...cart[index], ...next };
    else cart.push(next);
    saveCart(cart);
    return { ok: true, qty: nextQty };
  }
  function clearCart() {
    saveCart([]);
  }

  function saveLocalOrder(order) {
    const orders = getLocalOrders();
    const item = {
      ...order,
      id: order.id || `ord_${Date.now()}`,
      status: order.status || "new",
      createdAt: order.createdAt || new Date().toISOString(),
    };
    orders.unshift(item);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return item;
  }

  function findLocalOrder(orderId, phone) {
    const normalizedPhone = normalizePhone(phone);
    return getLocalOrders().find((order) => {
      return String(order.id) === String(orderId) && normalizePhone(order.phone) === normalizedPhone;
    }) || null;
  }

  function updateCartCounters() {
    const count = getCart().reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    document.querySelectorAll('.js-cart-count').forEach(el => el.textContent = count);
    document.dispatchEvent(new CustomEvent('mb:cart-updated', { detail: { count } }));
  }
  const cardProducts = new Map();
  function cardVariant(product) {
    return {
      productId: String(product.id),
      size: (window.MBProductRules.options(product.sizes, 'size')[0] || ''),
      color: (window.MBProductRules.options(product.colors, 'color')[0] || ''),
      product,
    };
  }
  function renderCardControl(host) {
    const product = cardProducts.get(String(host.dataset.productId || ''));
    if (!product) return;
    const item = cardVariant(product);
    const qty = getItemQty(item.productId, item.size, item.color);
    if (!qty) {
      host.innerHTML = '<button type="button" class="link-btn js-add-card">Savatga</button>';
      return;
    }
    host.innerHTML = `<div class="card-cart-actions">
      <div class="card-cart-stepper" aria-label="Soni">
        <button type="button" class="js-card-qty" data-delta="-1" aria-label="Kamaytirish">−</button>
        <output aria-live="polite">${qty}</output>
        <button type="button" class="js-card-qty" data-delta="1" aria-label="Ko‘paytirish">+</button>
      </div>
      <a class="card-cart-go" href="shop-cart.html" aria-label="Savatga o‘tish"><i class="fa fa-shopping-bag" aria-hidden="true"></i><span>O‘tish</span></a>
    </div>`;
  }
  function renderCardControls() {
    document.querySelectorAll('[data-cart-control][data-product-id]').forEach(renderCardControl);
  }
  function registerProducts(products) {
    (Array.isArray(products) ? products : []).forEach(product => cardProducts.set(String(product.id), product));
    renderCardControls();
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('.js-add-card,.js-card-qty');
    if (!target) return;
    const host = target.closest('[data-cart-control][data-product-id]');
    if (!host) return;
    event.preventDefault();
    const product = cardProducts.get(String(host.dataset.productId || ''));
    if (!product) return;
    const item = cardVariant(product);
    const current = getItemQty(item.productId, item.size, item.color);
    const next = target.classList.contains('js-add-card') ? 1 : current + Number(target.dataset.delta || 0);
    const result = setItemQty(item, next);
    if (!result.ok) {
      document.dispatchEvent(new CustomEvent('dodola:cart-error', { detail: { message: result.error } }));
      if (typeof alert === 'function') alert(result.error);
      return;
    }
    if (next > current) window.DodolaAnalytics?.track('add_to_cart', item.productId);
    renderCardControl(host);
  });
  document.addEventListener('mb:cart-updated', renderCardControls);
  window.MBStore = { getCart, saveCart, addToCart, removeFromCart, updateQty, findCartIndex, getItemQty, setItemQty, registerProducts, renderCardControls, clearCart, getLocalOrders, saveLocalOrder, findLocalOrder, updateCartCounters };
  document.addEventListener('DOMContentLoaded', updateCartCounters);
})();
