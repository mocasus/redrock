const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const chalk = require('chalk');
const ora = require('ora');

// ── Constants ──

const PROVIDERS = ['vercel-kv', 'supabase', 'firebase'];

const PROVIDER_DISPLAY = {
  'vercel-kv': 'Vercel KV (Redis REST)',
  'supabase': 'Supabase (PostgreSQL)',
  'firebase': 'Firebase Firestore (NoSQL)'
};

// ── redrock.json helpers ──

function readRedrockConfig(cwd) {
  const configPath = path.join(cwd, 'redrock.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeRedrockConfig(cwd, config) {
  const configPath = path.join(cwd, 'redrock.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function updateDbProvider(cwd, provider, extra = {}) {
  const config = readRedrockConfig(cwd) || { version: '0.1.0' };
  config.db = {
    provider,
    ...extra,
    initializedAt: new Date().toISOString()
  };
  writeRedrockConfig(cwd, config);
  return config;
}

// ── Vercel API helpers (moved from old db.js, kept for Vercel KV init) ──

function vercelApi(method, apiPath, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.vercel.com${apiPath}`);
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Vercel API timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getProjectId(token) {
  const projectJson = path.join(process.cwd(), '.vercel', 'project.json');
  if (fs.existsSync(projectJson)) {
    const pj = JSON.parse(fs.readFileSync(projectJson, 'utf8'));
    if (pj.projectId) return pj.projectId;
  }

  if (fs.existsSync('vercel.json')) {
    try {
      const vc = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
      if (vc.name) {
        const result = await vercelApi('GET', `/v9/projects?slug=${vc.name}&limit=1`, token);
        if (result.data?.projects?.length) return result.data.projects[0].id;
      }
    } catch {}
  }

  return null;
}

async function createKVStore(token, projectId) {
  const result = await vercelApi('POST', `/v1/stores/kv`, token, {
    name: `redrock-${projectId.slice(0, 8)}`,
    projectIds: [projectId]
  });

  if (result.status === 201 || result.status === 200) {
    return result.data;
  }

  if (result.data?.error?.code === 'already_exists') {
    const list = await vercelApi('GET', `/v1/stores/kv?projectId=${projectId}`, token);
    if (list.data?.stores?.length) return list.data.stores[0];
  }

  throw new Error(result.data?.error?.message || `KV create failed (HTTP ${result.status})`);
}

// ── Provider initializers ──

async function initVercelKV(cwd, token) {
  if (!token) {
    console.log(chalk.red('❌ VERCEL_TOKEN not set.'));
    console.log(chalk.dim('   Get it from: https://vercel.com/account/tokens'));
    console.log(chalk.dim('   Then: export VERCEL_TOKEN=<token>'));
    return false;
  }

  const spinner = ora('Connecting to Vercel KV...').start();

  try {
    const projectId = await getProjectId(token);
    if (!projectId) {
      spinner.fail('No Vercel project found.');
      console.log(chalk.yellow('   Link project first:'));
      console.log(chalk.dim('   vercel link'));
      return false;
    }

    spinner.text = 'Creating KV store...';
    const store = await createKVStore(token, projectId);

    if (!store || !store.url) {
      spinner.fail('Failed to create KV store.');
      console.log(chalk.yellow('   Create manually: https://vercel.com/dashboard/stores'));
      return false;
    }

    spinner.text = 'Setting environment variables...';

    const envVars = {
      KV_URL: store.url,
      KV_REST_API_URL: store.restApiUrl || store.url,
      KV_REST_API_TOKEN: store.restApiToken || store.token,
      KV_REST_API_READ_ONLY_TOKEN: store.readOnlyToken || ''
    };

    for (const [key, value] of Object.entries(envVars)) {
      if (!value) continue;
      try {
        execSync(`vercel env add ${key} production --token ${token}`, {
          stdio: 'pipe',
          input: value
        });
      } catch {
        // env might already exist
      }
    }

    // Write local .env
    const envPath = path.join(cwd, '.env');
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (!existing.includes('KV_REST_API_URL')) {
      const envLines = Object.entries(envVars)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      fs.appendFileSync(envPath, `\n# Redrock Vercel KV\n${envLines}\n`);
    }

    // Update redrock.json
    updateDbProvider(cwd, 'vercel-kv', {
      url: store.url,
      restApiUrl: store.restApiUrl || store.url
    });

    spinner.succeed('Vercel KV ready!');
    return true;

  } catch (err) {
    spinner.fail('Vercel KV setup failed.');
    console.log(chalk.red(`   ${err.message}`));

    if (err.message.includes('KV')) {
      console.log(chalk.yellow('\n📋 Manual setup:'));
      console.log(chalk.dim('   1. Go to https://vercel.com/dashboard/stores'));
      console.log(chalk.dim('   2. Create a KV Database'));
      console.log(chalk.dim('   3. Copy KV_REST_API_URL + KV_REST_API_TOKEN to .env'));
      console.log(chalk.dim('   4. Run redrock db init again'));
    }
    return false;
  }
}

