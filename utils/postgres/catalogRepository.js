'use strict';
const crypto = require('crypto');
const { withTransaction } = require('./pool');
const { cyrillicMap, getSearchTerms } = require('../../js/search-engine');
const sqlLiteral = value => `'${String(value).replace(/'/g, "''")}'`;
// Constants come from the browser's search engine; user input is always bound.
// Filtering in PostgreSQL avoids transferring the full catalog for each search.
function searchExpression() {
  const fields = ['name','sku','description','category'].map(key => `COALESCE(p.${key},'')`);
  for (const key of ['title','subcategory','brand','shortDescription','color','colors','sizes','tags','keywords','size','tag']) {
    fields.push(`COALESCE(p.legacy_payload->>${sqlLiteral(key)},'')`);
  }
  let expression = `lower(${fields.join(" || ' ' || ")})`;
  const singles = Object.entries(cyrillicMap).filter(([, value]) => value.length === 1);
  const from = singles.map(([key]) => key).join('') + 'ʻʼ‘’`´';
  const to = singles.map(([, value]) => value).join('') + "''''''";
  expression = `translate(${expression},${sqlLiteral(from)},${sqlLiteral(to)})`;
  for (const [key, value] of Object.entries(cyrillicMap).filter(([, value]) => value.length !== 1)) {
    expression = `replace(${expression},${sqlLiteral(key)},${sqlLiteral(value)})`;
  }
  return `regexp_replace(${expression},'\\s+',' ','g')`;
}
const SEARCH_EXPRESSION = searchExpression();
const json = value => JSON.stringify(value == null ? null : value);
const variants = value => Array.isArray(value) ? value.map(String).map(v => v.trim()).filter(Boolean)
  : String(value || '').split(',').map(v => v.trim()).filter(Boolean);

async function replaceVariants(client, productId, input) {
  await client.query('DELETE FROM product_variants WHERE product_id=$1', [productId]);
  for (const [type, values] of [['color', variants(input.colors)], ['size', variants(input.sizes)]]) {
    for (let index = 0; index < values.length; index += 1) {
      await client.query(`INSERT INTO product_variants (product_id,variant_type,value,source_index,legacy_payload)
        VALUES ($1,$2,$3,$4,$5)`, [productId, type, values[index], index, json(values[index])]);
    }
  }
}

class PostgresCatalogRepository {
  constructor(pool) { this.pool = pool; }

  static productSelect() {
    return `p.*,i.product_id AS inventory_product_id,i.available,i.reserved,i.sold,i.returned,
      i.low_stock_threshold,i.inventory_version,i.initialized_at`;
  }
  static mapProduct(row) {
    if (!row) return null;
    const payload = { ...(row.legacy_payload || {}), id: row.id, sku: row.sku, name: row.name, price: Number(row.price),
      desc: row.description, category: row.category, oldPrice: row.old_price == null ? null : Number(row.old_price),
      _inventoryMode: row.inventory_mode, _acceptsMTO: row.accepts_mto, _productionDays: row.production_days,
      image: row.primary_image, images: row.image_paths || [] };
    if (row.inventory_product_id) Object.assign(payload, { inventoryManaged: true, inventoryVersion: Number(row.inventory_version),
      inventoryInitializedAt: row.initialized_at, available: Number(row.available), reserved: Number(row.reserved), sold: Number(row.sold),
      returned: Number(row.returned), lowStockThreshold: Number(row.low_stock_threshold), stock: Number(row.available) });
    return payload;
  }

  async listProducts(search = '') {
    const term = String(search || '').trim();
    const select = PostgresCatalogRepository.productSelect();
    const terms = getSearchTerms(term).map(value => `%${value.replace(/[\\%_]/g, '\\$&')}%`);
    const result = term ? await this.pool.query(`SELECT ${select}
      FROM products p LEFT JOIN inventory_levels i ON i.product_id=p.id
      WHERE p.deleted_at IS NULL AND (${terms.map((_, index) => `${SEARCH_EXPRESSION} LIKE $${index + 1}`).join(' OR ') || 'false'}) ORDER BY p.name,p.id`, terms)
      : await this.pool.query(`SELECT ${select} FROM products p LEFT JOIN inventory_levels i ON i.product_id=p.id
        WHERE p.deleted_at IS NULL ORDER BY p.name,p.id`);
    return result.rows.map(PostgresCatalogRepository.mapProduct);
  }

