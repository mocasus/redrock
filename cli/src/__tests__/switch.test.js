/**
 * switch.test.js — Tests for `redrock switch <mode>`
 *
 * Verifies switch validates mode ('webhook'/'polling') and handles
 * edge cases like missing redrock.json.
 */

// ── Mocks (must be before require) ──

const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
};

const mockChalk = {
  red: jest.fn((s) => s),
  green: jest.fn((s) => s),
  yellow: jest.fn((s) => s),
  cyan: jest.fn((s) => s),
  dim: jest.fn((s) => s),
};

jest.mock('fs', () => mockFs);
jest.mock('chalk', () => mockChalk);

const switchMode = require('../commands/switch');

// ── Helpers ──

function resetAllMocks() {
  Object.values(mockFs).forEach((m) => m.mockReset());
  Object.values(mockChalk).forEach((m) => m.mockClear());
}

// ── Tests ──

describe('redrock switch', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('accepts "webhook" mode and updates redrock.json', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mode: 'polling', framework: 'python-telegram-bot' })
    );

    await switchMode('webhook');

    // Should write updated config with mode changed
    expect(mockFs.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
    expect(written.mode).toBe('webhook');
    expect(mockChalk.green).toHaveBeenCalledWith(
      expect.stringContaining('webhook')
    );
  });

  it('accepts "polling" mode and updates redrock.json', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ mode: 'webhook', framework: 'python-telegram-bot' })
    );

    await switchMode('polling');

    const written = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
    expect(written.mode).toBe('polling');
    expect(mockChalk.green).toHaveBeenCalledWith(
      expect.stringContaining('polling')
    );
  });

  it('rejects invalid mode values with a clear error', async () => {
    await switchMode('long-polling');
    expect(mockChalk.red).toHaveBeenCalledWith(
      expect.stringContaining('webhook')
    );
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();

    await switchMode('http');
    expect(mockChalk.red).toHaveBeenCalledWith(
      expect.stringContaining('webhook')
    );
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();

    await switchMode('');
    expect(mockChalk.red).toHaveBeenCalledWith(
      expect.stringContaining('webhook')
    );
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('handles missing redrock.json with "Not a Redrock project" error', async () => {
    mockFs.existsSync.mockReturnValue(false);

    await switchMode('webhook');

    expect(mockChalk.red).toHaveBeenCalledWith(
      expect.stringContaining('Not a Redrock project')
    );
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('preserves other config fields when switching mode', async () => {
    mockFs.existsSync.mockReturnValue(true);
    const original = {
      version: '0.1.0',
      mode: 'webhook',
      framework: 'grammy',
      db: { provider: 'supabase' },
      tokens: { primary: 'tok', secondary: '' },
    };
    mockFs.readFileSync.mockReturnValue(JSON.stringify(original));

    await switchMode('polling');

    const written = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
    expect(written.framework).toBe('grammy');
    expect(written.db.provider).toBe('supabase');
    expect(written.tokens.primary).toBe('tok');
  });
});
