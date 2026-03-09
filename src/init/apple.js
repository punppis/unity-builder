const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Open a URL in the default browser.
 * @param {string} url
 */
function openBrowser(url) {
  try {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${cmd} "${url}"`);
  } catch (_) {
    // Non-fatal: user can open manually
  }
}

/**
 * Produce the interactive Apple App Store Connect setup questions and
 * return the collected values.
 *
 * Returns { keyId, issuerId, privateKeyPath, bundleId, teamId }
 *
 * Does NOT directly call inquirer – callers inject `ask` so that tests can
 * stub it easily.
 *
 * @param {function(questions: object[]): Promise<object>} ask - inquirer.prompt compatible function
 * @returns {Promise<object>}
 */
async function gatherAppleConfig(ask) {
  console.log('\n─── Apple App Store Connect Setup ───────────────────────────');
  console.log('You need an App Store Connect API key with Developer role or higher.');
  console.log('To create one:');
  console.log('  1. Open https://appstoreconnect.apple.com/access/api');
  console.log('  2. Click "+" to add a new key');
  console.log('  3. Give it a name and set role to "Developer" (or Admin)');
  console.log('  4. Download the .p8 file – you can only download it ONCE\n');

  // Attempt to open the browser automatically
  openBrowser('https://appstoreconnect.apple.com/access/api');

  const answers = await ask([
    {
      type: 'input',
      name: 'keyId',
      message: 'App Store Connect API Key ID (e.g. ABC123DEFG):',
      validate: (v) => v.trim().length > 0 || 'Key ID is required',
    },
    {
      type: 'input',
      name: 'issuerId',
      message: 'App Store Connect Issuer ID (UUID shown on the API Keys page):',
      validate: (v) => v.trim().length > 0 || 'Issuer ID is required',
    },
    {
      type: 'input',
      name: 'privateKeyPath',
      message: 'Absolute path to the downloaded .p8 file:',
      validate: (v) => {
        if (!v.trim()) return 'Path is required';
        if (!fs.existsSync(v.trim())) return `File not found: ${v.trim()}`;
        return true;
      },
    },
    {
      type: 'input',
      name: 'bundleId',
      message: 'iOS Bundle ID (e.g. com.company.app):',
      validate: (v) => v.trim().length > 0 || 'Bundle ID is required',
    },
    {
      type: 'input',
      name: 'teamId',
      message: 'Apple Team ID (found at developer.apple.com → Membership):',
      validate: (v) => v.trim().length > 0 || 'Team ID is required',
    },
  ]);

  return {
    keyId: answers.keyId.trim(),
    issuerId: answers.issuerId.trim(),
    privateKeyPath: answers.privateKeyPath.trim(),
    bundleId: answers.bundleId.trim(),
    teamId: answers.teamId.trim(),
  };
}

/**
 * Convert gathered Apple config to .env key/value pairs.
 * @param {{ keyId, issuerId, privateKeyPath, bundleId, teamId }} config
 * @returns {Record<string, string>}
 */
function appleConfigToEnv(config) {
  return {
    APPLE_KEY_ID: config.keyId,
    APPLE_ISSUER_ID: config.issuerId,
    APPLE_PRIVATE_KEY_PATH: config.privateKeyPath,
    APPLE_BUNDLE_ID: config.bundleId,
    APPLE_TEAM_ID: config.teamId,
  };
}

module.exports = { gatherAppleConfig, appleConfigToEnv, openBrowser };
