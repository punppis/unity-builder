const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const config = require('../config');

/**
 * Authenticate with the Google Play API using a service account key file.
 * @returns {Promise<import('googleapis').Auth.GoogleAuth>}
 */
async function getAuthClient() {
  if (!config.googlePlay.serviceAccountKeyPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH is not configured');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: config.googlePlay.serviceAccountKeyPath,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  return auth;
}

/**
 * Upload an AAB to Google Play and (optionally) retrieve the Google-signed APK.
 * @param {string} aabPath           - absolute path to the .aab file
 * @param {object} options
 * @param {boolean} options.downloadSignedApk - whether to download the Google-signed APK after upload
 * @param {string}  options.signedApkOutputDir - directory to save the signed APK
 * @returns {Promise<{ uploadResult: object, signedApkPath: string|null }>}
 */
async function uploadToGooglePlay(aabPath, { downloadSignedApk = false, signedApkOutputDir } = {}) {
  console.log('[googleplay] Uploading AAB to Google Play...');

  const auth = await getAuthClient();
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });
  const packageName = config.googlePlay.packageName;

  if (!packageName) {
    throw new Error('GOOGLE_PLAY_PACKAGE_NAME is not configured');
  }

  // Step 1: Create an edit
  const editRes = await androidpublisher.edits.insert({ packageName });
  const editId = editRes.data.id;
  console.log(`[googleplay] Created edit ${editId}`);

  try {
    // Step 2: Upload the AAB
    const aabMedia = {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(aabPath),
    };

    const bundleRes = await androidpublisher.edits.bundles.upload({
      packageName,
      editId,
      media: aabMedia,
    });
    const versionCode = bundleRes.data.versionCode;
    console.log(`[googleplay] AAB uploaded (versionCode: ${versionCode})`);

    // Step 3: Assign to track
    await androidpublisher.edits.tracks.update({
      packageName,
      editId,
      track: config.googlePlay.track,
      requestBody: {
        track: config.googlePlay.track,
        releases: [
          {
            versionCodes: [versionCode],
            status: 'draft',
          },
        ],
      },
    });
    console.log(`[googleplay] Assigned to track: ${config.googlePlay.track}`);

    // Step 4: Commit the edit
    await androidpublisher.edits.commit({ packageName, editId });
    console.log('[googleplay] Edit committed');

    let signedApkPath = null;

    // Step 5 (bonus): Download Google-signed APK
    if (downloadSignedApk) {
      signedApkPath = await downloadGoogleSignedApk(
        androidpublisher,
        packageName,
        versionCode,
        signedApkOutputDir || path.dirname(aabPath)
      );
    }

    return { uploadResult: bundleRes.data, signedApkPath };
  } catch (err) {
    // Delete the edit on failure to avoid stale edits
    try {
      await androidpublisher.edits.delete({ packageName, editId });
    } catch (_) {
      // ignore cleanup error
    }
    throw err;
  }
}

/**
 * Download the Google-signed APK for a given version code.
 * @param {object} androidpublisher
 * @param {string} packageName
 * @param {number} versionCode
 * @param {string} outputDir
 * @returns {Promise<string>} path to downloaded APK
 */
async function downloadGoogleSignedApk(androidpublisher, packageName, versionCode, outputDir) {
  console.log('[googleplay] Fetching Google-signed APK...');

  const apksRes = await androidpublisher.generatedapks.list({ packageName, versionCode });
  const apks = apksRes.data.generatedApks || [];

  if (apks.length === 0) {
    console.warn('[googleplay] No Google-signed APKs available yet (may take a few minutes)');
    return null;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const downloadedPaths = [];

  for (const apk of apks) {
    if (!apk.downloadId) continue;
    const downloadId = apk.downloadId;
    const outputFile = path.join(outputDir, `signed-${downloadId}.apk`);

    const response = await androidpublisher.generatedapks.download(
      { packageName, versionCode, downloadId },
      { responseType: 'stream' }
    );

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(outputFile);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[googleplay] Downloaded signed APK: ${outputFile}`);
    downloadedPaths.push(outputFile);
  }

  return downloadedPaths.length > 0 ? downloadedPaths[0] : null;
}

module.exports = { uploadToGooglePlay };
