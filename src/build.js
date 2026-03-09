const git = require('./git');
const { buildAndroid } = require('./builders/android');
const { buildIos } = require('./builders/ios');
const { postBuildNotification } = require('./post-build/slack');
const { uploadToSmb } = require('./post-build/smb');
const { uploadToTestFlight } = require('./post-build/appstore');
const { uploadToGooglePlay } = require('./post-build/googleplay');
const config = require('./config');

/**
 * Run the full build pipeline:
 *   1. Pull / checkout the target branch or commit
 *   2. Clean the working directory
 *   3. Build for Android and/or iOS
 *   4. Execute post-build actions (SMB upload, Slack, TestFlight, Google Play)
 *
 * @param {object} options
 * @param {string}  options.repoPath         - absolute path to the Unity project / git repo
 * @param {string}  [options.ref]            - branch name or commit SHA to build
 * @param {boolean} [options.android]        - build for Android
 * @param {boolean} [options.ios]            - build for iOS
 * @param {boolean} [options.aab]            - also build AAB (Android)
 * @param {boolean} [options.uploadSmb]      - upload Android artifacts to SMB
 * @param {boolean} [options.uploadSlack]    - post Slack notification
 * @param {boolean} [options.uploadTestFlight] - upload iOS IPA to TestFlight
 * @param {boolean} [options.uploadGooglePlay] - upload AAB to Google Play
 * @param {boolean} [options.downloadSignedApk] - download Google-signed APK after GP upload
 */
async function runBuildPipeline({
  repoPath,
  ref,
  android = true,
  ios = false,
  aab = false,
  uploadSmb = false,
  uploadSlack = false,
  uploadTestFlight = false,
  uploadGooglePlay = false,
  downloadSignedApk = false,
} = {}) {
  const branch = ref || git.getCurrentBranch(repoPath);
  let commit;

  // ── Step 1: Pull / checkout ──────────────────────────────────────────────
  console.log('\n=== Step 1: Pull / Checkout ===');
  if (ref) {
    git.checkout(repoPath, ref);
  } else {
    git.pull(repoPath);
  }
  commit = git.getCurrentCommit(repoPath);
  console.log(`[build] Building branch=${branch} commit=${commit}`);

  // ── Step 2: Clean ────────────────────────────────────────────────────────
  console.log('\n=== Step 2: Clean ===');
  git.clean(repoPath);

  // ── Step 3: Build ────────────────────────────────────────────────────────
  console.log('\n=== Step 3: Build ===');

  let apkPath = null;
  let aabPath = null;
  let ipaPath = null;

  try {
    if (android) {
      const androidResult = await buildAndroid({ buildApk: true, buildAab: aab });
      apkPath = androidResult.apkPath;
      aabPath = androidResult.aabPath;
    }

    if (ios) {
      const iosResult = await buildIos();
      ipaPath = iosResult.ipaPath;
    }
  } catch (err) {
    console.error('[build] Build failed:', err.message);

    if (uploadSlack) {
      await postBuildNotification({
        branch,
        commit,
        status: 'failure',
        error: err.message,
      }).catch((slackErr) => console.error('[slack] Failed to post failure notification:', slackErr.message));
    }

    throw err;
  }

  // ── Step 4: Post-build actions ───────────────────────────────────────────
  console.log('\n=== Step 4: Post-build Actions ===');

  let apkSmbUrl = null;

  // SMB upload (Android)
  if (uploadSmb && apkPath) {
    try {
      apkSmbUrl = await uploadToSmb(apkPath);
    } catch (err) {
      console.error('[smb] Upload failed:', err.message);
    }
  }

  if (uploadSmb && aabPath) {
    try {
      await uploadToSmb(aabPath);
    } catch (err) {
      console.error('[smb] AAB upload failed:', err.message);
    }
  }

  // Google Play upload (AAB)
  let signedApkPath = null;
  if (uploadGooglePlay && aabPath) {
    try {
      const gpResult = await uploadToGooglePlay(aabPath, { downloadSignedApk });
      signedApkPath = gpResult.signedApkPath;
    } catch (err) {
      console.error('[googleplay] Upload failed:', err.message);
    }
  }

  // TestFlight upload (iOS)
  if (uploadTestFlight && ipaPath) {
    try {
      await uploadToTestFlight(ipaPath);
    } catch (err) {
      console.error('[appstore] TestFlight upload failed:', err.message);
    }
  }

  // Slack notification
  if (uploadSlack) {
    try {
      await postBuildNotification({
        branch,
        commit,
        apkPath,
        aabPath,
        apkUrl: apkSmbUrl,
        status: 'success',
      });
    } catch (err) {
      console.error('[slack] Notification failed:', err.message);
    }
  }

  const result = {
    branch,
    commit,
    apkPath,
    aabPath,
    ipaPath,
    apkSmbUrl,
    signedApkPath,
  };

  console.log('\n=== Build pipeline complete ===');
  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = { runBuildPipeline };
