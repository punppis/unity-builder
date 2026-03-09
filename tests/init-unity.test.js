const path = require('path');
const os = require('os');

jest.mock('fs');

const fs = require('fs');

const {
  detectInstalledVersions,
  detectProjectUnityVersion,
  findBestMatch,
  getUnityHubEditorsPath,
} = require('../src/init/unity');

describe('getUnityHubEditorsPath', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns macOS path on darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const p = getUnityHubEditorsPath();
    expect(p).toBe('/Applications/Unity/Hub/Editor');
  });

  it('returns Windows path on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const p = getUnityHubEditorsPath();
    expect(p).toContain('Unity');
  });

  it('returns Linux path on linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const p = getUnityHubEditorsPath();
    expect(p).toContain('Hub/Editor');
  });
});

describe('detectInstalledVersions', () => {
  it('returns empty array when hub editors path does not exist', () => {
    fs.existsSync = jest.fn().mockReturnValue(false);
    const versions = detectInstalledVersions();
    expect(versions).toEqual([]);
  });

  it('returns detected versions sorted newest first', () => {
    const editorBase = getUnityHubEditorsPath();
    fs.existsSync = jest.fn((p) => {
      // Hub dir exists
      if (p === editorBase) return true;
      // Both Unity binaries exist (macOS .app bundle or direct binary)
      if (p.includes('Unity.app/Contents/MacOS/Unity') || p.endsWith('/Unity')) return true;
      return false;
    });
    fs.readdirSync = jest.fn().mockReturnValue([
      { name: '2021.3.5f1', isDirectory: () => true },
      { name: '2022.3.0f1', isDirectory: () => true },
    ]);

    const versions = detectInstalledVersions();
    expect(versions).toHaveLength(2);
    // Newest first
    expect(versions[0].version).toBe('2022.3.0f1');
    expect(versions[1].version).toBe('2021.3.5f1');
  });
});

describe('detectProjectUnityVersion', () => {
  it('returns null when ProjectVersion.txt does not exist', () => {
    fs.existsSync = jest.fn().mockReturnValue(false);
    const v = detectProjectUnityVersion('/project');
    expect(v).toBeNull();
  });

  it('parses version from ProjectVersion.txt', () => {
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readFileSync = jest.fn().mockReturnValue('m_EditorVersion: 2022.3.15f1\nm_EditorVersionWithRevision: ...');
    const v = detectProjectUnityVersion('/project');
    expect(v).toBe('2022.3.15f1');
  });
});

describe('findBestMatch', () => {
  const installed = [
    { version: '2022.3.15f1', path: '/path/2022.3.15f1/Unity' },
    { version: '2022.3.0f1',  path: '/path/2022.3.0f1/Unity'  },
    { version: '2021.3.5f1',  path: '/path/2021.3.5f1/Unity'  },
  ];

  it('returns exact match when available', () => {
    const match = findBestMatch('2022.3.0f1', installed);
    expect(match.version).toBe('2022.3.0f1');
  });

  it('returns same major.minor when exact not found', () => {
    const match = findBestMatch('2022.3.99f1', installed);
    // Should pick first 2022.3.x (newest first = 2022.3.15f1)
    expect(match.version).toBe('2022.3.15f1');
  });

  it('returns null when no match', () => {
    const match = findBestMatch('2023.1.0f1', installed);
    expect(match).toBeNull();
  });

  it('returns null for empty installed list', () => {
    const match = findBestMatch('2022.3.0f1', []);
    expect(match).toBeNull();
  });
});
