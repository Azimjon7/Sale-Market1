(function () {
  'use strict';

  const rootNew = document.getElementById('new-products');
  if (!rootNew) return;

  const isPilot = document.body.classList.contains('luxury-pilot');
  // Four desktop rows on the luxury homepage keep the first visit substantial
  // without changing the catalog's progressive loading behaviour.
  const BATCH_SIZE = isPilot ? 16 : 12;

  /* ── State ───────────────────────────────────────────────── */
  let allProducts     = [];
  let filteredProducts = [];
  let currentOffset   = 0;
  let isLoading       = false;
  let allLoaded       = false;
  let observer        = null;
  let sentinel        = null;

  /* ── Skeleton placeholders ───────────────────────────────── */
  function skeletonCards(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html +=
        '<div class="col-6 col-sm-6 col-md-4 col-lg-3">' +
        '<div class="sm-skeleton-card">' +
        '<div class="sm-skeleton sm-skeleton-img"></div>' +
        '<div class="sm-skeleton sm-skeleton-line"></div>' +
        '<div class="sm-skeleton sm-skeleton-line sm-skeleton-line--short"></div>' +
        '</div></div>';
    }
    return html;
  }

  /* ── Spinner keyframe (injected once) ────────────────────── */
  function ensureSpinKeyframe() {
    if (document.getElementById('hp-spin-style')) return;
    const style = document.createElement('style');
    style.id = 'hp-spin-style';
    style.textContent = '@keyframes hp-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  /* ── Loading indicator element ───────────────────────────── */
  function createLoadingIndicator() {
    const el = document.createElement('div');
    el.id = 'hp-loading-indicator';
    el.className = 'col-12';
    el.style.cssText = 'text-align:center;padding:24px 0;display:none;';
    el.innerHTML =
      '<span style="display:inline-flex;align-items:center;gap:8px;color:#888;font-size:14px;">' +
      '<svg width="20" height="20" viewBox="0 0 50 50" style="animation:hp-spin 0.8s linear infinite;" aria-hidden="true">' +
      '<circle cx="25" cy="25" r="20" fill="none" stroke="#ca1515" stroke-width="4" stroke-dasharray="80 20"/>' +
      '</svg>Yuklanmoqda...</span>';
    return el;
  }

  function createSentinel() {
    const el = document.createElement('div');
    el.id = 'hp-scroll-sentinel';
    el.style.cssText = 'height:1px;width:100%;';
    return el;
  }

  function showLoading(show) {
    const el = document.getElementById('hp-loading-indicator');
    if (el) el.style.display = show ? 'block' : 'none';
  }

  /* ── Append a batch of cards ─────────────────────────────── */
  function appendBatch(items) {
    const fragment = document.createDocumentFragment();
    items.forEach(p => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = MBHelpers.productCard(p, { showDescription: false });
      while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
    });

    const indicator = document.getElementById('hp-loading-indicator');
    const sentinelEl = document.getElementById('hp-scroll-sentinel');
    const ref = indicator || sentinelEl || null;
    if (ref) ref.parentNode.insertBefore(fragment, ref);
    else rootNew.appendChild(fragment);

    if (window.MBStore && MBStore.registerProducts) MBStore.registerProducts(items);
  }

  /* ── Infinite scroll: load next batch ───────────────────── */
  function loadNextBatch() {
    if (isLoading || allLoaded) return;
    const batch = filteredProducts.slice(currentOffset, currentOffset + BATCH_SIZE);
    if (!batch.length) {
      allLoaded = true;
      showLoading(false);
      if (observer && sentinel) observer.unobserve(sentinel);
      return;
    }

    isLoading = true;
    showLoading(true);

    setTimeout(() => {
      appendBatch(batch);
      currentOffset += batch.length;
      if (currentOffset >= filteredProducts.length) {
        allLoaded = true;
        if (observer && sentinel) observer.unobserve(sentinel);
      }
      isLoading = false;
      showLoading(false);
    }, 150);
  }

  /* ── Set up IntersectionObserver ─────────────────────────── */
  function setupObserver() {
    if (observer) { observer.disconnect(); observer = null; }
    sentinel = document.getElementById('hp-scroll-sentinel');
    if (!sentinel) return;

    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoading && !allLoaded) loadNextBatch();
      });
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
  }

  /* ── No-results empty state ──────────────────────────────── */
  function showEmptyState(query) {
    rootNew.innerHTML = '';
    const q = query ? MBSearch.normalizeText(query) : '';
    const msg   = q ? `"${q}" bo'yicha hech qanday mahsulot topilmadi.` : 'Hozircha mahsulot yo\'q.';
    const btnHtml = q
      ? '<button id="hp-clear-search" class="btn btn-primary" style="margin-top:12px;">Qidiruvni tozalash</button>'
      : '';
    rootNew.innerHTML =
      '<div class="col-12"><div class="empty-state" style="text-align:center;padding:40px 20px;">' +
      '<i class="fa fa-search" style="font-size:32px;color:#ccc;margin-bottom:12px;display:block;"></i>' +
      `<h5>Hech qanday mahsulot topilmadi</h5><p>${MBHelpers.escapeHtml(msg)}</p>${btnHtml}` +
      '</div></div>';
    const clearBtn = document.getElementById('hp-clear-search');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const headerInput = document.querySelector('.js-market-search input');
        if (headerInput) headerInput.value = '';
        setFilteredAndRender(allProducts);
      });
    }
  }

  /* ── Primary render: reset scroll state + draw first batch ─ */
  function renderInitial() {
    rootNew.innerHTML = '';

    const loadingEl = createLoadingIndicator();
    const sentinelEl = createSentinel();
    rootNew.appendChild(loadingEl);
    rootNew.appendChild(sentinelEl);

    currentOffset = 0;
    allLoaded     = false;
    isLoading     = false;

    if (!filteredProducts.length) {
      showEmptyState(currentQuery);
      return;
    }

    const firstBatch = filteredProducts.slice(0, BATCH_SIZE);
    appendBatch(firstBatch);
    currentOffset = firstBatch.length;

    if (currentOffset >= filteredProducts.length) {
      allLoaded = true;
    } else {
      setupObserver();
    }
  }

  /* ── Current search query tracker ───────────────────────── */
  let currentQuery = '';

  function setFilteredAndRender(list, query) {
    /* Release any open panel/scroll-lock before rendering */
    if (window.MBPanels) MBPanels.releaseAll();
    currentQuery     = query || '';
    const editorialIds=['prd_1784614920759','prd_1784614625228','prd_1783676009196','prd_1784613960253','prd_1784614834803','prd_1784614069126','prd_1784614150176','prd_1784615041900'];
    const selected=editorialIds.map(id=>list.find(p=>p.id===id)).filter(Boolean);
    filteredProducts = isPilot && !query ? [...selected,...list.filter(p=>!selected.includes(p))].slice(0,16) : list;
    renderInitial();
  }

  /* ── Category grid for homepage ──────────────────────────── */
  function renderCategories(list) {
    const grid = document.getElementById('category-grid');
    if (!grid) return;
    const cats = [...new Set(list.map(p => String(p.category || '').trim()).filter(Boolean))];
    if (!cats.length) return;
    const priority = isPilot ? ['Ustki kiyimlar','Sumkalar','Aksesuarlar','Oyoq kiyimlar','Shimlar','Jihozlar'] : ['Uy jihozlari', 'Oshxona', 'Go‘zallik', 'Ayollar kiyimi', 'Erkaklar kiyimi', 'Ayollar poyabzali', 'Sport', 'Avtomobil'];
    const ordered = priority.filter(cat => cats.includes(cat)).concat(cats.filter(cat => !priority.includes(cat)));
    grid.innerHTML = ordered.slice(0, 6).map(cat => {
      const picks={'Ustki kiyimlar':'prd_1784614920759','Sumkalar':'prd_1783676009196','Aksesuarlar':'prd_1784613960253','Oyoq kiyimlar':'prd_1784614069126','Shimlar':'prd_1784614834803','Jihozlar':'prd_1784613288226'};
      const sample = (isPilot&&list.find(p=>p.id===picks[cat])) || list.find(p => String(p.category || '') === cat);
      const img = (sample && (sample.image || (sample.images && sample.images[0]))) || 'img/placeholders/dodola-product.svg';
      return (
        `<a class="market-category" href="shop.html?category=${encodeURIComponent(cat)}">` +
        `<img src="${MBHelpers.escapeHtml(img)}" alt="${MBHelpers.escapeHtml(cat)}" loading="lazy">` +
        `<h5>${MBHelpers.escapeHtml(cat)}<span aria-hidden="true"> ↗</span></h5></a>`
      );
    }).join('');
  }


  function renderEditorial(list) {
    const e=MBHelpers.escapeHtml;
    const main=list.find(p=>p.id==='prd_1784614920759')||list.find(p=>/Briddy/i.test(p.name))||list[0];
    const side=list.find(p=>p.id==='prd_1784614625228')||list.find(p=>p!==main&&p.category===main.category)||list[1];
    function tile(p, label, cls) { if(!p)return ''; return '<a class="'+cls+'" href="product-details.html?id='+encodeURIComponent(p.id)+'"><img src="'+e(p.image)+'" alt="'+e(p.name)+'" width="600" height="720" loading="eager" fetchpriority="'+(cls==='lx-photo-link'?'high':'auto')+'"><div class="lx-product-caption"><small>'+label+'</small><strong>'+e(p.name.replace(/[\p{Extended_Pictographic}\uFE0F]/gu,''))+'</strong><span>'+MBHelpers.currency(p.price)+' <b aria-hidden="true">↗</b></span></div></a>'; }
    document.getElementById('luxury-main-photo').innerHTML=tile(main,'YUMSHOQ TEKSTURALAR','lx-photo-link');
    document.getElementById('luxury-side-photo').innerHTML=tile(side,'USLUBINGIZGA BIR DETAL','lx-side-link');
  }

  /* ── Init ────────────────────────────────────────────────── */
  async function init() {
    ensureSpinKeyframe();
    rootNew.innerHTML = skeletonCards(BATCH_SIZE);

    // Ensure engines are loaded
    async function ensureScript(src) {
      if (document.querySelector(`script[src="${src}"]`)) {
        await new Promise(r => setTimeout(r, 0));
        return;
      }
      return new Promise(r => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = r;
        document.body.appendChild(s);
      });
    }
    if (!window.MBSearch)  await ensureScript('js/search-engine.js');
    if (!window.MBHelpers) await ensureScript('js/helpers.js');

    try {
      const firstPage = await MBHelpers.fetchCatalogPage({ page: 1, limit: 24, sort: 'newest' });
      const editorialIds=['prd_1784614920759','prd_1784614625228','prd_1783676009196','prd_1784613960253','prd_1784614834803','prd_1784614069126','prd_1784614150176','prd_1784615041900'];
      const present = new Set(firstPage.products.map(product => String(product.id)));
      const editorial = await Promise.all(editorialIds.filter(id => !present.has(id)).map(id => MBHelpers.loadProductById(id).catch(() => null)));
      const seen = new Set();
      allProducts = [...editorial.filter(Boolean), ...firstPage.products].filter(product => {
        const id = String(product.id); if (seen.has(id)) return false; seen.add(id); return true;
      });
    } catch (e) {
      allProducts = [];
    }

    if (!allProducts.length) {
      rootNew.innerHTML = MBHelpers.emptyState('Admin paneldan birinchi mahsulotni qo\'shing.');
      return;
    }

    // Homepage always starts with the newest catalog additions.
    allProducts.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime() || 0;
      const tb = new Date(b.createdAt || 0).getTime() || 0;
      return tb - ta;
    });

    renderCategories(allProducts);
    if (isPilot) renderEditorial(allProducts);
    const featured=allProducts.find(p=>p.featured)||allProducts[0],slot=document.getElementById('hero-single-card');
    if(featured&&slot){const e=MBHelpers.escapeHtml;slot.innerHTML='<a class="d-featured" href="product-details.html?id='+encodeURIComponent(featured.id)+'"><img src="'+e(featured.image)+'" alt="'+e(featured.name)+'" width="240" height="240" fetchpriority="high"><div><small>KATALOGDAN TANLOV</small><strong>'+e(featured.name)+'</strong><b>'+MBHelpers.currency(featured.price)+'</b><em>Mahsulotni ko‘rish →</em></div></a>';}
    const hasSale=allProducts.some(p=>MBProductRules.discount(p).visible);document.getElementById('flash-sale').hidden=!hasSale;

    // Check if there's a search query in the URL (user came from another page via search)
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuery = (urlParams.get('search') || urlParams.get('q') || '').trim();
    if (urlQuery) {
      const results = MBSearch.searchProducts(allProducts, urlQuery);
      setFilteredAndRender(results, urlQuery);
    } else {
      setFilteredAndRender(allProducts, '');
    }

    // Wire header search form on homepage — filter in-place instead of navigating
    bindHeaderSearch();
  }

  /* ── Header search form wiring (homepage) ────────────────── */
  function bindHeaderSearch() {
    document.querySelectorAll('.js-market-search').forEach(form => {
      // Remove any previous submit listener from shared-header-init.js
      // by replacing the form's submit handler
      form.addEventListener('submit', e => {
        e.preventDefault();
        const input = form.querySelector('input');
        const q = (input && input.value || '').trim();

        if (!q) return;
        window.location.href = 'shop.html?search=' + encodeURIComponent(q);
      });

    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