  async listProductsPage(options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 24));
    const params = [];
    const clauses = ['p.deleted_at IS NULL'];
    const push = value => { params.push(value); return `$${params.length}`; };
    const term = String(options.search || '').trim();
    const terms = getSearchTerms(term).map(value => `%${value.replace(/[\\%_]/g, '\\$&')}%`);
    if (terms.length) {
      const translatedIds = Array.isArray(options.searchIds) ? [...new Set(options.searchIds.map(String).filter(Boolean))] : [];
      const translatedClause = translatedIds.length ? `p.id=ANY(${push(translatedIds)}::text[])` : '';
      clauses.push(`(${[...terms.map(value => `${SEARCH_EXPRESSION} LIKE ${push(value)}`), translatedClause].filter(Boolean).join(' OR ')})`);
    }
    if (options.category) clauses.push(`lower(p.category)=lower(${push(String(options.category).trim())})`);
    if (Number.isFinite(Number(options.minPrice))) clauses.push(`p.price>=${push(Number(options.minPrice))}`);
    if (Number.isFinite(Number(options.maxPrice))) clauses.push(`p.price<=${push(Number(options.maxPrice))}`);
    if (options.sale) clauses.push('p.old_price>p.price AND p.price>0');

    const sortMap = {
      'price-low': 'p.price ASC,p.id ASC', price_asc: 'p.price ASC,p.id ASC',
      'price-high': 'p.price DESC,p.id ASC', price_desc: 'p.price DESC,p.id ASC',
      oldest: 'p.created_at ASC NULLS LAST,p.id ASC',
      'most-reviewed': 'review_count DESC,p.created_at DESC NULLS LAST,p.id ASC',
      most_reviewed: 'review_count DESC,p.created_at DESC NULLS LAST,p.id ASC',
      newest: 'p.created_at DESC NULLS LAST,p.id ASC',
    };
    const sort = String(options.sort || 'newest');
    const orderBy = sortMap[sort] || sortMap.newest;
    const reviewsNeeded = sort === 'most-reviewed' || sort === 'most_reviewed';
    const reviewSelect = reviewsNeeded ? 'COALESCE(rv.review_count,0)::integer' : '0::integer';
    const reviewJoin = reviewsNeeded
      ? 'LEFT JOIN (SELECT product_id,count(*)::integer AS review_count FROM reviews GROUP BY product_id) rv ON rv.product_id=p.id'
      : '';
    const where = clauses.join(' AND ');
    const queryParams = [...params, limit, (page - 1) * limit];
    const select = PostgresCatalogRepository.productSelect();
    const [countResult, result] = await Promise.all([
      this.pool.query(`SELECT count(*) AS value FROM products p WHERE ${where}`, params),
      this.pool.query(`SELECT ${select},${reviewSelect} AS review_count
        FROM products p LEFT JOIN inventory_levels i ON i.product_id=p.id ${reviewJoin}
        WHERE ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, queryParams),
    ]);
    const count = Number(countResult.rows[0].value);
    const pages = Math.max(1, Math.ceil(count / limit));
    return { products: result.rows.map(PostgresCatalogRepository.mapProduct), meta: { total: count, page, limit, pages } };
  }

  async catalogFacets() {
    const [totalResult, categoryResult] = await Promise.all([
      this.pool.query('SELECT count(*) AS value FROM products WHERE deleted_at IS NULL'),
      this.pool.query(`SELECT category AS name,count(*)::integer AS count FROM products
        WHERE deleted_at IS NULL AND category IS NOT NULL AND category<>''
        GROUP BY category ORDER BY count DESC,name ASC`),
    ]);
    return {
      total: Number(totalResult.rows[0].value),
      categories: categoryResult.rows.map(row => ({ name: row.name, count: Number(row.count) })),
    };
  }

  async getProduct(id, options = {}) {
    const select = PostgresCatalogRepository.productSelect();
    const deleted = options.includeDeleted ? '' : 'AND p.deleted_at IS NULL';
    const result = await this.pool.query(`SELECT ${select} FROM products p LEFT JOIN inventory_levels i ON i.product_id=p.id
      WHERE p.id=$1 ${deleted}`, [String(id)]);
    return PostgresCatalogRepository.mapProduct(result.rows[0]);
  }

  async hasPublicImageReference(relativePath) {
    const normalized = String(relativePath).replace(/^\/+/, '');
    const result = await this.pool.query(`SELECT 1 FROM products
      WHERE deleted_at IS NULL AND (primary_image IN ($1,$2) OR image_paths @> $3::jsonb OR image_paths @> $4::jsonb)
      LIMIT 1`, [normalized, `/${normalized}`, json([normalized]), json([`/${normalized}`])]);
    return result.rowCount > 0;
  }

  async createProduct(input) {
    return withTransaction(this.pool, async client => {
      const next = (await client.query("SELECT nextval('product_sku_sequence') AS value")).rows[0].value;
      const sku = `DOD-${String(next).padStart(4, '0')}`, id = input.id || `prd_${crypto.randomUUID()}`, createdAt = input.createdAt || new Date();
      const payload = { ...input, id, sku, createdAt: new Date(createdAt).toISOString() };
      await client.query(`INSERT INTO products (id,sku,name,description,category,price,old_price,inventory_mode,accepts_mto,production_days,primary_image,image_paths,tags,legacy_payload,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`, [id, sku, input.name, input.desc || '', input.category || null, Number(input.price || 0),
        input.oldPrice == null ? null : Number(input.oldPrice), input._inventoryMode || 'standard', Boolean(input._acceptsMTO), input._productionDays || null, input.image || null,
        json(input.images || []), json(input.tags || []), json(payload), createdAt]);
      await replaceVariants(client, id, payload);
      if (input.inventoryManaged) await client.query(`INSERT INTO inventory_levels (product_id,available,reserved,sold,returned,low_stock_threshold,inventory_version,initialized_at)
        VALUES ($1,$2,0,0,0,$3,1,$4)`, [id, Number(input.available || 0), Number(input.lowStockThreshold || 5), input.inventoryInitializedAt || createdAt]);
      return input.inventoryManaged ? { ...payload, inventoryManaged: true, inventoryVersion: 1,
        available: Number(input.available || 0), reserved: 0, sold: 0, returned: 0,
        lowStockThreshold: Number(input.lowStockThreshold || 5), stock: Number(input.available || 0) } : payload;
    });
  }

  async updateProduct(id, changes) {
    const updated = await withTransaction(this.pool, async client => {
      const current = (await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [String(id)])).rows[0];
      if (!current) return null;
      const protectedFields = new Set(['id','sku','available','reserved','sold','returned','inventoryManaged','inventoryVersion','stock','stockHistory']);
      const safe = Object.fromEntries(Object.entries(changes || {}).filter(([key]) => !protectedFields.has(key)));
      const payload = { ...current.legacy_payload, ...safe, id: current.id, sku: current.sku };
      await client.query(`UPDATE products SET name=$2,description=$3,category=$4,price=$5,old_price=$6,inventory_mode=$7,accepts_mto=$8,
        production_days=$9,primary_image=$10,image_paths=$11,tags=$12,legacy_payload=$13,updated_at=now() WHERE id=$1`, [current.id,
        payload.name || current.name, payload.desc || '', payload.category || null, Number(payload.price || 0), payload.oldPrice == null ? null : Number(payload.oldPrice),
        payload._inventoryMode || current.inventory_mode, Boolean(payload._acceptsMTO), payload._productionDays || null, payload.image || null,
        json(payload.images || []), json(payload.tags || []), json(payload)]);
      await replaceVariants(client, current.id, payload);
      return payload;
    });
    return updated ? this.getProduct(id) : null;
  }

  async deleteProduct(id) {
    const result = await this.pool.query(`UPDATE products SET deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL AND NOT EXISTS (
      SELECT 1 FROM inventory_reservations WHERE product_id=$1 AND state IN ('reserved','committed'))`, [String(id)]);
    return result.rowCount === 1;
  }

  async adjustStock(id, change, reason, actor) {
    return withTransaction(this.pool, async client => {
      const level = (await client.query(`SELECT i.*,p.sku FROM inventory_levels i JOIN products p ON p.id=i.product_id
        WHERE i.product_id=$1 AND p.deleted_at IS NULL FOR UPDATE`, [String(id)])).rows[0];
      if (!level) return null;
      const amount = Number(change);
      if (!Number.isInteger(amount) || amount === 0 || Number(level.available) + amount < 0) {
        throw Object.assign(new Error("Ombor o‘zgarishi yaroqsiz."), { code: 'INVALID_STOCK_CHANGE' });
      }
      const before = Number(level.available), after = before + amount;
      await client.query('UPDATE inventory_levels SET available=$2,updated_at=now() WHERE product_id=$1', [id, after]);
      const movement = { id: `mov_${crypto.randomUUID()}`, productId: String(id), type: 'manual_adjustment', change: amount,
        oldBalance: before, newBalance: after, reason: String(reason || ''), actor: String(actor || 'admin'), createdAt: new Date().toISOString() };
      await client.query(`INSERT INTO inventory_movements (id,product_id,movement_type,quantity_change,old_balance,new_balance,reason,actor,occurred_at,legacy_payload)
        VALUES ($1,$2,'manual_adjustment',$3,$4,$5,$6,$7,$8,$9)`, [movement.id, id, amount, before, after, movement.reason, movement.actor, movement.createdAt, json(movement)]);
      return { inventory: { productId: String(id), sku: level.sku, available: after, reserved: Number(level.reserved), sold: Number(level.sold),
        returned: Number(level.returned), lowStockThreshold: Number(level.low_stock_threshold), isLowStock: after <= Number(level.low_stock_threshold) }, movement };
    });
  }

  async stockHistory(id, filters = {}) {
    const product = await this.getProduct(id);
    if (!product || !product.inventoryManaged) return null;
    const params = [String(id)], clauses = ['product_id=$1'];
    if (filters.type) { params.push(String(filters.type)); clauses.push(`movement_type=$${params.length}`); }
    if (filters.startDate) { params.push(filters.startDate); clauses.push(`occurred_at >= $${params.length}`); }
    if (filters.endDate) { params.push(filters.endDate); clauses.push(`occurred_at <= $${params.length}`); }
    const result = await this.pool.query(`SELECT id,movement_type AS type,quantity_change AS change,old_balance AS "oldBalance",
      new_balance AS "newBalance",reason,actor,occurred_at AS timestamp,order_id AS "orderId"
      FROM inventory_movements WHERE ${clauses.join(' AND ')} ORDER BY occurred_at DESC,id DESC`, params);
    return { product, history: result.rows };
  }
}
module.exports = { PostgresCatalogRepository };
