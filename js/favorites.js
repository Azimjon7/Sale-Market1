(async () => {
  const grid = document.getElementById('favoritesGrid');
  if (!grid) return;
  let products = [];

  function render() {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem('dodola_favorites') || '[]'); } catch (_) {}
    const rows = products.filter(product => ids.includes(String(product.id)));
    grid.innerHTML = rows.length
      ? rows.map(product => MBHelpers.productCard(product, { showDescription: false })).join('')
      : '<div class="account-empty"><h2>Saralanganlar hali yo‘q</h2><p>Yoqtirgan mahsulotlaringizni yurak tugmasi bilan saqlang.</p><a class="d-secondary" href="shop.html">Katalogga o‘tish →</a></div>';
    if (window.MBStore && MBStore.registerProducts) MBStore.registerProducts(rows);
  }

  try {
    products = await MBHelpers.loadProducts();
    render();
  } catch (error) {
    document.getElementById('favoritesMessage').textContent = error.message;
  }
  document.addEventListener('dodola:favorites', render);
})();
