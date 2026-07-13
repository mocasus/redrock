/**
 * db.test.js — Tests for `redrock db <action>`
 *
 * Verifies db init writes config and helper, db migrate validates
 * providers and handles same-provider early exits.
 */

// ── Mocks (must be before require) ──

const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
};

const mockPath = {
  join: jest.fn((...args) => args.join('/')),
};

const mockExecSync = jest.fn();

const mockHttps = {
  request: jest.fn(),
};

const mockOra = jest.fn(() => ({
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  warn: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  text: '',
}));

const mockChalk = {
  red: jest.fn((s) => s),
  green: jest.fn((s) => s),
  yellow: jest.fn((s) => s),
  cyan: jest.fn((s) => s),
  dim: jest.fn((s) => s),
};

jest.mock('fs', () => mockFs);
jest.mock('path', () => mockPath);
jest.mock('child_process', () => ({ execSync: mockExecSync }));
jest.mock('https', () => mockHttps);
jest.mock('ora', () => mockOra);
jest.mock('chalk', () => mockChalk);

// Provider modules may be loaded via require() inside db.js
jest.mock('../providers/supabase', () => ({
  connect: jest.fn(() => ({
    ping: jest.fn().mockResolvedValue(true),
    initKVTable: jest.fn().mockResolvedValue(true),
  })),
}));
jest.mock('../providers/firebase', () => ({
  connect: jest.fn(() => ({
    ping: jest.fn().mockResolvedValue(true),
  })),
}));

const db = require('../commands/db');

// ── Helpers ──

function resetAllMocks() {
  Object.values(mockFs).forEach((m) => m.mockReset());
  mockExecSync.mockReset();
  mockOra.mockClear();
  mockHttps.request.mockReset();
  mockPath.join.mockImplementation((...args) => args.join('/'));
  Object.values(mockChalk).forEach((m) => m.mockClear());
}

function mockRedrockConfig(overrides = {}) {
  mockFs.existsSync.mockImplementation((p) =>
    p.endsWith('redrock.json') || p.endsWith('project.json')
  );
  mockFs.readFileSync.mockImplementation((p) => {
    if (p.endsWith('redrock.json')) {
      return JSON.stringify({
        version: '0.1.0',
        mode: 'webhook',
        framework: 'python-telegram-bot',
        ...overrides,
      });
    }
    if (p.endsWith('project.json')) {
      return JSON.stringify({ projectId: 'prj_abc123' });
    }
    return '';
  });
}

// ── Tests ──

