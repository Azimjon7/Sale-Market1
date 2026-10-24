(function (root) {
  // Shared by the storefront and server. Array entries are complete variant names.
  function options(value, type) {
    const clean = entries => {
      const unique = [...new Set(entries.map(String).map(v => v.trim()).filter(Boolean))];
      // "Standart" was an importer fallback, not a customer-selectable variant.
      return unique.length === 1 && /^(standart|standard)$/i.test(unique[0]) ? [] : unique;
    };
    if (Array.isArray(value)) return clean(value);
    const entries = String(value || '').split(',').map(v => v.trim()).filter(Boolean);
    if (type !== 'size') return clean(entries);
    const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
    return clean(entries.flatMap(entry => {
      const range = entry.match(/^(\d+)\s*[-\u2010-\u2015\u2212]\s*(\d+)$/);
      if (range) {
        const start = Number(range[1]), end = Number(range[2]);
        if (end >= start && end - start <= 30) return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
      }
      const letters = entry.toUpperCase().match(/^(XS|S|M|L|XL|[2-5]XL)\s*-\s*(XS|S|M|L|XL|[2-5]XL)$/);
      if (letters && sizes.indexOf(letters[2]) >= sizes.indexOf(letters[1])) return sizes.slice(sizes.indexOf(letters[1]), sizes.indexOf(letters[2]) + 1);
      return [entry];
    }));
  }
  function discount(product) {
    const price = Number(product && product.price);
    const oldPrice = Number(product && product.oldPrice);
    if (!(price > 0) || !(oldPrice > price)) return { visible: false, percent: 0, oldPrice: 0 };
    const percent = Math.round((1 - price / oldPrice) * 100);
    const ratio = oldPrice / price;
    // A comparison price is a trust claim. Imported or mechanically inflated values
    // above 3x the selling price are not shown until an administrator verifies them.
    // The actual selling price is never changed by this display rule.
    if (percent < 1 || percent >= 90 || ratio > 3) return { visible: false, percent, oldPrice, anomalous: true };
    return { visible: true, percent, oldPrice, anomalous: false };
  }
  function cleanDescription(value) {
    const text = String(value || '').trim();
    if (!text || /batafsil xususiyatlarni admin panel orqali tekshiring/i.test(text)) return '';
    return text;
  }
  function availability(product) {
    const mode = String(product && product._inventoryMode || 'standard');
    const available = stock(product);
    if (mode === 'made-to-order') {
      return { code: 'made-to-order', label: 'Buyurtma asosida', purchasable: true, madeToOrder: true };
    }
    if (available <= 0) return { code: 'out-of-stock', label: "Stokda yo‘q", purchasable: false, madeToOrder: false };
    return { code: 'in-stock', label: 'Stokda bor', purchasable: true, madeToOrder: false };
  }
  function stock(product) {
    const value = product.stock;
    return value == null || value === '' ? 999 : Math.max(0, Math.floor(Number(value) || 0));
  }
  function additionError(product, qty, cart) {
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) return 'Miqdor 1 dan 999 gacha butun son bo‘lishi kerak.';
    const existing = cart.filter(item => String(item.productId) === String(product.id)).reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const mustCheckStock = product.inventoryManaged === true || product._inventoryMode !== 'made-to-order';
    if (mustCheckStock && existing + qty > stock(product)) return "Omborda buncha mahsulot yo'q.";
    return '';
  }
  const rules = { options, stock, discount, cleanDescription, availability, additionError };
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
  else root.MBProductRules = rules;
})(typeof window === 'undefined' ? globalThis : window);
