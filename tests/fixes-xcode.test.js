const fs = require('fs');
const path = require('path');
const os = require('os');

const { fixMissingFileReferences, fixDuplicateFrameworks, fixXcodeProject } = require('../src/fixes/xcode');

// Use a temp dir so we don't need to mock fs
let tmpDir;
let xcodeProjectPath;
let pbxprojPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unity-builder-test-'));
  xcodeProjectPath = path.join(tmpDir, 'Unity-iPhone.xcodeproj');
  fs.mkdirSync(xcodeProjectPath);
  pbxprojPath = path.join(xcodeProjectPath, 'project.pbxproj');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Helpers
function writePbxproj(content) {
  fs.writeFileSync(pbxprojPath, content, 'utf8');
}

function readPbxproj() {
  return fs.readFileSync(pbxprojPath, 'utf8');
}

// ─── fixMissingFileReferences ─────────────────────────────────────────────────

describe('fixMissingFileReferences', () => {
  it('throws when project.pbxproj is missing', () => {
    fs.rmSync(pbxprojPath, { force: true });
    expect(() => fixMissingFileReferences(xcodeProjectPath)).toThrow('project.pbxproj not found');
  });

  it('returns zero fixed when all referenced files exist', () => {
    // Create the referenced file
    const refFile = path.join(tmpDir, 'existing.m');
    fs.writeFileSync(refFile, '', 'utf8');

    writePbxproj(`
      AABBCCDDEEFF00112233445500 /* existing.m */ = {isa = PBXFileReference; path = existing.m; };
    `);

    const result = fixMissingFileReferences(xcodeProjectPath);
    expect(result.fixed).toBe(0);
    expect(result.removed).toHaveLength(0);
  });

  it('removes reference to a non-existent file', () => {
    writePbxproj(`
AABBCCDDEEFF00112233445500 /* missing.m */ = {isa = PBXFileReference; path = "missing.m"; };
AABBCCDDEEFF001122334455FF /* missing.m */ ,
    `);

    const result = fixMissingFileReferences(xcodeProjectPath);
    expect(result.fixed).toBe(1);
    expect(result.removed).toContain('missing.m');

    const content = readPbxproj();
    expect(content).not.toContain('AABBCCDDEEFF00112233445500');
  });

  it('dry run does not write file', () => {
    const original = `
AABBCCDDEEFF00112233445500 /* ghost.m */ = {isa = PBXFileReference; path = ghost.m; };
    `;
    writePbxproj(original);

    fixMissingFileReferences(xcodeProjectPath, { dryRun: true });

    const content = readPbxproj();
    expect(content).toBe(original);
  });
});

// ─── fixDuplicateFrameworks ───────────────────────────────────────────────────

describe('fixDuplicateFrameworks', () => {
  it('returns zero fixed when no duplicates', () => {
    writePbxproj(`
      AAAAAA000000000000000001 /* GoogleMobileAds.framework */ = {isa = PBXFileReference; name = GoogleMobileAds.framework; };
    `);
    const result = fixDuplicateFrameworks(xcodeProjectPath);
    expect(result.fixed).toBe(0);
  });

  it('removes duplicate framework reference', () => {
    writePbxproj(`
      AAAAAA000000000000000001 /* GoogleMobileAds.framework */ = {isa = PBXFileReference; name = GoogleMobileAds.framework; };
      AAAAAA000000000000000002 /* GoogleMobileAds.framework */ = {isa = PBXFileReference; name = GoogleMobileAds.framework; };
      AAAAAA000000000000000002 /* GoogleMobileAds.framework */ ,
    `);
    const result = fixDuplicateFrameworks(xcodeProjectPath);
    expect(result.fixed).toBe(1);

    const content = readPbxproj();
    expect(content).not.toContain('AAAAAA000000000000000002');
  });
});

// ─── fixXcodeProject ─────────────────────────────────────────────────────────

describe('fixXcodeProject', () => {
  it('runs both fixes and returns combined counts', () => {
    writePbxproj(`
AABBCCDDEEFF00112233445500 /* missing.m */ = {isa = PBXFileReference; path = "missing.m"; };
    `);
    const result = fixXcodeProject(xcodeProjectPath);
    expect(typeof result.missingRefs).toBe('number');
    expect(typeof result.duplicateFrameworks).toBe('number');
    expect(result.missingRefs).toBe(1);
  });
});
