'use strict';
const crypto = require('crypto');
const { withTransaction } = require('./pool');
const json = value => JSON.stringify(value == null ? null : value);

class PostgresCustomerRepository {
  constructor(pool) { this.pool = pool; }
  map(row) {
    if (!row) return null;
    return { ...(row.legacy_payload || {}), id: row.id, firstName: row.first_name, lastName: row.last_name, phone: row.phone,
      email: row.email, passwordHash: row.password_hash, phoneVerified: row.phone_verified,
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at).toISOString() : null,
      email_verified_at: row.email_verified_at,
      sessionVersion: Number(row.session_version), createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(), addresses: row.addresses || [] };
  }
  async #find(sql, value) {
    const row = (await this.pool.query(`${sql} FROM customers c WHERE ${value.clause}`, value.params)).rows[0];
    if (row) row.addresses = (await this.pool.query(`SELECT id,label,address,legacy_payload FROM customer_addresses
      WHERE customer_id=$1 ORDER BY source_index`, [row.id])).rows.map(item => ({ ...(item.legacy_payload || {}), id: item.id, label: item.label, address: item.address }));
    return this.map(row);
  }
  async findById(id) { return this.#find('SELECT c.*', { clause: 'c.id=$1', params: [id] }); }
  async findByPhone(phone) { return this.#find('SELECT c.*', { clause: 'c.phone=$1', params: [phone] }); }
  async findByEmail(email) { return this.#find('SELECT c.*', { clause: 'lower(c.email)=lower($1)', params: [email] }); }

  async createCustomer(input) {
    const id = input.id || `cus_${crypto.randomUUID()}`, now = input.createdAt || new Date();
    const payload = { ...input, id };
    const result = await this.pool.query(`INSERT INTO customers (id,first_name,last_name,phone,email,password_hash,phone_verified,email_verified_at,session_version,legacy_payload,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,false,NULL,1,$7,$8,$8) RETURNING *`, [id, input.firstName, input.lastName, input.phone, input.email.toLowerCase(), input.passwordHash, json(payload), now]);
    return this.map(result.rows[0]);
  }

  async issueToken(input) {
    const id = input.id || crypto.randomUUID();
    return withTransaction(this.pool, async client => {
      await client.query(`UPDATE auth_tokens SET used_at=now() WHERE customer_id=$1 AND token_type=$2 AND used_at IS NULL`, [input.customerId, input.type]);
      await client.query(`INSERT INTO auth_tokens (id,customer_id,token_type,token_hash,expires_at,used_at,created_at,legacy_payload)
        VALUES ($1,$2,$3,$4,$5,NULL,now(),$6)`, [id, input.customerId, input.type, input.tokenHash, input.expiresAt, json({ id, customerId: input.customerId, type: input.type })]);
      return id;
    });
  }

  async hasRecentToken(customerId, type, since) {
    const result = await this.pool.query(`SELECT 1 FROM auth_tokens WHERE customer_id=$1 AND token_type=$2 AND used_at IS NULL AND created_at >= $3 LIMIT 1`,
      [customerId, type, since]);
    return result.rowCount > 0;
  }

  async invalidateIssuedToken(customerId, type, tokenHash, accepted) {
    await this.pool.query(`UPDATE auth_tokens SET used_at=now() WHERE customer_id=$1 AND token_type=$2 AND used_at IS NULL
      AND (($4::boolean=false AND token_hash=$3) OR ($4::boolean=true AND token_hash<>$3))`, [customerId, type, tokenHash, Boolean(accepted)]);
  }

  async consumeEmailVerification(tokenHash) {
    return withTransaction(this.pool, async client => {
      const token = (await client.query(`UPDATE auth_tokens SET used_at=now() WHERE token_hash=$1 AND token_type='verify_email'
        AND used_at IS NULL AND expires_at > now() RETURNING customer_id`, [tokenHash])).rows[0];
      if (!token) return false;
      await client.query('UPDATE customers SET email_verified_at=coalesce(email_verified_at,now()),updated_at=now() WHERE id=$1', [token.customer_id]);
      return true;
    });
  }

  async consumePasswordReset(tokenHash, passwordHash) {
    return withTransaction(this.pool, async client => {
      const token = (await client.query(`UPDATE auth_tokens SET used_at=now() WHERE token_hash=$1 AND token_type='reset_password'
        AND used_at IS NULL AND expires_at > now() RETURNING customer_id`, [tokenHash])).rows[0];
      if (!token) return false;
      const updated = await client.query('UPDATE customers SET password_hash=$2,session_version=session_version+1,updated_at=now() WHERE id=$1 AND email_verified_at IS NOT NULL', [token.customer_id, passwordHash]);
      if (!updated.rowCount) throw Object.assign(new Error('Tasdiqlangan mijoz topilmadi.'), { code: 'CUSTOMER_NOT_VERIFIED' });
      await client.query('DELETE FROM customer_sessions WHERE customer_id=$1', [token.customer_id]);
      return true;
    });
  }

  async updateProfile(id, changes, expected=null) {
    await withTransaction(this.pool,async client=>{
      const raw=(await client.query('SELECT * FROM customers WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!raw)throw Object.assign(new Error('Mijoz topilmadi.'),{status:404});
      const current=this.map(raw),firstName=changes.firstName??current.firstName,lastName=changes.lastName??current.lastName,phone=changes.phone??current.phone,email=changes.email??current.email;
      if(expected&&(current.phone!==expected.phone||current.email!==expected.email))throw Object.assign(new Error('Ma’lumotlar o‘zgargan. Sahifani yangilang.'),{status:409});
      const emailChanged=email!==current.email,phoneChanged=phone!==current.phone;
      const payload={...current,...changes};delete payload.passwordHash;
      await client.query('UPDATE customers SET first_name=$2,last_name=$3,phone=$4,email=$5,phone_verified=$6,email_verified_at=$7,legacy_payload=$8,updated_at=now() WHERE id=$1',[id,firstName,lastName,phone,email,phoneChanged?false:raw.phone_verified,emailChanged?null:raw.email_verified_at,json(payload)]);
      if(emailChanged)await client.query('UPDATE auth_tokens SET used_at=now() WHERE customer_id=$1 AND used_at IS NULL',[id]);
    });
    return this.findById(id);
  }

  async putAddress(customerId, address) {
    return withTransaction(this.pool, async client => {
      await client.query('SELECT id FROM customers WHERE id=$1 FOR UPDATE',[customerId]);
      const existing = (await client.query('SELECT source_index,legacy_payload FROM customer_addresses WHERE id=$1 AND customer_id=$2 FOR UPDATE', [address.id, customerId])).rows[0];
      address={...address,isPrimary:existing?.legacy_payload?.isPrimary===true};
      const sourceIndex = existing ? Number(existing.source_index) : Number((await client.query('SELECT coalesce(max(source_index),-1)+1 AS value FROM customer_addresses WHERE customer_id=$1', [customerId])).rows[0].value);
      await client.query(`INSERT INTO customer_addresses (id,customer_id,label,address,source_index,legacy_payload) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,address=EXCLUDED.address,legacy_payload=EXCLUDED.legacy_payload
        WHERE customer_addresses.customer_id=EXCLUDED.customer_id`, [address.id, customerId, address.label, address.address, sourceIndex, json(address)]);
      return (await client.query(`SELECT id,label,address,legacy_payload FROM customer_addresses WHERE customer_id=$1 ORDER BY source_index`, [customerId])).rows
        .map(row => ({ ...(row.legacy_payload || {}), id: row.id, label: row.label, address: row.address }));
    });
  }

  async setPrimaryAddress(customerId,addressId){
    return withTransaction(this.pool,async client=>{
      await client.query('SELECT id FROM customers WHERE id=$1 FOR UPDATE',[customerId]);
      const rows=(await client.query('SELECT id,label,address,legacy_payload FROM customer_addresses WHERE customer_id=$1 ORDER BY source_index',[customerId])).rows;
      if(!rows.some(r=>r.id===addressId))throw Object.assign(new Error('Manzil topilmadi.'),{status:404});
      for(const row of rows){row.legacy_payload={...(row.legacy_payload||{}),isPrimary:row.id===addressId};await client.query('UPDATE customer_addresses SET legacy_payload=$2 WHERE id=$1 AND customer_id=$3',[row.id,json(row.legacy_payload),customerId]);}
      return rows.map(r=>({...r.legacy_payload,id:r.id,label:r.label,address:r.address}));
    });
  }

  async deleteAddress(customerId, addressId) {
    await this.pool.query('DELETE FROM customer_addresses WHERE id=$1 AND customer_id=$2', [addressId, customerId]);
    return (await this.pool.query(`SELECT id,label,address,legacy_payload FROM customer_addresses WHERE customer_id=$1 ORDER BY source_index`, [customerId])).rows
      .map(row => ({ ...(row.legacy_payload || {}), id: row.id, label: row.label, address: row.address }));
  }

  async changePassword(id, passwordHash) {
    return withTransaction(this.pool, async client => {
      const result = await client.query('UPDATE customers SET password_hash=$2,session_version=session_version+1,updated_at=now() WHERE id=$1', [id, passwordHash]);
      if (!result.rowCount) return false;
      await client.query('DELETE FROM customer_sessions WHERE customer_id=$1', [id]);
      return true;
    });
  }

  async listOrders(customerId) {
    const orders = await this.pool.query(`SELECT id,public_order_number AS "orderNumber",delivery_address AS address,total,status,confirmed_at AS "confirmedAt",payment_type AS "paymentType",payment_status AS "paymentStatus",legacy_payload->>'paymentPreference' AS "paymentPreference",created_at AS "createdAt"
      FROM orders WHERE customer_id=$1 ORDER BY created_at DESC`, [customerId]);
    for (const order of orders.rows) {
      order.items = (await this.pool.query(`SELECT oi.legacy_payload,coalesce(oi.source_product_id,oi.product_id) AS product_id,oi.sku,oi.product_name,oi.color,oi.size,oi.quantity,oi.unit_price,p.primary_image AS image
        FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1 ORDER BY oi.source_index`, [order.id])).rows.map(row => ({ ...(row.legacy_payload || {}), productId: row.product_id,
          sku: row.sku, name: row.product_name, image: row.legacy_payload?.image || row.image || null, color: row.color, size: row.size, qty: Number(row.quantity), price: Number(row.unit_price) }));
    }
    return orders.rows;
  }
}
module.exports = { PostgresCustomerRepository };
