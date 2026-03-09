const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const config = {
  unity: {
    path: process.env.UNITY_PATH || '/Applications/Unity/Hub/Editor/2022.3.0f1/Unity.app/Contents/MacOS/Unity',
    projectPath: process.env.UNITY_PROJECT_PATH || process.cwd(),
    buildMethodAndroid: process.env.UNITY_BUILD_METHOD_ANDROID || 'BuildScript.BuildAndroid',
    buildMethodIos: process.env.UNITY_BUILD_METHOD_IOS || 'BuildScript.BuildiOS',
  },
  git: {
    buildsBranch: process.env.BUILDS_BRANCH || 'builds',
  },
  build: {
    outputPath: process.env.BUILD_OUTPUT_PATH || path.join(process.cwd(), 'build'),
    androidOutputFile: process.env.ANDROID_OUTPUT_FILE || 'build/android/app.apk',
    androidAabOutputFile: process.env.ANDROID_AAB_OUTPUT_FILE || 'build/android/app.aab',
    iosOutputPath: process.env.IOS_OUTPUT_PATH || 'build/ios',
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    channel: process.env.SLACK_CHANNEL || '#builds',
  },
  smb: {
    host: process.env.SMB_HOST,
    share: process.env.SMB_SHARE,
    domain: process.env.SMB_DOMAIN || 'WORKGROUP',
    username: process.env.SMB_USERNAME,
    password: process.env.SMB_PASSWORD,
    remotePath: process.env.SMB_REMOTE_PATH || '/Android',
  },
  apple: {
    keyId: process.env.APPLE_KEY_ID,
    issuerId: process.env.APPLE_ISSUER_ID,
    privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH,
    bundleId: process.env.APPLE_BUNDLE_ID,
  },
  googlePlay: {
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME,
    track: process.env.GOOGLE_PLAY_TRACK || 'internal',
  },
};

module.exports = config;
