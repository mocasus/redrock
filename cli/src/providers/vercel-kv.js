/**
 * Vercel KV Provider — Redis-compatible REST API
 *
 * API surface: connect(config), get(key), set(key, value), delete(key)
 *
 * Env vars required:
 *   KV_REST_API_URL      — https://<store>.kv.vercel-storage.com
 *   KV_REST_API_TOKEN     — auth token
 *   KV_REST_API_READ_ONLY_TOKEN — read-only token
 *
 * API: https://vercel.com/docs/storage/vercel-kv/rest-api
 */

const https = require('https');
const http = require('http');

class VercelKV {
  /**
   * Factory: connect to Vercel KV with config or env vars.
   * @param {Object} config - { url, token, readOnlyToken }
   * @returns {VercelKV}
   */
  static connect(config = {}) {
    return new VercelKV({
      url: config.url || process.env.KV_REST_API_URL,
      token: config.token || process.env.KV_REST_API_TOKEN,
      readOnlyToken: config.readOnlyToken || process.env.KV_REST_API_READ_ONLY_TOKEN
    });
  }

  constructor(opts = {}) {
    this.url = opts.url || process.env.KV_REST_API_URL;
    this.token = opts.token || process.env.KV_REST_API_TOKEN;
    this.readOnlyToken = opts.readOnlyToken || process.env.KV_REST_API_READ_ONLY_TOKEN;
  }

  _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.url);
      const options = {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
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
      req.on('timeout', () => { req.destroy(); reject(new Error('KV request timeout')); });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  /** Set a key-value pair */
  async set(key, value, opts = {}) {
    const result = await this._request('POST', `/set/${key}`, {
      value: typeof value === 'string' ? value : JSON.stringify(value),
      ...(opts.ex && { ex: opts.ex }),
      ...(opts.nx && { nx: true })
    });
    return result;
  }

  /** Get a value by key */
  async get(key) {
    const result = await this._request('GET', `/get/${key}`);
    if (result.status === 200) {
      try { return JSON.parse(result.data.result); } catch { return result.data.result; }
    }
    return null;
  }

  /** Delete a key */
  async delete(key) {
    const result = await this._request('DELETE', `/del/${key}`);
    return result;
  }

  /** List keys matching a prefix */
  async list(prefix = '') {
    const result = await this._request('GET', `/list/${prefix}`);
    return result.data?.result || [];
  }

  /** Check connection */
  async ping() {
    try {
      const result = await this._request('GET', '/ping');
      return result.data?.result === 'PONG';
    } catch {
      return false;
    }
  }
}

module.exports = VercelKV;