async function initSupabase(cwd) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.log(chalk.red('❌ Supabase credentials not set.'));
    console.log(chalk.dim('   Required: SUPABASE_URL, SUPABASE_KEY'));
    console.log(chalk.dim('   Get them from: https://app.supabase.com → Settings → API'));
    console.log(chalk.dim('   Then: export SUPABASE_URL=<url> SUPABASE_KEY=<key>'));
    return false;
  }

  const spinner = ora('Connecting to Supabase...').start();

  try {
    // Test connection
    const Supabase = require('../providers/supabase');
    const db = Supabase.connect({ url, key });

    spinner.text = 'Testing connection...';
    const alive = await db.ping();
    if (!alive) {
      spinner.fail('Cannot reach Supabase.');
      console.log(chalk.dim(`   Check SUPABASE_URL: ${url}`));
      return false;
    }

    // Create KV table
    spinner.text = 'Creating KV table...';
    await db.initKVTable();

    // Update redrock.json
    updateDbProvider(cwd, 'supabase', {
      url,
      kvTable: 'redrock_kv'
    });

    // Update .env
    const envPath = path.join(cwd, '.env');
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (!existing.includes('SUPABASE_URL')) {
      const envLines = [
        `SUPABASE_URL=${url}`,
        `SUPABASE_KEY=${key}`
      ].join('\n');
      fs.appendFileSync(envPath, `\n# Redrock Supabase\n${envLines}\n`);
    }

    spinner.succeed('Supabase ready!');
    return true;

  } catch (err) {
    spinner.fail('Supabase setup failed.');
    console.log(chalk.red(`   ${err.message}`));
    console.log(chalk.yellow('\n📋 Manual setup:'));
    console.log(chalk.dim('   1. Go to https://app.supabase.com → SQL Editor'));
    console.log(chalk.dim('   2. Run: CREATE TABLE redrock_kv (key TEXT PRIMARY KEY, value JSONB);'));
    console.log(chalk.dim('   3. Run redrock db init --provider supabase again'));
    return false;
  }
}

async function initFirebase(cwd) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.log(chalk.red('❌ Firebase credentials not set.'));
    console.log(chalk.dim('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'));
    console.log(chalk.dim('   Get them from: https://console.firebase.google.com → Service Accounts'));
    console.log(chalk.dim('   Then: export FIREBASE_PROJECT_ID=<id> FIREBASE_CLIENT_EMAIL=<email> FIREBASE_PRIVATE_KEY=<key>'));
    return false;
  }

  const spinner = ora('Connecting to Firebase Firestore...').start();

  try {
    // Test connection
    const Firebase = require('../providers/firebase');
    const db = Firebase.connect({ projectId, clientEmail, privateKey });

    spinner.text = 'Testing credentials...';
    const alive = await db.ping();
    if (!alive) {
      spinner.fail('Firebase authentication failed.');
      console.log(chalk.dim('   Check your FIREBASE_* env vars'));
      return false;
    }

    // Update redrock.json
    updateDbProvider(cwd, 'firebase', {
      projectId,
      kvCollection: 'redrock_kv'
    });

    // Update .env
    const envPath = path.join(cwd, '.env');
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (!existing.includes('FIREBASE_PROJECT_ID')) {
      const envLines = [
        `FIREBASE_PROJECT_ID=${projectId}`,
        `FIREBASE_CLIENT_EMAIL=${clientEmail}`,
        `FIREBASE_PRIVATE_KEY=${privateKey}`
      ].join('\n');
      fs.appendFileSync(envPath, `\n# Redrock Firebase\n${envLines}\n`);
    }

    spinner.succeed('Firebase Firestore ready!');
    return true;

  } catch (err) {
    spinner.fail('Firebase setup failed.');
    console.log(chalk.red(`   ${err.message}`));
    return false;
  }
}

