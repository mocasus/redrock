/**
 * Supabase Provider — PostgreSQL + REST API
 *
 * Env vars required:
 *   SUPABASE_URL      — https://<project>.supabase.co
 *   SUPABASE_KEY      — anon/service_role key
 *
 * API: https://supabase.com/docs/reference/javascript
 */

const https = require('https');

class Supabase {
  constructor(opts = {}) {
    this.url = opts.url || process.env.SUPABASE_URL;
    this.key = opts.key || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
  }

  _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`/rest/v1${path}`, this.url);
      const options = {
        method,
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          ...(method === 'GET' ? { Prefer: 'return=representation' } : {})
        },
        timeout: 10000
      };

      const req = https.request(url, options, (res) => {
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

  /** Insert rows */
  async insert(table, rows) {
    return this._request('POST', `/${table}`, Array.isArray(rows) ? rows : [rows]);
  }

  /** Select rows */
  async select(table, query = '*') {
    const qs = query === '*' ? '' : `?select=${encodeURIComponent(query)}`;
    return this._request('GET', `/${table}${qs}`);
  }

  /** Update rows */
  async update(table, match, data) {
    const qs = Object.entries(match)
      .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
      .join('&');
    return this._request('PATCH', `/${table}?${qs}`, data);
  }

  /** Delete rows */
  async delete(table, match) {
    const qs = Object.entries(match)
      .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
      .join('&');
    return this._request('DELETE', `/${table}?${qs}`);
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
