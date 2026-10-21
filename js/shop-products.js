(async function () {
  'use strict';

  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  const PAGE_SIZE = 24;
  const state = {
    products: [], meta: { total: 0, page: 1, limit: PAGE_SIZE, pages: 1 },
    categories: [], loading: false, controller: null,
  };
  const debounce = (fn, ms) => {
    let timer;
    return function () { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, arguments), ms); };
  };
  const normalizedCategory = value => MBHelpers.normalizeCategory(value || '');

  function getSearchQuery() {
    for (const id of ['sct-search', 'mcf-search', 'shop-search']) {
      const input = document.getElementById(id);
      if (input && input.value.trim()) return input.value.trim();
    }
    const params = new URLSearchParams(location.search);
    return (params.get('search') || params.get('q') || '').trim();
  }

  function setAllSearchInputs(value) {
    ['sct-search', 'mcf-search', 'shop-search'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    });
  }

  function activeCategory() {
    const button = document.querySelector('.shop-toolbar__filters .filter-btn.active');
    return button ? String(button.dataset.category || '') : '';
  }

  function requestParams(page = 1) {
    const min = document.getElementById('shop-price-min');
    const max = document.getElementById('shop-price-max');
    const sort = document.getElementById('shop-sort');
    const params = { page, limit: PAGE_SIZE, sort: (sort && sort.value) || 'newest' };
    const search = getSearchQuery();
    const category = activeCategory() || String(new URLSearchParams(location.search).get('category') || '');
    if (search) params.search = search;
    if (category) params.category = category;
    if (min && min.value !== '') params.minPrice = Number(min.value);
    if (max && max.value !== '') params.maxPrice = Number(max.value);
    if (new URLSearchParams(location.search).get('sale') === '1') params.sale = 1;
    return params;
  }

  function skeletonMarkup(count = 12) {
    return Array.from({ length: count }, (_, index) => `
      <div class="catalog-skeleton" aria-hidden="true" style="--skeleton-delay:${index * 35}ms">
        <span class="catalog-skeleton__image"></span>
        <span class="catalog-skeleton__line catalog-skeleton__line--short"></span>
        <span class="catalog-skeleton__line"></span>
        <span class="catalog-skeleton__line catalog-skeleton__line--price"></span>
      </div>`).join('');
  }

  function showSkeleton() {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = skeletonMarkup(window.innerWidth <= 768 ? 6 : 12);
  }

  function updateLoadMore() {
    let wrap = document.getElementById('catalog-load-more');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'catalog-load-more';
      wrap.className = 'catalog-load-more';
      grid.insertAdjacentElement('afterend', wrap);
    }
    const hasMore = state.meta.page < state.meta.pages;
    wrap.hidden = !hasMore;
    wrap.innerHTML = hasMore
      ? `<button type="button" class="catalog-load-more__button">Ko‘proq ko‘rsatish <span>${state.products.length}/${state.meta.total}</span></button>`
      : '';
    const button = wrap.querySelector('button');
    if (button) button.addEventListener('click', () => loadPage(state.meta.page + 1, { append: true }));
  }

  function updateHeading() {
    const query = getSearchQuery();
    const category = activeCategory() || String(new URLSearchParams(location.search).get('category') || '');
    const title = document.querySelector('.sm-catalog-title, .sm-catalog-intro h1');
    const label = document.getElementById('sct-cat-label');
    if (label) label.textContent = category || 'Barchasi';
    if (title) title.textContent = query ? 'Qidiruv natijalari' : category || (new URLSearchParams(location.search).get('sale') === '1' ? 'Chegirmali mahsulotlar' : 'Barcha mahsulotlar');
    const count = document.getElementById('shop-count');
    if (count) count.textContent = `${state.meta.total} ta mahsulot`;
  }

  function emptyMarkup() {
    const query = getSearchQuery();
    const title = query ? 'Hech qanday mahsulot topilmadi' : 'Mahsulot topilmadi';
    const description = query ? `“${MBHelpers.escapeHtml(query)}” so‘rovi bo‘yicha natija yo‘q.` : 'Filtrlarni o‘zgartiring yoki tozalang.';
    return `<div class="shop-empty"><div class="shop-empty__icon"><i class="fa fa-search"></i></div><h3>${title}</h3><p>${description}</p><button type="button" class="btn btn-primary" id="shop-empty-clear">Filtrlarni tozalash</button></div>`;
  }

  function errorMarkup() {
    return `<div class="shop-empty shop-empty--error"><div class="shop-empty__icon"><i class="fa fa-refresh"></i></div><h3>Katalog yuklanmadi</h3><p>Internet aloqasini tekshirib, qayta urinib ko‘ring.</p><button type="button" class="btn btn-primary" id="shop-retry">Qayta urinish</button></div>`;
  }

  function renderProducts(products, append = false) {
    grid.removeAttribute('aria-busy');
    if (!append && !products.length) {
      grid.innerHTML = emptyMarkup();
      const clear = document.getElementById('shop-empty-clear');
      if (clear) clear.addEventListener('click', clearFilters);
      updateLoadMore();
      return;
    }
    const markup = products.map((product, index) => MBHelpers.productCard(product, {
      showDescription: false,
      priority: !append && index < (window.innerWidth <= 768 ? 4 : 6),
    })).join('');
    if (append) grid.insertAdjacentHTML('beforeend', markup);
    else grid.innerHTML = markup;
    updateLoadMore();
  }

  function applyResponse(data, append) {
    const products = Array.isArray(data.products) ? data.products : [];
    state.meta = data.meta || state.meta;
    if (append) {
      const seen = new Set(state.products.map(product => String(product.id)));
      const unique = products.filter(product => !seen.has(String(product.id)));
      state.products.push(...unique);
      renderProducts(unique, true);
    } else {
      state.products = products;
      renderProducts(products, false);
      restoreSavedScroll();
    }
    updateHeading();
    updateLoadMore();
  }

  async function loadPage(page = 1, options = {}) {
    const append = Boolean(options.append);
    const params = requestParams(page);
    if (!append && !options.skipCache) {
      const cached = MBHelpers.readCatalogCache(params);
      if (cached) applyResponse(cached, false);
      else if (options.skeleton !== false) showSkeleton();
    }
    if (state.controller) state.controller.abort();
    state.controller = new AbortController();
    state.loading = true;
    const loadMoreButton = document.querySelector('.catalog-load-more__button');
    if (loadMoreButton) { loadMoreButton.disabled = true; loadMoreButton.setAttribute('aria-busy', 'true'); }
    try {
      const data = await MBHelpers.fetchCatalogPage(params, { signal: state.controller.signal });
      applyResponse(data, append);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (!state.products.length) {
        grid.removeAttribute('aria-busy');
        grid.innerHTML = errorMarkup();
        const retry = document.getElementById('shop-retry');
        if (retry) retry.addEventListener('click', () => loadPage(1, { skipCache: true }));
      }
    } finally {
      state.loading = false;
    }
  }

  function renderCategoryFilters(meta) {
    const wrap = document.querySelector('.shop-toolbar__filters');
    if (!wrap) return;
    const initial = normalizedCategory(new URLSearchParams(location.search).get('category') || activeCategory());
    state.categories = Array.isArray(meta.categories) ? meta.categories : [];
    const buttons = [{ name: '', count: Number(meta.total || 0) }, ...state.categories]
      .map(item => `<button class="filter-btn${normalizedCategory(item.name) === initial ? ' active' : ''}" data-category="${MBHelpers.escapeHtml(item.name)}" data-count="${Number(item.count || 0)}">${item.name ? MBHelpers.escapeHtml(item.name) : 'Barchasi'}</button>`);
    wrap.innerHTML = buttons.join('');
    if (!wrap.querySelector('.filter-btn.active')) wrap.querySelector('.filter-btn').classList.add('active');
    wrap.querySelectorAll('.filter-btn').forEach(button => button.addEventListener('click', function () {
      wrap.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
      this.classList.add('active');
      syncUrl();
      loadPage(1);
    }));
    updateHeading();
  }

  function syncUrl() {
    const url = new URL(location.href);
    const search = getSearchQuery();
    const category = activeCategory();
    if (search) url.searchParams.set('search', search); else { url.searchParams.delete('search'); url.searchParams.delete('q'); }
    if (category) url.searchParams.set('category', category); else url.searchParams.delete('category');
    history.replaceState(null, '', url);
  }

  function clearFilters() {
    const url = new URL(location.href);
    ['search', 'q', 'category', 'sale'].forEach(key => url.searchParams.delete(key));
    history.replaceState(null, '', url);
    setAllSearchInputs('');
    ['shop-price-min', 'shop-price-max'].forEach(id => { const input = document.getElementById(id); if (input) input.value = ''; });
    const sort = document.getElementById('shop-sort');
    if (sort) sort.value = 'newest';
    document.querySelectorAll('.filter-btn').forEach(button => button.classList.remove('active'));
    const all = document.querySelector('.filter-btn[data-category=""]');
    if (all) all.classList.add('active');
    loadPage(1);
  }

  function saveScroll() {
    try { sessionStorage.setItem(`dodola:catalog:scroll:${location.pathname}${location.search}`, JSON.stringify({ y: scrollY, savedAt: Date.now() })); } catch (_) {}
  }

  function restoreSavedScroll() {
    if (!/product-details\.html|shop-cart\.html|account\.html/.test(document.referrer || '')) return;
    try {
      const raw = sessionStorage.getItem(`dodola:catalog:scroll:${location.pathname}${location.search}`);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && Date.now() - saved.savedAt < 600000) requestAnimationFrame(() => scrollTo(0, saved.y));
    } catch (_) {}
  }

  grid.addEventListener('click', event => {
    const button = event.target.closest('.js-add-card');
    if (!button) return;
    event.preventDefault();
    const product = state.products.find(item => String(item.id) === String(button.dataset.id));
    if (!product) return;
    const result = MBStore.addToCart({ productId: product.id, qty: 1, size: (product.sizes || [])[0] || '', color: (product.colors || [])[0] || '', product });
    if (!result.ok) { alert(result.error); return; }
    if (MBStore.updateCartCounters) MBStore.updateCartCounters();
    document.dispatchEvent(new CustomEvent('mb:cart-updated'));
    const original = button.textContent;
    button.textContent = 'Qo‘shildi ✓';
    setTimeout(() => { button.textContent = original; }, 1200);
  });

  grid.addEventListener('error', event => {
    const image = event.target.closest && event.target.closest('.d-catalog-image');
    if (!image || image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = 'true';
    image.src = 'img/placeholders/dodola-product.svg';
  }, true);

  const refresh = debounce(() => { syncUrl(); loadPage(1); }, 320);
  const initialParams = new URLSearchParams(location.search);
  setAllSearchInputs((initialParams.get('search') || initialParams.get('q') || '').trim());
  const firstPagePromise = loadPage(1);
  const metaPromise = MBHelpers.fetchCatalogMeta().then(renderCategoryFilters).catch(() => renderCategoryFilters({ total: 0, categories: [] }));

  const hiddenSearch = document.getElementById('shop-search');
  if (hiddenSearch) hiddenSearch.addEventListener('input', refresh);
  ['sct-search', 'mcf-search'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); refresh(); } });
  });
  document.querySelectorAll('.js-market-search').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input');
    setAllSearchInputs((input && input.value || '').trim());
    syncUrl();
    loadPage(1);
  }));
  const sort = document.getElementById('shop-sort');
  if (sort) sort.addEventListener('change', () => loadPage(1));
  ['shop-price-min', 'shop-price-max'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.addEventListener('input', refresh);
  });
  const clear = document.getElementById('shop-clear-filters');
  if (clear) clear.addEventListener('click', clearFilters);
  addEventListener('pagehide', saveScroll);

  await Promise.allSettled([firstPagePromise, metaPromise]);
})();
