/**
 * Supabase Provider — PostgreSQL + REST API
 *
 * API surface: connect(config), get(key), set(key, value), delete(key)
 *
 * Key-value operations use a default table: redrock_kv (key TEXT PK, value JSONB)
 *
 * Env vars required:
 *   SUPABASE_URL      — https://<project>.supabase.co
 *   SUPABASE_KEY      — anon/service_role key
 *
 * API: https://supabase.com/docs/reference/javascript
 */

const https = require('https');

class Supabase {
  /**
   * Factory: connect to Supabase with config or env vars.
   * @param {Object} config - { url, key, kvTable }
   * @returns {Supabase}
   */
  static connect(config = {}) {
    return new Supabase({
      url: config.url || process.env.SUPABASE_URL,
      key: config.key || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY,
      kvTable: config.kvTable || 'redrock_kv'
    });
  }

  constructor(opts = {}) {
    this.url = opts.url || process.env.SUPABASE_URL;
    this.key = opts.key || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
    this.kvTable = opts.kvTable || 'redrock_kv';
  }

  _request(method, path, body = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(`/rest/v1${path}`, this.url);
      const options = {
        method,
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          ...extraHeaders
        },
        timeout: 10000
      };

      const module = url.protocol === 'https:' ? https : require('http');
      const req = module.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Supabase request timeout')); });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ── Core key-value API ──

  /** Get a value by key from the KV table */
  async get(key) {
    const result = await this._request(
      'GET',
      `/${this.kvTable}?key=eq.${encodeURIComponent(key)}&select=value&limit=1`,
      null,
      { Accept: 'application/json' }
    );
    if (result.status === 200 && Array.isArray(result.data) && result.data.length > 0) {
      return result.data[0].value;
    }
    return null;
  }

  /** Set a key-value pair. Upserts into the KV table. */
  async set(key, value) {
    // Try upsert via POST with Prefer: resolution=merge-duplicates
    const row = { key, value };
    const result = await this._request(
      'POST',
      `/${this.kvTable}`,
      row,
      {
        Prefer: 'resolution=merge-duplicates',
        Accept: 'application/json'
      }
    );
    // If the table doesn't have a PK constraint for merge, fall back to delete+insert
    if (result.status === 409 || result.status === 400) {
      await this.delete(key);
      return this._request(
        'POST',
        `/${this.kvTable}`,
        row,
        { Prefer: 'return=minimal', Accept: 'application/json' }
      );
    }
    return result;
  }

  /** Delete a key from the KV table */
  async delete(key) {
    return this._request(
      'DELETE',
      `/${this.kvTable}?key=eq.${encodeURIComponent(key)}`,
      null,
      { Accept: 'application/json' }
    );
  }

  // ── Direct table operations (advanced) ──

  /** Insert rows into any table */
  async insert(table, rows) {
    return this._request('POST', `/${table}`, Array.isArray(rows) ? rows : [rows]);
  }

  /** Select rows from any table */
  async select(table, query = '*') {
    const qs = query === '*' ? '' : `?select=${encodeURIComponent(query)}`;
    return this._request('GET', `/${table}${qs}`);
  }

  /** Update rows in any table */
  async update(table, match, data) {
    const qs = Object.entries(match)
      .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
      .join('&');
    return this._request('PATCH', `/${table}?${qs}`, data);
  }

  /** Raw SQL via REST (requires service_role key) */
  async sql(query) {
    return this._request('POST', '/rpc/exec_sql', { query });
  }

  /** Create the KV table if it doesn't exist */
  async initKVTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.kvTable} (
        key TEXT PRIMARY KEY,
        value JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    try {
      // Try via RPC first
      await this._request('POST', '/rpc/exec_sql', { query: sql });
    } catch {
      // Fallback: try direct insert to see if table exists
      try {
        await this._request('GET', `/${this.kvTable}?limit=0`);
      } catch {
        throw new Error(`KV table "${this.kvTable}" does not exist. Create it in the Supabase SQL editor:\n${sql}`);
      }
    }
    return true;
  }

  /** Check connection */
  async ping() {
    try {
      const result = await this._request('GET', '/');
      return result.status < 500;
    } catch {
      return false;
    }
  }
}

module.exports = Supabase;
