const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Produce the interactive Google Play setup questions and return collected values.
 * Guides the user to create a Google Cloud service account and download the
 * JSON key file, then link it to Google Play Console.
 *
 * Does NOT directly call inquirer – callers inject `ask` so that tests can stub it.
 *
 * @param {function(questions: object[]): Promise<object>} ask
 * @returns {Promise<object>}
 */
async function gatherGoogleConfig(ask) {
  console.log('\n─── Google Play Setup ────────────────────────────────────────');
  console.log('You need a Google Cloud service account with access to the');
  console.log('Google Play Android Developer API.\n');
  console.log('Steps to create one:');
  console.log('  1. Open https://console.cloud.google.com/');
  console.log('  2. Select (or create) a project that is linked to your Google Play account');
  console.log('  3. Go to IAM & Admin → Service Accounts → Create Service Account');
  console.log('     Name: unity-builder  Role: Basic → Editor  (or a custom role)');
  console.log('  4. Create a JSON key for the service account and download it');
  console.log('  5. In Google Play Console → Setup → API access:');
  console.log('     Link to the Cloud project and grant the service account');
  console.log('     "Release manager" permission on the app\n');

  const answers = await ask([
    {
      type: 'input',
      name: 'serviceAccountKeyPath',
      message: 'Absolute path to the service account JSON key file:',
      validate: (v) => {
        if (!v.trim()) return 'Path is required';
        if (!fs.existsSync(v.trim())) return `File not found: ${v.trim()}`;
        try {
          const key = JSON.parse(fs.readFileSync(v.trim(), 'utf8'));
          if (!key.type || key.type !== 'service_account') {
            return 'File does not appear to be a service account JSON key';
          }
        } catch (_) {
          return 'File is not valid JSON';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'packageName',
      message: 'Android application Package Name (e.g. com.company.app):',
      validate: (v) => v.trim().length > 0 || 'Package name is required',
    },
    {
      type: 'list',
      name: 'track',
      message: 'Default publish track:',
      choices: ['internal', 'alpha', 'beta', 'production'],
      default: 'internal',
    },
  ]);

  return {
    serviceAccountKeyPath: answers.serviceAccountKeyPath.trim(),
    packageName: answers.packageName.trim(),
    track: answers.track,
  };
}

/**
 * Convert gathered Google config to .env key/value pairs.
 * @param {{ serviceAccountKeyPath, packageName, track }} config
 * @returns {Record<string, string>}
 */
function googleConfigToEnv(config) {
  return {
    GOOGLE_SERVICE_ACCOUNT_KEY_PATH: config.serviceAccountKeyPath,
    GOOGLE_PLAY_PACKAGE_NAME: config.packageName,
    GOOGLE_PLAY_TRACK: config.track,
  };
}

module.exports = { gatherGoogleConfig, googleConfigToEnv };
