/**
 * init.test.js — Tests for `redrock init`
 *
 * Verifies init creates all expected project files and handles error
 * conditions (missing token, existing directory).
 */

// ── Mocks (must be before require) ──

const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  readFileSync: jest.fn(),
  appendFileSync: jest.fn(),
};

const mockPath = {
  resolve: jest.fn((...args) => args.join('/')),
  join: jest.fn((...args) => args.join('/')),
  basename: jest.fn((p) => p.split('/').pop()),
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
  hex: jest.fn(() => mockChalk),
};

jest.mock('fs', () => mockFs);
jest.mock('path', () => mockPath);
jest.mock('ora', () => mockOra);
jest.mock('chalk', () => mockChalk);
jest.mock('child_process', () => ({ execSync: jest.fn() }));

const init = require('../commands/init');

// ── Helpers ──

function getWrittenFile(calls, filename) {
  const call = calls.find((c) => c[0].endsWith(filename));
  return call ? call[1] : undefined;
}

function resetAllMocks() {
  Object.values(mockFs).forEach((m) => m.mockReset());
  Object.values(mockPath).forEach((m) => m.mockReset());
  mockOra.mockClear();
  Object.values(mockChalk).forEach((m) => m.mockClear());
}

// ── Tests ──

describe('redrock init', () => {
  const BOT_TOKEN = '123456:ABC-DEF';

  beforeEach(() => {
    resetAllMocks();

    // Default: project dir does NOT exist
    mockFs.existsSync.mockReturnValue(false);

    // readdirSync returns empty (no templates)
    mockFs.readdirSync.mockReturnValue([]);

    // path.resolve — default implementation works via mockPath above
    mockPath.resolve.mockImplementation((...args) => args.join('/'));
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.basename.mockImplementation((p) => p.split('/').pop());
  });

  // ── Success cases ──

  it('creates all expected project files (vercel.json, redrock.json, .env.example, api/webhook.py)', async () => {
    await init('test-bot', { token: BOT_TOKEN });

    const writeCalls = mockFs.writeFileSync.mock.calls;
    const mkdirCalls = mockFs.mkdirSync.mock.calls;

    // Creates project dir + api/
    expect(mkdirCalls).toHaveLength(2);
    expect(mkdirCalls[0][0]).toContain('test-bot');
    expect(mkdirCalls[1][0]).toContain('api');

    // vercel.json
    const vercelJson = getWrittenFile(writeCalls, 'vercel.json');
    expect(vercelJson).toBeDefined();
    const vc = JSON.parse(vercelJson);
    expect(vc.name).toBe('test-bot');
    expect(vc.functions).toBeDefined();

    // redrock.json
    const redrockJson = getWrittenFile(writeCalls, 'redrock.json');
    expect(redrockJson).toBeDefined();
    const rc = JSON.parse(redrockJson);
    expect(rc.mode).toBe('webhook');
    expect(rc.framework).toBe('python-telegram-bot');

    // .env.example
    const envExample = getWrittenFile(writeCalls, '.env.example');
    expect(envExample).toBeDefined();
    expect(envExample).toContain('BOT_TOKEN=');
    expect(envExample).toContain(BOT_TOKEN);

    // api/webhook.py
    const webhookPy = getWrittenFile(writeCalls, 'webhook.py');
    expect(webhookPy).toBeDefined();
    expect(webhookPy).toContain('class handler');
  });

  it('creates requirements.txt alongside webhook.py', async () => {
    await init('test-bot', { token: BOT_TOKEN });

    const writeCalls = mockFs.writeFileSync.mock.calls;
    const reqTxt = getWrittenFile(writeCalls, 'requirements.txt');
    expect(reqTxt).toBeDefined();
  });

  it('uses custom framework from opts when provided', async () => {
    await init('test-bot', { token: BOT_TOKEN, framework: 'grammy' });

    const writeCalls = mockFs.writeFileSync.mock.calls;
    const redrockJson = getWrittenFile(writeCalls, 'redrock.json');
    const rc = JSON.parse(redrockJson);
    expect(rc.framework).toBe('grammy');
  });

  it('uses token from BOT_TOKEN env when not in opts', async () => {
    process.env.BOT_TOKEN = 'env-token-999';
    await init('test-bot', {});

    const writeCalls = mockFs.writeFileSync.mock.calls;
    const envExample = getWrittenFile(writeCalls, '.env.example');
    expect(envExample).toContain('env-token-999');

    delete process.env.BOT_TOKEN;
  });

  // ── Error cases ──

  it('exits gracefully when no token is provided', async () => {
    delete process.env.BOT_TOKEN;
    await init('test-bot', {});

    // Should not create any directories or files
    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockChalk.red).toHaveBeenCalledWith(
      expect.stringContaining('token')
    );
  });

  it('exits gracefully when project directory already exists', async () => {
    mockFs.existsSync.mockReturnValue(true);

    await init('test-bot', { token: BOT_TOKEN });

    // Should not create files in existing dir
    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockChalk.red).toHaveBeenCalledWith(
      expect.stringContaining('already exists')
    );
  });

  it('defaults name to my-redrock-bot when not provided', async () => {
    // init() is called with name=undefined from Commander but the
    // function default param handles it
    await init(undefined, { token: BOT_TOKEN });

    const mkdirCalls = mockFs.mkdirSync.mock.calls;
    expect(mkdirCalls[0][0]).toContain('my-redrock-bot');
  });
});
