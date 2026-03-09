const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Build Android APK and/or AAB using Unity in batch mode.
 * @param {object} options
 * @param {boolean} options.buildApk  - whether to build APK
 * @param {boolean} options.buildAab  - whether to build AAB
 * @returns {{ apkPath: string|null, aabPath: string|null }}
 */
function buildAndroid({ buildApk = true, buildAab = false } = {}) {
  const projectPath = config.unity.projectPath;
  const unityPath = config.unity.path;
  const outputPath = config.build.outputPath;

  fs.mkdirSync(path.join(outputPath, 'android'), { recursive: true });

  const results = { apkPath: null, aabPath: null };

  if (buildApk) {
    const apkOut = path.resolve(config.build.androidOutputFile);
    const logFile = path.join(outputPath, 'android', 'build-apk.log');
    const cmd = [
      `"${unityPath}"`,
      '-quit',
      '-batchmode',
      '-nographics',
      `-projectPath "${projectPath}"`,
      `-executeMethod ${config.unity.buildMethodAndroid}`,
      `-buildTarget Android`,
      `-outputFile "${apkOut}"`,
      `-logFile "${logFile}"`,
    ].join(' ');

    console.log('[android] Building APK...');
    console.log(`[android] Log: ${logFile}`);
    execSync(cmd, { stdio: 'inherit' });

    if (fs.existsSync(apkOut)) {
      console.log(`[android] APK built successfully: ${apkOut}`);
      results.apkPath = apkOut;
    } else {
      throw new Error(`APK not found at expected path: ${apkOut}`);
    }
  }

  if (buildAab) {
    const aabOut = path.resolve(config.build.androidAabOutputFile);
    const logFile = path.join(outputPath, 'android', 'build-aab.log');
    const cmd = [
      `"${unityPath}"`,
      '-quit',
      '-batchmode',
      '-nographics',
      `-projectPath "${projectPath}"`,
      `-executeMethod ${config.unity.buildMethodAndroid}`,
      `-buildTarget Android`,
      `-outputFile "${aabOut}"`,
      '-buildAppBundle',
      `-logFile "${logFile}"`,
    ].join(' ');

    console.log('[android] Building AAB...');
    console.log(`[android] Log: ${logFile}`);
    execSync(cmd, { stdio: 'inherit' });

    if (fs.existsSync(aabOut)) {
      console.log(`[android] AAB built successfully: ${aabOut}`);
      results.aabPath = aabOut;
    } else {
      throw new Error(`AAB not found at expected path: ${aabOut}`);
    }
  }

  return results;
}

module.exports = { buildAndroid };
