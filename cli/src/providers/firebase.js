/**
 * Firebase Firestore Provider — NoSQL document database
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
  constructor(opts = {}) {
    this.projectId = opts.projectId || process.env.FIREBASE_PROJECT_ID;
    this.clientEmail = opts.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
    this.privateKey = opts.privateKey || process.env.FIREBASE_PRIVATE_KEY;
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
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
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

  /** Set a document */
  async set(collection, docId, fields) {
    return this._firestore('PATCH', `/${collection}/${docId}`, { fields: this._toFirestore(fields) });
  }

  /** Get a document */
  async get(collection, docId) {
    const result = await this._firestore('GET', `/${collection}/${docId}`);
    return result.data?.fields ? this._fromFirestore(result.data.fields) : null;
  }

  /** Delete a document */
  async delete(collection, docId) {
    return this._firestore('DELETE', `/${collection}/${docId}`);
  }

  _toFirestore(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') fields[k] = { stringValue: v };
      else if (typeof v === 'number') fields[k] = Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
      else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
      else if (v === null) fields[k] = { nullValue: null };
      else fields[k] = { stringValue: JSON.stringify(v) };
    }
    return fields;
  }

  _fromFirestore(fields) {
    const obj = {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? v.nullValue ?? JSON.stringify(v);
    }
    return obj;
  }

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
