/**
 * Firebase Firestore Provider — NoSQL document database
 *
 * API surface: connect(config), get(key), set(key, value), delete(key)
 *
 * Key-value operations use a default collection: redrock_kv (doc id = key)
 *
 * Env vars required:
 *   FIREBASE_PROJECT_ID     — GCP project ID
 *   FIREBASE_CLIENT_EMAIL   — service account email
 *   FIREBASE_PRIVATE_KEY    — service account private key
 *
 * REST API: https://firebase.google.com/docs/firestore/reference/rest
 */

const https = require('https');

class Firebase {
  /**
   * Factory: connect to Firebase Firestore with config or env vars.
   * @param {Object} config - { projectId, clientEmail, privateKey, kvCollection }
   * @returns {Firebase}
   */
  static connect(config = {}) {
    return new Firebase({
      projectId: config.projectId || process.env.FIREBASE_PROJECT_ID,
      clientEmail: config.clientEmail || process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: config.privateKey || process.env.FIREBASE_PRIVATE_KEY,
      kvCollection: config.kvCollection || 'redrock_kv'
    });
  }

  constructor(opts = {}) {
    this.projectId = opts.projectId || process.env.FIREBASE_PROJECT_ID;
    this.clientEmail = opts.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
    this.privateKey = opts.privateKey || process.env.FIREBASE_PRIVATE_KEY;
    this.kvCollection = opts.kvCollection || 'redrock_kv';
    this._accessToken = null;
    this._tokenExpiry = 0;
  }

  async _getAccessToken() {
    if (this._accessToken && Date.now() < this._tokenExpiry) {
      return this._accessToken;
    }

    const jwt = await this._signJWT();
    const result = await this._post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    });

    this._accessToken = result.access_token;
    this._tokenExpiry = Date.now() + (result.expires_in - 60) * 1000;
    return this._accessToken;
  }

  async _signJWT() {
    const crypto = require('crypto');
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: this.clientEmail,
      sub: this.clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/datastore'
    };

    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const toSign = `${b64(header)}.${b64(claim)}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(toSign);
    const sig = signer.sign(this.privateKey, 'base64url');
    return `${toSign}.${sig}`;
  }

  _post(url, body) {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const data = JSON.stringify(body);
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 10000
      };

      const req = https.request(u, options, (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch { reject(new Error(d)); }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async _firestore(method, path, body = null) {
    const token = await this._getAccessToken();
    return new Promise((resolve, reject) => {
      const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents${path}`;
      const u = new URL(url);
      const options = {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 10000
      };

      const req = https.request(u, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ── Core key-value API ──

  /** Get a value by key from the KV collection */
  async get(key) {
    const result = await this._firestore('GET', `/${this.kvCollection}/${key}`);
    if (result.status === 200 && result.data?.fields) {
      return this._fromFirestoreValue(result.data.fields);
    }
    return null;
  }

  /** Set a key-value pair. Creates or overwrites document in KV collection. */
  async set(key, value) {
    return this._firestore('PATCH', `/${this.kvCollection}/${key}`, {
      fields: {
        key: { stringValue: key },
        value: this._toFirestoreValue(value),
        updated_at: { timestampValue: new Date().toISOString() }
      }
    });
  }

  /** Delete a key from the KV collection */
  async delete(key) {
    return this._firestore('DELETE', `/${this.kvCollection}/${key}`);
  }

  /** List all keys in the KV collection */
  async list() {
    const result = await this._firestore('GET', `/${this.kvCollection}`);
    if (result.status === 200 && result.data?.documents) {
      return result.data.documents.map(doc => {
        const name = doc.name.split('/').pop();
        const fields = doc.fields || {};
        return {
          key: name,
          value: this._fromFirestoreValue(fields)
        };
      });
    }
    return [];
  }

  // ── Firestore helpers ──

  _toFirestoreValue(value) {
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') {
      return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
    }
    if (typeof value === 'boolean') return { booleanValue: value };
    if (value === null || value === undefined) return { nullValue: null };
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map(v => this._toFirestoreValue(v)) } };
    }
    if (typeof value === 'object') {
      const fields = {};
      for (const [k, v] of Object.entries(value)) {
        fields[k] = this._toFirestoreValue(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: JSON.stringify(value) };
  }

  _fromFirestoreValue(fields) {
    // If there's a "value" field, use it directly
    if (fields.value) {
      return this._extractTypedValue(fields.value);
    }
    // Otherwise, reconstruct the whole object
    const obj = {};
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'key') continue;
      obj[k] = this._extractTypedValue(v);
    }
    return Object.keys(obj).length === 1 ? Object.values(obj)[0] : obj;
  }

  _extractTypedValue(field) {
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.integerValue !== undefined) return Number(field.integerValue);
    if (field.doubleValue !== undefined) return Number(field.doubleValue);
    if (field.booleanValue !== undefined) return field.booleanValue;
    if (field.nullValue !== undefined) return null;
    if (field.timestampValue !== undefined) return field.timestampValue;
    if (field.arrayValue?.values) {
      return field.arrayValue.values.map(v => this._extractTypedValue(v));
    }
    if (field.mapValue?.fields) {
      const obj = {};
      for (const [k, v] of Object.entries(field.mapValue.fields)) {
        obj[k] = this._extractTypedValue(v);
      }
      return obj;
    }
    return field;
  }

  /** Check connection (validates credentials) */
  async ping() {
    try {
      const token = await this._getAccessToken();
      return !!token;
    } catch {
      return false;
    }
  }
}

module.exports = Firebase;