// ── Boilerplate generators ──

function generateDbJs(cwd, provider, config = {}) {
  const apiDir = path.join(cwd, 'api');
  if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

  let content;

  switch (provider) {
    case 'vercel-kv':
      content = generateVercelKvJs(config);
      break;
    case 'supabase':
      content = generateSupabaseJs(config);
      break;
    case 'firebase':
      content = generateFirebaseJs(config);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  fs.writeFileSync(path.join(apiDir, 'db.js'), content);
}

function generateVercelKvJs(config) {
  return `/**
 * Redrock DB Helper — Vercel KV
 * Auto-generated by redrock db init
 *
 * Usage:
 *   const { db } = require('./api/db');
 *   await db.set("visits", 42);
 *   const count = await db.get("visits");
 */

const https = require('https');

class RedrockDB {
  constructor() {
    this.url = process.env.KV_REST_API_URL;
    this.token = process.env.KV_REST_API_TOKEN;
  }

  async _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.url);
      const opts = {
        method,
        headers: {
          Authorization: \`Bearer \${this.token}\`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      };

      const req = https.request(url, opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(res.statusCode === 200 ? json.result : null);
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async set(key, value, ttl) {
    const payload = { value: typeof value === 'string' ? value : JSON.stringify(value) };
    if (ttl) payload.ex = ttl;
    return this._request('POST', \`/set/\${key}\`, payload);
  }

  async get(key, fallback = null) {
    const result = await this._request('GET', \`/get/\${key}\`);
    if (result === null || result === undefined) return fallback;
    try { return JSON.parse(result); } catch { return result; }
  }

  async delete(key) {
    return this._request('DELETE', \`/del/\${key}\`);
  }

  async list(prefix = '') {
    return this._request('GET', \`/list/\${prefix}\`) || [];
  }

  async incr(key, amount = 1) {
    const current = (await this.get(key, 0)) || 0;
    const next = (typeof current === 'number' ? current : 0) + amount;
    await this.set(key, next);
    return next;
  }
}

const db = new RedrockDB();
module.exports = { db, RedrockDB };
`;
}

function generateSupabaseJs(config) {
  return `/**
 * Redrock DB Helper — Supabase
 * Auto-generated by redrock db init
 *
 * Uses table: ${config.kvTable || 'redrock_kv'} (key TEXT PK, value JSONB)
 *
 * Usage:
 *   const { db } = require('./api/db');
 *   await db.set("visits", 42);
 *   const count = await db.get("visits");
 */

const https = require('https');

class RedrockDB {
  constructor() {
    this.url = process.env.SUPABASE_URL;
    this.key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
    this.table = '${config.kvTable || 'redrock_kv'}';
  }

  async _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(\`/rest/v1\${path}\`, this.url);
      const opts = {
        method,
        headers: {
          apikey: this.key,
          Authorization: \`Bearer \${this.key}\`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        timeout: 10000
      };

      const req = https.request(url, opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      });

      req.on('error', () => resolve({ status: 0, data: null }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: null }); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async set(key, value) {
    // Upsert: POST with Prefer: resolution=merge-duplicates
    const result = await this._request(
      'POST',
      \`/\${this.table}\`,
      { key, value },
      { Prefer: 'resolution=merge-duplicates' }
    );

    // Fallback if upsert not supported
    if (result.status === 409 || result.status === 400) {
      await this.delete(key);
      return this._request('POST', \`/\${this.table}\`, { key, value });
    }

    return result;
  }

  async get(key, fallback = null) {
    const result = await this._request(
      'GET',
      \`/\${this.table}?key=eq.\${encodeURIComponent(key)}&select=value&limit=1\`
    );
    if (result.status === 200 && Array.isArray(result.data) && result.data.length > 0) {
      return result.data[0].value;
    }
    return fallback;
  }

  async delete(key) {
    return this._request(
      'DELETE',
      \`/\${this.table}?key=eq.\${encodeURIComponent(key)}\`
    );
  }

  async list(prefix = '') {
    const result = await this._request(
      'GET',
      \`/\${this.table}?select=key,value\`
    );
    if (result.status === 200 && Array.isArray(result.data)) {
      return prefix
        ? result.data.filter(r => r.key.startsWith(prefix))
        : result.data;
    }
    return [];
  }

  async incr(key, amount = 1) {
    const current = (await this.get(key, 0)) || 0;
    const next = (typeof current === 'number' ? current : 0) + amount;
    await this.set(key, next);
    return next;
  }
}

const db = new RedrockDB();
module.exports = { db, RedrockDB };
`;
}

function generateFirebaseJs(config) {
  return `/**
 * Redrock DB Helper — Firebase Firestore
 * Auto-generated by redrock db init
 *
 * Uses collection: ${config.kvCollection || 'redrock_kv'} (doc id = key)
 *
 * Usage:
 *   const { db } = require('./api/db');
 *   await db.set("visits", 42);
 *   const count = await db.get("visits");
 */

const https = require('https');
const crypto = require('crypto');

class RedrockDB {
  constructor() {
    this.projectId = process.env.FIREBASE_PROJECT_ID;
    this.clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    this.privateKey = process.env.FIREBASE_PRIVATE_KEY;
    this.collection = '${config.kvCollection || 'redrock_kv'}';
    this._token = null;
    this._tokenExp = 0;
  }

  async _token() {
    if (this._token && Date.now() < this._tokenExp) return this._token;

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

    const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(\`\${b64(header)}.\${b64(claim)}\`);
    const jwt = \`\${b64(header)}.\${b64(claim)}.\${signer.sign(this.privateKey, 'base64url')}\`;

    const result = await this._post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    });

    this._token = result.access_token;
    this._tokenExp = Date.now() + (result.expires_in - 60) * 1000;
    return this._token;
  }

  _post(url, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = https.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
        timeout: 10000
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async _firestore(method, path, body = null) {
    const token = await this._token();
    const url = \`https://firestore.googleapis.com/v1/projects/\${this.projectId}/databases/(default)/documents\${path}\`;

    return new Promise((resolve) => {
      const req = https.request(url, {
        method,
        headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
        timeout: 10000
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, data: d }); }
        });
      });
      req.on('error', () => resolve({ status: 0, data: null }));
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async set(key, value) {
    const fields = {
      key: { stringValue: key },
      value: _valueToFirestore(value),
      updated_at: { timestampValue: new Date().toISOString() }
    };
    return this._firestore('PATCH', \`/\${this.collection}/\${key}\`, { fields });
  }

  async get(key, fallback = null) {
    const result = await this._firestore('GET', \`/\${this.collection}/\${key}\`);
    if (result.status === 200 && result.data?.fields?.value) {
      return _valueFromFirestore(result.data.fields.value);
    }
    return fallback;
  }

  async delete(key) {
    return this._firestore('DELETE', \`/\${this.collection}/\${key}\`);
  }

  async list() {
    const result = await this._firestore('GET', \`/\${this.collection}\`);
    if (result.status === 200 && result.data?.documents) {
      return result.data.documents.map(doc => ({
        key: doc.name.split('/').pop(),
        value: doc.fields?.value ? _valueFromFirestore(doc.fields.value) : null
      }));
    }
    return [];
  }

  async incr(key, amount = 1) {
    const current = (await this.get(key, 0)) || 0;
    const next = (typeof current === 'number' ? current : 0) + amount;
    await this.set(key, next);
    return next;
  }
}

function _valueToFirestore(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(_valueToFirestore) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = _valueToFirestore(val);
    return { mapValue: { fields } };
  }
  return { stringValue: JSON.stringify(v) };
}

function _valueFromFirestore(f) {
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.integerValue !== undefined) return Number(f.integerValue);
  if (f.doubleValue !== undefined) return Number(f.doubleValue);
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.nullValue !== undefined) return null;
  if (f.arrayValue?.values) return f.arrayValue.values.map(_valueFromFirestore);
  if (f.mapValue?.fields) {
    const obj = {};
    for (const [k, v] of Object.entries(f.mapValue.fields)) obj[k] = _valueFromFirestore(v);
    return obj;
  }
  return f;
}

const db = new RedrockDB();
module.exports = { db, RedrockDB };
`;
}

// ── Migration ──

async function runMigration(cwd, from, to) {
  const spinner = ora(`Migrating from ${PROVIDER_DISPLAY[from]} to ${PROVIDER_DISPLAY[to]}...`).start();

  try {
    // Step 1: Export all data from source provider
    spinner.text = `Exporting data from ${from}...`;
    const data = await exportAll(cwd, from);

    if (data.length === 0) {
      spinner.info('No data to migrate.');
    } else {
      spinner.text = `Exporting ${data.length} keys... done.`;
    }

    // Step 2: Import to target provider
    spinner.text = `Importing to ${to}...`;
    await importAll(cwd, to, data);
    spinner.text = `Imported ${data.length} keys.`;

    // Step 3: Generate migration script for reproducibility
    spinner.text = 'Generating migration script...';
    generateMigrationScript(cwd, from, to, data);

    // Step 4: Update redrock.json
    spinner.text = 'Updating config...';
    updateDbProvider(cwd, to, {});

    // Step 5: Regenerate db.js for new provider
    await generateDbHelper(cwd, to);

    spinner.succeed(`Migration complete: ${PROVIDER_DISPLAY[from]} → ${PROVIDER_DISPLAY[to]}`);

    if (data.length > 0) {
      console.log(chalk.dim(`   ${data.length} keys migrated`));
    }
    console.log(chalk.dim(`   Migration script: api/migrations/${from}-to-${to}.js`));
    console.log(chalk.dim(`   db.js updated for ${to}`));

  } catch (err) {
    spinner.fail('Migration failed.');
    console.log(chalk.red(`   ${err.message}`));
  }
}

async function exportAll(cwd, provider) {
  const items = [];

  switch (provider) {
    case 'vercel-kv': {
      const db = require('../providers/vercel-kv');
      const kv = db.connect({});
      const keys = await kv.list();
      for (const key of (Array.isArray(keys) ? keys : [])) {
        const k = typeof key === 'string' ? key : key.key || key;
        const value = await kv.get(k);
        items.push({ key: k, value });
      }
      break;
    }

    case 'supabase': {
      const db = require('../providers/supabase');
      const sql = db.connect({});
      const result = await sql.select('redrock_kv', 'key,value');
      if (result.status === 200 && Array.isArray(result.data)) {
        for (const row of result.data) {
          items.push({ key: row.key, value: row.value });
        }
      }
      break;
    }

    case 'firebase': {
      const db = require('../providers/firebase');
      const fsdb = db.connect({});
      const docs = await fsdb.list();
      for (const doc of docs) {
        items.push({ key: doc.key, value: doc.value });
      }
      break;
    }
  }

  return items;
}

async function importAll(cwd, provider, data) {
  switch (provider) {
    case 'vercel-kv': {
      const db = require('../providers/vercel-kv');
      const kv = db.connect({});
      for (const item of data) {
        await kv.set(item.key, item.value);
      }
      break;
    }

    case 'supabase': {
      const db = require('../providers/supabase');
      const sql = db.connect({});
      for (const item of data) {
        await sql.set(item.key, item.value);
      }
      break;
    }

    case 'firebase': {
      const db = require('../providers/firebase');
      const fsdb = db.connect({});
      for (const item of data) {
        await fsdb.set(item.key, item.value);
      }
      break;
    }
  }
}

function generateMigrationScript(cwd, from, to, data) {
  const migrationsDir = path.join(cwd, 'api', 'migrations');
  if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });

  const filename = `${from}-to-${to}-${Date.now()}.js`;
  const filepath = path.join(migrationsDir, filename);

  const script = `/**
 * Migration: ${from} → ${to}
 * Generated: ${new Date().toISOString()}
 * Keys migrated: ${data.length}
 *
 * To replay: node api/migrations/${filename}
 */

const data = ${JSON.stringify(data, null, 2)};

async function migrate() {
  const provider = '${to}';
  let db;

  // Load target provider
  if (provider === 'vercel-kv') {
    db = require('../providers/vercel-kv').connect({});
  } else if (provider === 'supabase') {
    db = require('../providers/supabase').connect({});
  } else if (provider === 'firebase') {
    db = require('../providers/firebase').connect({});
  }

  if (!db) {
    throw new Error(\`Unknown provider: \${provider}\`);
  }

  console.log(\`Migrating \${data.length} keys to \${provider}...\`);
  for (const item of data) {
    await db.set(item.key, item.value);
  }
  console.log('Done.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
`;

  fs.writeFileSync(filepath, script);
}