describe('redrock db', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // ── db init ──

  describe('init', () => {
    it('generates db.js helper when Vercel KV setup succeeds', async () => {
      process.env.VERCEL_TOKEN = 'test-vercel-token';
      mockRedrockConfig();

      // Mock HTTP response for KV store creation
      mockHttps.request.mockImplementation((url, options, callback) => {
        const res = {
          statusCode: 201,
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify({
              url: 'https://kv-store.vercel.com',
              restApiUrl: 'https://kv-rest.vercel.com',
              restApiToken: 'kv-token-123',
              readOnlyToken: 'ro-token-456',
            }));
            if (event === 'end') handler();
          },
        };
        callback(res);
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
        };
      });
      mockExecSync.mockReturnValue(Buffer.from(''));

      await db('init', {});

      // Should write db.js to api/
      const writeCalls = mockFs.writeFileSync.mock.calls;
      const dbJsCall = writeCalls.find((c) => c[0].endsWith('db.js'));
      expect(dbJsCall).toBeDefined();
      expect(dbJsCall[1]).toContain('class RedrockDB');
      expect(dbJsCall[1]).toContain('async get(');
      expect(dbJsCall[1]).toContain('async set(');
    });

    it('requires VERCEL_TOKEN and exits with guidance when missing', async () => {
      delete process.env.VERCEL_TOKEN;
      mockRedrockConfig();

      await db('init', {});

      expect(mockChalk.red).toHaveBeenCalledWith(
        expect.stringContaining('VERCEL_TOKEN')
      );
    });

    it('handles missing Vercel project gracefully (still generates db.js)', async () => {
      process.env.VERCEL_TOKEN = 'test-vercel-token';
      // No .vercel/project.json and no vercel.json with name
      mockFs.existsSync.mockReturnValue(false);

      await db('init', {});

      // Even on failure, db.js should be generated
      const writeCalls = mockFs.writeFileSync.mock.calls;
      const dbJsCall = writeCalls.find((c) => c[0].endsWith('db.js'));
      expect(dbJsCall).toBeDefined();
    });

    it('initializes supabase when --provider supabase is specified', async () => {
      process.env.SUPABASE_URL = 'https://xyz.supabase.co';
      process.env.SUPABASE_KEY = 'sb-key-123';
      mockRedrockConfig();

      await db('init', { provider: 'supabase' });

      expect(mockChalk.green).toHaveBeenCalledWith(
        expect.stringContaining('Database configured')
      );
      // Should write db.js
      const writeCalls = mockFs.writeFileSync.mock.calls;
      const dbJsCall = writeCalls.find((c) => c[0].endsWith('db.js'));
      expect(dbJsCall).toBeDefined();
    });

    it('rejects unknown provider', async () => {
      mockRedrockConfig();
      await db('init', { provider: 'mongodb' });

      expect(mockChalk.red).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider')
      );
    });
  });

  // ── db migrate ──

  describe('migrate', () => {
    it('rejects migrate without --to flag with a clear error', async () => {
      await db('migrate', {});

      expect(mockChalk.red).toHaveBeenCalledWith(
        expect.stringContaining('--to')
      );
      expect(mockChalk.dim).toHaveBeenCalledWith(
        expect.stringContaining('Available')
      );
    });

    it('rejects unknown provider in --to flag', async () => {
      await db('migrate', { to: 'couchdb' });

      expect(mockChalk.red).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider')
      );
      expect(mockChalk.dim).toHaveBeenCalledWith(
        expect.stringContaining('Available')
      );
    });

    it('warns when already using the target provider (same-provider no-op)', async () => {
      mockRedrockConfig({ db: { provider: 'supabase' } });

      await db('migrate', { to: 'supabase' });

      expect(mockChalk.yellow).toHaveBeenCalledWith(
        expect.stringContaining('Already using')
      );
      expect(mockChalk.yellow).toHaveBeenCalledWith(
        expect.stringContaining('No migration needed')
      );
    });

    it('accepts firebase as a valid target provider', async () => {
      // No redrock.json → defaults from provider to vercel-kv
      // to=firebase ≠ vercel-kv → should proceed to migration
      // runMigration will try real I/O, but we just verify validation passes
      mockFs.existsSync.mockReturnValue(false);
      // But the runMigration call will crash — let's let the test
      // just verify the validation doesn't reject it
      // We suppress runMigration by making readRedrockConfig return null
      // (redrock.json doesn't exist)

      // Actually, since runMigration does real work, reject the
      // migration attempt so the test doesn't hang/crash.
      // The test ensures the validation passes (no "Unknown provider" error).
      await db('migrate', { to: 'firebase' });

      // Should NOT have been called with "Unknown provider"
      const redCalls = mockChalk.red.mock.calls.map(c => c[0]).join(' ');
      expect(redCalls).not.toContain('Unknown provider');

      // Should show migration banner (cyan)
      expect(mockChalk.cyan).toHaveBeenCalledWith(
        expect.stringContaining('Database migration')
      );
    });
  });

  // ── Unknown action ──

  describe('unknown action', () => {
    it('rejects unknown actions with a clear error message', async () => {
      await db('destroy', {});

      expect(mockChalk.red).toHaveBeenCalledWith(
        expect.stringContaining('Unknown action')
      );
      expect(mockChalk.dim).toHaveBeenCalledWith(
        expect.stringContaining('Available')
      );
    });
  });
});
