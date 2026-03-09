const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');

const APP_STORE_CONNECT_BASE = 'https://api.appstoreconnect.apple.com/v1';

/**
 * Generate a signed JWT for the App Store Connect API.
 * @returns {string}
 */
function generateToken() {
  if (!config.apple.keyId || !config.apple.issuerId || !config.apple.privateKeyPath) {
    throw new Error(
      'Apple credentials not configured. Set APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY_PATH'
    );
  }

  const privateKey = fs.readFileSync(config.apple.privateKeyPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: config.apple.issuerId,
      iat: now,
      exp: now + 20 * 60, // 20 minutes
      aud: 'appstoreconnect-v1',
    },
    privateKey,
    {
      algorithm: 'ES256',
      header: { alg: 'ES256', kid: config.apple.keyId, typ: 'JWT' },
    }
  );
}

/**
 * Upload an IPA to TestFlight via App Store Connect API.
 * @param {string} ipaPath - absolute path to the .ipa file
 * @returns {Promise<void>}
 */
async function uploadToTestFlight(ipaPath) {
  console.log('[appstore] Uploading IPA to TestFlight...');

  const token = generateToken();
  const authHeader = { Authorization: `Bearer ${token}` };

  // Step 1: Look up the app
  const appsRes = await axios.get(`${APP_STORE_CONNECT_BASE}/apps`, {
    headers: authHeader,
    params: { 'filter[bundleId]': config.apple.bundleId },
  });

  const apps = appsRes.data.data;
  if (!apps || apps.length === 0) {
    throw new Error(`No app found for bundle ID: ${config.apple.bundleId}`);
  }
  const appId = apps[0].id;

  // Step 2: Reserve a build upload
  const reserveRes = await axios.post(
    `${APP_STORE_CONNECT_BASE}/uploadOperations`,
    {
      data: {
        type: 'uploadOperations',
        attributes: {
          contentType: 'application/octet-stream',
          md5: null,
          size: fs.statSync(ipaPath).size,
          fileName: path.basename(ipaPath),
          appId,
        },
      },
    },
    { headers: { ...authHeader, 'Content-Type': 'application/json' } }
  );

  // Step 3: Upload the file using the returned upload operations
  const uploadOps = reserveRes.data.data.attributes.uploadOperations || [];
  for (const op of uploadOps) {
    const fileBuffer = fs.readFileSync(ipaPath);
    await axios({
      method: op.method,
      url: op.url,
      data: fileBuffer.slice(op.offset, op.offset + op.length),
      headers: (op.requestHeaders || []).reduce((acc, h) => {
        acc[h.name] = h.value;
        return acc;
      }, {}),
    });
  }

  console.log(`[appstore] IPA uploaded to TestFlight for app ${appId}`);
}

module.exports = { uploadToTestFlight };
