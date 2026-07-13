/**
 * deploy.test.js — Tests for `redrock deploy`
 *
 * Verifies deploy detects missing redrock.json gracefully and handles
 * other pre-flight checks without crashing.
 */

// ── Mocks (must be before require) ──

const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
};

const mockPath = {
  basename: jest.fn((p) => p.split('/').pop()),
  join: jest.fn((...args) => args.join('/')),
};

const mockExecSync = jest.fn();

const mockHttps = {
  get: jest.fn(),
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

const deploy = require('../commands/deploy');

// ── Helpers ──

function resetAllMocks() {
  Object.values(mockFs).forEach((m) => m.mockReset());
  Object.values(mockChalk).forEach((m) => m.mockClear());
  mockExecSync.mockReset();
  mockOra.mockClear();
  mockHttps.get.mockReset();
  mockPath.basename.mockImplementation((p) => p.split('/').pop());
  mockPath.join.mockImplementation((...args) => args.join('/'));
}

// ── Tests ──

describe('redrock deploy', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('detects missing redrock.json and exits gracefully with a helpful error', async () => {
    mockFs.existsSync.mockReturnValue(false);

    await deploy({});

    expect(mockChalk.red).toHaveBeenCalledWith(
      expect.stringContaining('Not a Redrock project')
    );
    // Should NOT try to read config, run vercel, or do anything else
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('detects missing VERCEL_TOKEN and exits with guidance', async () => {
    // redrock.json exists
    mockFs.existsSync.mockImplementation((p) => p === 'redrock.json');
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        version: '0.1.0',
        mode: 'webhook',
        tokens: { primary: '123:abc', secondary: '' },
      })
    );
    // No VERCEL_TOKEN in env
    delete process.env.VERCEL_TOKEN;

    await deploy({});

    expect(mockChalk.yellow).toHaveBeenCalledWith(
      expect.stringContaining('VERCEL_TOKEN')
    );
    // Should NOT attempt actual deploy
    // (vercel --version may or may not be called depending on order)
  });

  it('warns when a custom vercel.json is detected', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === 'redrock.json') {
        return JSON.stringify({
          version: '0.1.0',
          mode: 'webhook',
          tokens: { primary: '123:abc', secondary: '' },
        });
      }
      if (p === 'vercel.json') {
        return JSON.stringify({ functions: { 'api/*': {} } });
      }
      return '';
    });
    process.env.VERCEL_TOKEN = 'vercel-token-123';

    // Mock vercel --version to succeed
    mockExecSync.mockImplementation(() => Buffer.from('Vercel CLI 28.0.0'));

    await deploy({});

    expect(mockChalk.yellow).toHaveBeenCalledWith(
      expect.stringContaining('Custom vercel.json')
    );
  });

  it('installs Vercel CLI when not found', async () => {
    mockFs.existsSync.mockImplementation((p) => p === 'redrock.json');
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        version: '0.1.0',
        mode: 'webhook',
        tokens: { primary: '123:abc', secondary: '' },
      })
    );
    process.env.VERCEL_TOKEN = 'vercel-token-123';

    // First call (vercel --version) fails → triggers install
    // Second call (npm i -g vercel) succeeds
    // Third call (actual vercel deploy) succeeds
    let callCount = 0;
    mockExecSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('not found');
      return Buffer.from(callCount === 2 ? 'installed' : 'Deploy complete');
    });

    await deploy({});

    expect(mockChalk.yellow).toHaveBeenCalledWith(
      expect.stringContaining('Installing Vercel CLI')
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      'npm i -g vercel',
      expect.anything()
    );
  });
});
