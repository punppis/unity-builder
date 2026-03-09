const fs = require('fs');
const path = require('path');
const os = require('os');

const { fixGradleDuplicates, fixManifestDuplicates, fixAndroidProject } = require('../src/fixes/android');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ub-android-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── fixGradleDuplicates ──────────────────────────────────────────────────────

describe('fixGradleDuplicates', () => {
  it('removes duplicate implementation declarations', () => {
    const gradleFile = path.join(tmpDir, 'build.gradle');
    fs.writeFileSync(gradleFile, [
      "dependencies {",
      "    implementation 'com.google.android.gms:play-services-ads:23.0.0'",
      "    implementation 'com.google.firebase:firebase-analytics:21.0.0'",
      "    implementation 'com.google.android.gms:play-services-ads:23.0.0'",
      "}",
    ].join('\n'));

    const result = fixGradleDuplicates(gradleFile);
    expect(result.fixed).toBe(1);

    const content = fs.readFileSync(gradleFile, 'utf8');
    const matches = content.match(/play-services-ads/g);
    expect(matches).toHaveLength(1);
  });

  it('does not modify a file without duplicates', () => {
    const gradleFile = path.join(tmpDir, 'build.gradle');
    const original = [
      "dependencies {",
      "    implementation 'com.foo:bar:1.0'",
      "}",
    ].join('\n');
    fs.writeFileSync(gradleFile, original);

    const result = fixGradleDuplicates(gradleFile);
    expect(result.fixed).toBe(0);
    expect(fs.readFileSync(gradleFile, 'utf8')).toBe(original);
  });

  it('dry run does not modify the file', () => {
    const gradleFile = path.join(tmpDir, 'build.gradle');
    const original = [
      "    implementation 'com.foo:bar:1.0'",
      "    implementation 'com.foo:bar:1.0'",
    ].join('\n');
    fs.writeFileSync(gradleFile, original);

    fixGradleDuplicates(gradleFile, { dryRun: true });
    expect(fs.readFileSync(gradleFile, 'utf8')).toBe(original);
  });
});

// ─── fixManifestDuplicates ────────────────────────────────────────────────────

describe('fixManifestDuplicates', () => {
  it('removes duplicate uses-permission entries', () => {
    const manifestFile = path.join(tmpDir, 'AndroidManifest.xml');
    fs.writeFileSync(manifestFile, `<?xml version="1.0" encoding="utf-8"?>
<manifest>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.INTERNET"/>
</manifest>`);

    const result = fixManifestDuplicates(manifestFile);
    expect(result.fixed).toBe(1);

    const content = fs.readFileSync(manifestFile, 'utf8');
    const matches = content.match(/android.permission.INTERNET/g);
    expect(matches).toHaveLength(1);
  });

  it('returns zero fixed when no duplicates', () => {
    const manifestFile = path.join(tmpDir, 'AndroidManifest.xml');
    fs.writeFileSync(manifestFile, `<manifest>
  <uses-permission android:name="android.permission.INTERNET"/>
</manifest>`);
    const result = fixManifestDuplicates(manifestFile);
    expect(result.fixed).toBe(0);
  });
});

// ─── fixAndroidProject ────────────────────────────────────────────────────────

describe('fixAndroidProject', () => {
  it('returns zero fixes when no project files exist', () => {
    const result = fixAndroidProject(tmpDir, { verbose: true });
    expect(result.gradleFixes).toBe(0);
    expect(result.manifestFixes).toBe(0);
  });

  it('fixes both gradle and manifest when files exist', () => {
    // build.gradle with duplicate
    fs.writeFileSync(path.join(tmpDir, 'build.gradle'), [
      "    implementation 'com.foo:bar:1.0'",
      "    implementation 'com.foo:bar:1.0'",
    ].join('\n'));

    // AndroidManifest.xml with duplicate permission
    const manifestDir = path.join(tmpDir, 'src', 'main');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'AndroidManifest.xml'), `<manifest>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.INTERNET"/>
</manifest>`);

    const result = fixAndroidProject(tmpDir);
    expect(result.gradleFixes).toBe(1);
    expect(result.manifestFixes).toBe(1);
  });
});
