const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { fixXcodeProject } = require('../fixes/xcode');

/**
 * Build iOS project using Unity in batch mode, then archive and export with xcodebuild.
 * Pre-build Xcode fixes are applied automatically after Unity generates the project.
 * @returns {{ ipaPath: string }}
 */
function buildIos() {
  const projectPath = config.unity.projectPath;
  const unityPath = config.unity.path;
  const outputPath = path.resolve(config.build.iosOutputPath);
  const xcodeProjectPath = path.join(outputPath, 'Unity-iPhone.xcodeproj');
  const archivePath = path.join(outputPath, 'Unity-iPhone.xcarchive');
  const exportPath = path.join(outputPath, 'export');
  const exportPlistPath = path.join(outputPath, 'ExportOptions.plist');
  const logFile = path.join(outputPath, 'build-ios.log');

  fs.mkdirSync(outputPath, { recursive: true });

  // Step 1: Generate Xcode project via Unity
  const unityCmd = [
    `"${unityPath}"`,
    '-quit',
    '-batchmode',
    '-nographics',
    `-projectPath "${projectPath}"`,
    `-executeMethod ${config.unity.buildMethodIos}`,
    '-buildTarget iOS',
    `-outputPath "${outputPath}"`,
    `-logFile "${logFile}"`,
  ].join(' ');

  console.log('[ios] Generating Xcode project via Unity...');
  console.log(`[ios] Log: ${logFile}`);
  execSync(unityCmd, { stdio: 'inherit' });

  // Step 1b: Apply pre-build Xcode fixes (missing refs, duplicate frameworks, etc.)
  if (fs.existsSync(xcodeProjectPath)) {
    console.log('[ios] Applying pre-build Xcode project fixes...');
    try {
      const fixResult = fixXcodeProject(xcodeProjectPath);
      if (fixResult.missingRefs > 0 || fixResult.duplicateFrameworks > 0) {
        console.log(
          `[ios] Fixed: ${fixResult.missingRefs} missing ref(s), ${fixResult.duplicateFrameworks} duplicate framework(s)`
        );
      }
    } catch (err) {
      console.warn(`[ios] Xcode fix warning: ${err.message}`);
    }
  }

  // Step 2: Archive with xcodebuild
  console.log('[ios] Archiving with xcodebuild...');
  const archiveCmd = [
    'xcodebuild',
    'archive',
    `-project "${xcodeProjectPath}"`,
    '-scheme Unity-iPhone',
    '-configuration Release',
    `-archivePath "${archivePath}"`,
    'CODE_SIGN_IDENTITY=""',
    'CODE_SIGNING_REQUIRED=NO',
    'CODE_SIGNING_ALLOWED=NO',
  ].join(' ');
  execSync(archiveCmd, { stdio: 'inherit' });

  // Step 3: Write ExportOptions.plist for App Store distribution
  const teamId = config.apple.teamId || process.env.APPLE_TEAM_ID || '';
  const exportPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>
  <key>teamID</key>
  <string>${teamId}</string>
  <key>uploadBitcode</key>
  <false/>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>`;
  fs.writeFileSync(exportPlistPath, exportPlist, 'utf8');

  // Step 4: Export IPA
  console.log('[ios] Exporting IPA...');
  const exportCmd = [
    'xcodebuild',
    '-exportArchive',
    `-archivePath "${archivePath}"`,
    `-exportPath "${exportPath}"`,
    `-exportOptionsPlist "${exportPlistPath}"`,
  ].join(' ');
  execSync(exportCmd, { stdio: 'inherit' });

  const ipaPath = path.join(exportPath, `${config.apple.bundleId}.ipa`);
  const altIpaPath = path.join(exportPath, 'Unity-iPhone.ipa');
  const resolvedIpa = fs.existsSync(ipaPath) ? ipaPath : altIpaPath;

  if (!fs.existsSync(resolvedIpa)) {
    throw new Error(`IPA not found in export path: ${exportPath}`);
  }

  console.log(`[ios] IPA built successfully: ${resolvedIpa}`);
  return { ipaPath: resolvedIpa };
}

module.exports = { buildIos };
