const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

/**
 * @typedef {object} CheckResult
 * @property {string}  name    - Name of the dependency
 * @property {boolean} ok      - Whether it is installed / available
 * @property {string}  [value] - Detected version or path
 * @property {string}  [hint]  - How to install if not found
 */

/**
 * Run a command and return stdout, or null on failure.
 * @param {string} cmd
 * @returns {string|null}
 */
function tryRun(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch (_) {
    return null;
  }
}

/**
 * Check Node.js version.
 * @returns {CheckResult}
 */
function checkNode() {
  const version = tryRun('node --version');
  return {
    name: 'Node.js',
    ok: Boolean(version),
    value: version || undefined,
    hint: 'Install Node.js from https://nodejs.org',
  };
}

/**
 * Check Git.
 * @returns {CheckResult}
 */
function checkGit() {
  const version = tryRun('git --version');
  return {
    name: 'Git',
    ok: Boolean(version),
    value: version || undefined,
    hint: 'Install Git from https://git-scm.com',
  };
}

/**
 * Check Xcode / xcode-select (macOS only).
 * @returns {CheckResult}
 */
function checkXcode() {
  if (process.platform !== 'darwin') {
    return { name: 'Xcode', ok: true, value: 'n/a (not macOS)' };
  }

  const xcodePath = tryRun('xcode-select -p');
  const xcrunVersion = tryRun('xcrun --version');

  if (!xcodePath) {
    return {
      name: 'Xcode',
      ok: false,
      hint: 'Install Xcode from the Mac App Store, then run: xcode-select --install',
    };
  }

  return {
    name: 'Xcode',
    ok: true,
    value: xcodePath,
    xcrun: xcrunVersion || undefined,
  };
}

/**
 * Check that the active Xcode license has been accepted.
 * @returns {CheckResult}
 */
function checkXcodeLicense() {
  if (process.platform !== 'darwin') {
    return { name: 'Xcode license', ok: true, value: 'n/a (not macOS)' };
  }

  const result = tryRun('xcrun xcodebuild -license check 2>&1 || true');
  const accepted = !result || !result.includes('have not agreed');

  return {
    name: 'Xcode license',
    ok: accepted,
    hint: accepted ? undefined : 'Run: sudo xcodebuild -license accept',
  };
}

/**
 * Check that Ruby is available (needed by some iOS tools like CocoaPods).
 * @returns {CheckResult}
 */
function checkRuby() {
  const version = tryRun('ruby --version');
  return {
    name: 'Ruby',
    ok: Boolean(version),
    value: version || undefined,
    hint: 'Install Ruby from https://www.ruby-lang.org',
  };
}

/**
 * Check CocoaPods (optional, needed for iOS plugin resolution).
 * @returns {CheckResult}
 */
function checkCocoaPods() {
  if (process.platform !== 'darwin') {
    return { name: 'CocoaPods', ok: true, value: 'n/a (not macOS)' };
  }

  const version = tryRun('pod --version');
  return {
    name: 'CocoaPods',
    ok: Boolean(version),
    value: version ? `pod ${version}` : undefined,
    hint: 'Install CocoaPods: sudo gem install cocoapods',
  };
}

/**
 * Check the Android SDK / ANDROID_HOME.
 * @returns {CheckResult}
 */
function checkAndroidSdk() {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdkRoot || !fs.existsSync(sdkRoot)) {
    return {
      name: 'Android SDK',
      ok: false,
      hint: 'Install Android Studio and set ANDROID_HOME',
    };
  }

  return { name: 'Android SDK', ok: true, value: sdkRoot };
}

/**
 * Run all dependency checks and return results.
 * @returns {CheckResult[]}
 */
function checkAll() {
  return [
    checkNode(),
    checkGit(),
    checkXcode(),
    checkXcodeLicense(),
    checkRuby(),
    checkCocoaPods(),
    checkAndroidSdk(),
  ];
}

/**
 * Print check results to the console.
 * @param {CheckResult[]} results
 * @returns {boolean} true if all required checks passed
 */
function printResults(results) {
  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    const extra = r.value ? ` (${r.value})` : '';
    console.log(`  ${icon} ${r.name}${extra}`);
    if (!r.ok) {
      if (r.hint) console.log(`       → ${r.hint}`);
      allOk = false;
    }
  }
  return allOk;
}

module.exports = { checkAll, printResults, checkNode, checkGit, checkXcode, checkAndroidSdk };
