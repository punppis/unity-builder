const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseEnvFile, serialiseEnv, mergeValues, writeEnvFile } = require('../src/init/config-writer');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ub-config-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('parseEnvFile', () => {
  it('returns empty map for non-existent file', () => {
    const map = parseEnvFile(path.join(tmpDir, 'nonexistent.env'));
    expect(map.size).toBe(0);
  });

  it('parses key=value pairs', () => {
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, 'FOO=bar\nBAZ=qux\n');
    const map = parseEnvFile(envFile);
    expect(map.get('FOO')).toBe('bar');
    expect(map.get('BAZ')).toBe('qux');
  });

  it('ignores comment lines', () => {
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, '# comment\nKEY=value\n');
    const map = parseEnvFile(envFile);
    expect(map.has('#')).toBe(false);
    expect(map.get('KEY')).toBe('value');
  });

  it('strips surrounding quotes from values', () => {
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, 'A="hello world"\nB=\'foo\'\n');
    const map = parseEnvFile(envFile);
    expect(map.get('A')).toBe('hello world');
    expect(map.get('B')).toBe('foo');
  });
});

describe('mergeValues', () => {
  it('adds new keys', () => {
    const base = new Map([['A', '1']]);
    const merged = mergeValues(base, { B: '2' });
    expect(merged.get('A')).toBe('1');
    expect(merged.get('B')).toBe('2');
  });

  it('overrides existing keys', () => {
    const base = new Map([['A', 'old']]);
    const merged = mergeValues(base, { A: 'new' });
    expect(merged.get('A')).toBe('new');
  });

  it('does not override with empty string', () => {
    const base = new Map([['A', 'keep']]);
    const merged = mergeValues(base, { A: '' });
    expect(merged.get('A')).toBe('keep');
  });

  it('does not override with undefined', () => {
    const base = new Map([['A', 'keep']]);
    const merged = mergeValues(base, { A: undefined });
    expect(merged.get('A')).toBe('keep');
  });
});

describe('writeEnvFile', () => {
  it('creates a new .env file with the given values', () => {
    const envFile = path.join(tmpDir, '.env');
    writeEnvFile(envFile, { FOO: 'bar', BAZ: 'qux' });
    expect(fs.existsSync(envFile)).toBe(true);
    const content = fs.readFileSync(envFile, 'utf8');
    expect(content).toContain('FOO=bar');
    expect(content).toContain('BAZ=qux');
  });

  it('merges into an existing .env file without losing other keys', () => {
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, 'EXISTING=keep\n');
    writeEnvFile(envFile, { NEW: 'value' });
    const content = fs.readFileSync(envFile, 'utf8');
    expect(content).toContain('EXISTING=keep');
    expect(content).toContain('NEW=value');
  });
});
