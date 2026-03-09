const os = require('os');
const path = require('path');

jest.mock('child_process', () => ({ execSync: jest.fn() }));
jest.mock('fs');

const fs = require('fs');
const { execSync } = require('child_process');

// Import after mocks
const { checkNode, checkGit, checkXcode, checkAndroidSdk, checkAll, printResults } = require('../src/init/system');

beforeEach(() => {
  jest.resetAllMocks();
  // Default: all commands succeed
  execSync.mockReturnValue(Buffer.from('v20.0.0'));
  fs.existsSync = jest.fn().mockReturnValue(true);
});

describe('checkNode', () => {
  it('returns ok when node is available', () => {
    execSync.mockReturnValue(Buffer.from('v20.0.0\n'));
    const result = checkNode();
    expect(result.ok).toBe(true);
    expect(result.name).toBe('Node.js');
  });

  it('returns not-ok when node command fails', () => {
    execSync.mockImplementation(() => { throw new Error('not found'); });
    const result = checkNode();
    expect(result.ok).toBe(false);
    expect(result.hint).toBeDefined();
  });
});

describe('checkGit', () => {
  it('returns ok when git is available', () => {
    execSync.mockReturnValue(Buffer.from('git version 2.40.0\n'));
    const result = checkGit();
    expect(result.ok).toBe(true);
  });

  it('returns not-ok when git is not found', () => {
    execSync.mockImplementation(() => { throw new Error('not found'); });
    const result = checkGit();
    expect(result.ok).toBe(false);
  });
});

describe('checkXcode', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns n/a on non-macOS', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const result = checkXcode();
    expect(result.ok).toBe(true);
    expect(result.value).toMatch(/n\/a/);
  });

  it('returns ok with path when xcode-select succeeds on macOS', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    execSync.mockReturnValue(Buffer.from('/Applications/Xcode.app/Contents/Developer\n'));
    const result = checkXcode();
    expect(result.ok).toBe(true);
  });

  it('returns not-ok when xcode-select fails on macOS', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    execSync.mockImplementation(() => { throw new Error('not found'); });
    const result = checkXcode();
    expect(result.ok).toBe(false);
    expect(result.hint).toBeDefined();
  });
});

describe('checkAndroidSdk', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns ok when ANDROID_HOME is set and the directory exists', () => {
    process.env = { ...originalEnv, ANDROID_HOME: '/sdk' };
    fs.existsSync = jest.fn().mockReturnValue(true);
    const result = checkAndroidSdk();
    expect(result.ok).toBe(true);
    expect(result.value).toBe('/sdk');
  });

  it('returns not-ok when ANDROID_HOME is not set', () => {
    process.env = { ...originalEnv };
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
    const result = checkAndroidSdk();
    expect(result.ok).toBe(false);
  });
});

describe('printResults', () => {
  it('returns true when all checks pass', () => {
    const results = [
      { name: 'Node.js', ok: true, value: 'v20' },
      { name: 'Git',     ok: true, value: 'git 2.40' },
    ];
    const allOk = printResults(results);
    expect(allOk).toBe(true);
  });

  it('returns false when any check fails', () => {
    const results = [
      { name: 'Node.js', ok: true },
      { name: 'Xcode',   ok: false, hint: 'Install Xcode' },
    ];
    const allOk = printResults(results);
    expect(allOk).toBe(false);
  });
});
