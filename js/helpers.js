window.MBHelpers = {
  escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  _productsCache: null,
  _productsPromise: null,
  _catalogPromises: new Map(),
  normalizeCategory(value) {
    const raw = String(value || "")
      .toLowerCase()
      .replace(/[’`']/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const map = {
      futbolkalar: "Futbolkalar",
      aksesuarlar: "Aksesuarlar",
      "ustki kiyimlar": "Ustki kiyimlar",
      shimlar: "Shimlar",
      "oyoq kiyimlar": "Oyoq kiyimlar",
      "bosh kiyimlar": "Bosh kiyimlar",
      mebel: "Mebel",
      furniture: "Mebel",
      "мебель": "Mebel",
    };

    return map[raw] || (value || "");
  },
  toList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      const raw = value.trim();
      if (!raw) return [];

      let splitter = /,\s*/;
      if (!raw.includes(",")) {
        splitter = /\s+va\s+/i;
      }
      if (!raw.includes(",") && !/\s+va\s+/i.test(raw)) {
        splitter = /\s+/;
      }

      const tokens = raw
        .split(splitter)
        .map((item) => item.trim())
        .filter(Boolean);

      const expanded = [];
      tokens.forEach((token) => {
        const range = token.match(/^(\d+)\s*[\-\u2010-\u2015\u2212]\s*(\d+)$/);
        if (range) {
          const start = Number(range[1]);
          const end = Number(range[2]);
          if (Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 30) {
            for (let n = start; n <= end; n += 1) expanded.push(String(n));
            return;
          }
        }

        const uzRange = token.match(/^(\d+)\s*dan\s*(\d+)\s*gacha$/i);
        if (uzRange) {
          const start = Number(uzRange[1]);
          const end = Number(uzRange[2]);
          if (Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 30) {
            for (let n = start; n <= end; n += 1) expanded.push(String(n));
            return;
          }
        }

        expanded.push(token);
      });

      return [...new Set(expanded)];
    }
    return [];
  },
  isGithubPages() {
    return /\.github\.io$/i.test(window.location.hostname);
  },
  apiUrl(path) {
    const rawPath = String(path || "");
    const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const base = String(window.MB_API_BASE || "").trim().replace(/\/+$/, "");
    if (!base) return normalizedPath;
    return `${base}${normalizedPath}`;
  },
  async fetchJson(url, options = {}) {
    const res = await fetch(url, { cache: "no-store", ...options });
    if (!res.ok) throw new Error(`Request failed: ${url} (${res.status})`);
    return res.json();
  },
  language() {
    try { return localStorage.getItem('dodola_language') === 'ru' ? 'ru' : 'uz'; } catch (_) { return 'uz'; }
  },
  catalogCacheKey(params = {}) {
    const query = new URLSearchParams();
    const localized = { ...params, lang: params.lang || this.language() };
    Object.keys(localized).sort().forEach(key => {
      const value = localized[key];
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    return `dodola:catalog:v2:${query.toString()}`;
  },
  readCatalogCache(params = {}, maxAge = 120000) {
    try {
      const raw = sessionStorage.getItem(this.catalogCacheKey(params));
      const entry = raw ? JSON.parse(raw) : null;
      if (!entry || !entry.data || Date.now() - Number(entry.savedAt || 0) > maxAge) return null;
      return entry.data;
    } catch (_) { return null; }
  },
  writeCatalogCache(params = {}, data) {
    try {
      const prefix = 'dodola:catalog:v2:';
      const keys = Object.keys(sessionStorage).filter(key => key.startsWith(prefix));
      if (keys.length > 24) keys.slice(0, keys.length - 24).forEach(key => sessionStorage.removeItem(key));
      sessionStorage.setItem(this.catalogCacheKey(params), JSON.stringify({ savedAt: Date.now(), data }));
    } catch (_) {}
  },
  async fetchCatalogPage(params = {}, options = {}) {
    const language = this.language();
    const localizedParams = { ...params, lang: language };
    const requestKey = this.catalogCacheKey(localizedParams);
    if (!options.signal && this._catalogPromises.has(requestKey)) return this._catalogPromises.get(requestKey);
    const request = (async () => {
    const query = new URLSearchParams();
    Object.entries(localizedParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const response = await fetch(this.apiUrl(`/api/products?${query}`), {
      cache: options.cache || 'default',
      signal: options.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    const data = await response.json();
    if (!data || !Array.isArray(data.products) || !data.meta) throw new Error('Catalog response is invalid');
    data.products = data.products.map(product => this.normalizeProduct(product));
    this.writeCatalogCache(localizedParams, data);
    return data;
    })();
    if (options.signal) return request;
    this._catalogPromises.set(requestKey, request);
    try { return await request; }
    finally { this._catalogPromises.delete(requestKey); }
  },
  async fetchCatalogMeta(options = {}) {
    const cacheKey = 'dodola:catalog:meta:v2';
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (!options.force && cached && Date.now() - Number(cached.savedAt || 0) < 300000) return cached.data;
    } catch (_) {}
    const response = await fetch(this.apiUrl('/api/catalog/meta'), { cache: 'default', signal: options.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Catalog metadata failed (${response.status})`);
    const data = await response.json();
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data })); } catch (_) {}
    return data;
  },
  resolveImagePath(value) {
    const path = String(value || "").trim();
    if (!path || /^\/?img\/placeholders\/product\.svg$/.test(path)) return "img/placeholders/dodola-product.svg";
    if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path;
    if (path.startsWith("/")) return path;

    const assetsBase = String(window.MB_ASSET_BASE || window.MB_API_BASE || "").trim().replace(/\/+$/, "");
    if (assetsBase && path.startsWith("uploads/")) return `${assetsBase}/${path}`;
    return path;
  },
  async loadProducts(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    if (!forceRefresh && Array.isArray(this._productsCache)) return this._productsCache;
    if (!forceRefresh && this._productsPromise) return this._productsPromise;

    const loadTask = (async () => {
      const language = this.language();
      const sources = [this.apiUrl(`/api/products?lang=${language}`)];

      for (const url of sources) {
        try {
          const data = await this.fetchJson(url);
          const list = (Array.isArray(data) ? data : []).map((product) => this.normalizeProduct(product));
          this._productsCache = list;
          return list;
        } catch (error) {}
      }

      this._productsCache = [];
      return [];
    })();

    this._productsPromise = loadTask.finally(() => {
      this._productsPromise = null;
    });
    return this._productsPromise;
  },
  async loadProductById(productId) {
    const id = String(productId || "").trim();
    if (!id) return null;

    const language = this.language();
    const apiProductUrl = this.apiUrl(`/api/products/${encodeURIComponent(id)}?lang=${language}`);
    try {
      const item = await this.fetchJson(apiProductUrl);
      if (item && typeof item === "object") return this.normalizeProduct(item);
    } catch (error) {}

    const list = await this.loadProducts();
    return list.find((item) => String(item.id) === id) || null;
  },
  normalizeProduct(product) {
    const images = this.toList(product.images).map((img) => this.resolveImagePath(img));
    if (product.image) images.unshift(this.resolveImagePath(product.image));
    const uniqueImages = [...new Set(images.filter(Boolean))];

    return {
      ...product,
      category: this.normalizeCategory(product.category),
      image: uniqueImages[0] || "img/placeholders/dodola-product.svg",
      images: uniqueImages.length ? uniqueImages : ["img/placeholders/dodola-product.svg"],
      description: window.MBProductRules.cleanDescription(product.description || product.desc || ""),
      sizes: window.MBProductRules.options(product.sizes, 'size'),
      colors: window.MBProductRules.options(product.colors, 'color'),
      stock: Math.max(0, Number(product.stock ?? 999) || 0),
      label: product.label || product.badge || "",
    };
  },
  currency(value) {
    const num = Number(value || 0);
    return num.toLocaleString("uz-UZ") + " so'm";
  },
  productCard(product, options = {}) {
    const normalized = this.normalizeProduct(product);
    const showDescription = options.showDescription !== false;
    const image = normalized.images[0];
    const availability = window.MBProductRules.availability(normalized);
    const inStock = availability.purchasable;
    const discountInfo = window.MBProductRules.discount(normalized);
    const rawLabel = String(normalized.label || "").trim();
    const badges = [];
    if (rawLabel) {
      const newLike = /(^|\s)(yangi|new)(\s|$)/i.test(rawLabel);
      badges.push(`<span class="sm-card-badge ${newLike ? "sm-card-badge--new" : "sm-card-badge--info"}">${this.escapeHtml(rawLabel)}</span>`);
    }
    if (discountInfo.visible) {
      badges.push(`<span class="sm-card-badge sm-card-badge--discount">-${discountInfo.percent}%</span>`);
    }
    const labelHtml = badges.length ? `<div class="sm-card-badges">${badges.join("")}</div>` : "";
    const oldPrice = discountInfo.visible ? `<span class="product__oldprice">${this.currency(discountInfo.oldPrice)}</span>` : "";
    const descriptionHtml = showDescription ? `<p>${this.escapeHtml(normalized.description)}</p>` : "";
    const action = inStock ? `<button class="link-btn js-add-card" type="button" data-id="${this.escapeHtml(normalized.id)}">Savatga</button>` : `<span>Stokda yo'q</span>`;

    const priority = Boolean(options.priority);
    const loading = priority ? 'eager' : 'lazy';
    const fetchPriority = priority ? 'high' : 'auto';
    return `
      <div class="col-6 col-sm-6 col-md-4 col-lg-3">
        <div class="product__item ${inStock ? "" : "product__item--soldout"}">
          <a href="/p/${encodeURIComponent(normalized.id)}" class="product__item__pic">
            <img class="d-catalog-image" src="${this.escapeHtml(image)}" alt="${this.escapeHtml(normalized.name || 'Mahsulot')}" loading="${loading}" fetchpriority="${fetchPriority}" decoding="async" sizes="(max-width: 768px) 46vw, (max-width: 1399px) 23vw, 18vw" width="400" height="400">
            ${labelHtml}
          </a>
          <button type="button" class="dodola-favorite" data-favorite="${this.escapeHtml(normalized.id)}" aria-label="Saralanganlar" aria-pressed="false">♡</button>
          <div class="product__item__text">
            ${normalized.sku ? `<span class="sm-product-sku">${this.escapeHtml(normalized.sku)}</span>` : ""}
            <h6><a href="/p/${encodeURIComponent(normalized.id)}">${this.escapeHtml(normalized.name || "Mahsulot")}</a></h6>
            ${descriptionHtml}
            <div class="product__price">${this.currency(normalized.price)} ${oldPrice}</div>
            <div class="product__links" ${inStock ? `data-cart-control data-product-id="${this.escapeHtml(normalized.id)}"` : ''}>
              ${action}
            </div>
          </div>
        </div>
      </div>`;
  },
  emptyState(message) {
    return `<div class="col-12"><div class="empty-state"><img src="img/placeholders/dodola-product.svg" alt="placeholder"><h5>Hozircha mahsulot yo'q</h5><p>${message}</p></div></div>`;
  },
};

(function installCatalogPrefetch() {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  let started = false;
  const prefetch = () => {
    if (started || document.getElementById('shop-grid')) return;
    started = true;
    const params = { page: 1, limit: 24, sort: 'newest' };
    if (!window.MBHelpers.readCatalogCache(params)) {
      window.MBHelpers.fetchCatalogPage(params).catch(() => { started = false; });
    }
    window.MBHelpers.fetchCatalogMeta().catch(() => {});
  };
  document.addEventListener('pointerover', event => {
    const link = event.target.closest && event.target.closest('a[href*="shop.html"]');
    if (link) prefetch();
  }, { passive: true, once: false });
  document.addEventListener('touchstart', event => {
    const link = event.target.closest && event.target.closest('a[href*="shop.html"]');
    if (link) prefetch();
  }, { passive: true, once: false });
})();