// ── Generate db.js helper (called after init and migrate) ──

async function generateDbHelper(cwd, provider) {
  const config = readRedrockConfig(cwd);
  const dbConfig = config?.db || {};
  generateDbJs(cwd, provider, dbConfig);
}

// ── Main command ──

module.exports = async function db(action, opts = {}) {
  const cwd = process.cwd();
  const provider = opts.to || opts.provider || 'vercel-kv';

  if (action === 'init') {
    // Check for redrock.json
    const config = readRedrockConfig(cwd);
    const currentProvider = config?.db?.provider;

    if (currentProvider) {
      console.log(chalk.yellow(`⚠️  Database already initialized with ${PROVIDER_DISPLAY[currentProvider] || currentProvider}.`));
      console.log(chalk.dim(`   To switch, use: redrock db migrate --to <provider>`));
      console.log('');
    }

    console.log(chalk.cyan(`\n🗄️  Initializing database — provider: ${PROVIDER_DISPLAY[provider] || provider}`));
    console.log('');

    let success = false;

    switch (provider) {
      case 'vercel-kv':
        success = await initVercelKV(cwd, process.env.VERCEL_TOKEN);
        break;
      case 'supabase':
        success = await initSupabase(cwd);
        break;
      case 'firebase':
        success = await initFirebase(cwd);
        break;
      default:
        console.log(chalk.red(`❌ Unknown provider: ${provider}`));
        console.log(chalk.dim(`   Available: ${PROVIDERS.join(', ')}`));
        return;
    }

    if (success) {
      // Generate db.js helper
      generateDbHelper(cwd, provider);

      console.log(chalk.green('\n🗄️  Database configured!'));
      console.log(chalk.dim(`   Provider: ${PROVIDER_DISPLAY[provider]}`));
      console.log(chalk.dim(`   Config: redrock.json`));
      console.log(chalk.dim(`   Helper: api/db.js`));
      console.log('');
      console.log(chalk.cyan('   Usage in your bot:'));
      console.log(chalk.dim(`   const { db } = require('./api/db');`));
      console.log(chalk.dim(`   await db.set("key", "value");`));
      console.log(chalk.dim(`   const val = await db.get("key");`));
    } else {
      // Still generate helper even on partial failure (user can fill env vars later)
      try {
        generateDbHelper(cwd, provider);
        console.log(chalk.green('\n   ✓ api/db.js generated (fill in env vars to complete setup)'));
      } catch (e) {
        console.log(chalk.dim(`   Could not generate db.js: ${e.message}`));
      }
    }

  } else if (action === 'migrate') {
    const to = opts.to;

    if (!to) {
      console.log(chalk.red('❌ --to <provider> is required for migrate'));
      console.log(chalk.dim(`   Example: redrock db migrate --to supabase`));
      console.log(chalk.dim(`   Available: ${PROVIDERS.join(', ')}`));
      return;
    }

    if (!PROVIDERS.includes(to)) {
      console.log(chalk.red(`❌ Unknown provider: ${to}`));
      console.log(chalk.dim(`   Available: ${PROVIDERS.join(', ')}`));
      return;
    }

    const config = readRedrockConfig(cwd);
    const from = config?.db?.provider || 'vercel-kv';

    if (from === to) {
      console.log(chalk.yellow(`⚠️  Already using ${PROVIDER_DISPLAY[to]}. No migration needed.`));
      return;
    }

    console.log(chalk.cyan(`\n🔄  Database migration`));
    console.log(chalk.dim(`   From: ${PROVIDER_DISPLAY[from] || from}`));
    console.log(chalk.dim(`   To:   ${PROVIDER_DISPLAY[to]}`));
    console.log('');

    await runMigration(cwd, from, to);

  } else {
    console.log(chalk.red(`❌ Unknown action: ${action}`));
    console.log(chalk.dim('   Available: redrock db init [--provider <name>], redrock db migrate --to <provider>'));
  }
};
