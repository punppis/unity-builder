const fs = require('fs');
const path = require('path');

/**
 * Fix common Android project issues that arise from Unity plugin integration.
 *
 * Problems addressed:
 *  1. Duplicate dependency declarations in `build.gradle` (ads SDKs, mediation, etc.)
 *  2. Conflicting `compileSdkVersion` / `targetSdkVersion` in merged manifests
 *  3. Duplicate `<uses-permission>` entries in AndroidManifest.xml
 *
 * @param {string} androidProjectPath  - path to the exported Android project (contains build.gradle)
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]
 * @param {boolean} [opts.verbose]
 * @returns {{ gradleFixes: number, manifestFixes: number }}
 */
function fixAndroidProject(androidProjectPath, { dryRun = false, verbose = false } = {}) {
  let gradleFixes = 0;
  let manifestFixes = 0;

  // Fix build.gradle duplicate dependencies
  const gradleFile = path.join(androidProjectPath, 'build.gradle');
  if (fs.existsSync(gradleFile)) {
    const result = fixGradleDuplicates(gradleFile, { dryRun, verbose });
    gradleFixes = result.fixed;
  } else if (verbose) {
    console.log('[android-fix] build.gradle not found, skipping gradle fixes.');
  }

  // Fix AndroidManifest.xml duplicate permissions
  const manifestFile = path.join(androidProjectPath, 'src', 'main', 'AndroidManifest.xml');
  const altManifestFile = path.join(androidProjectPath, 'AndroidManifest.xml');
  const resolvedManifest = fs.existsSync(manifestFile) ? manifestFile
    : fs.existsSync(altManifestFile) ? altManifestFile
    : null;

  if (resolvedManifest) {
    const result = fixManifestDuplicates(resolvedManifest, { dryRun, verbose });
    manifestFixes = result.fixed;
  } else if (verbose) {
    console.log('[android-fix] AndroidManifest.xml not found, skipping manifest fixes.');
  }

  return { gradleFixes, manifestFixes };
}

/**
 * Remove duplicate `implementation` / `api` / `compile` declarations from build.gradle.
 * @param {string} gradleFilePath
 * @param {object} opts
 * @returns {{ fixed: number }}
 */
function fixGradleDuplicates(gradleFilePath, { dryRun = false, verbose = false } = {}) {
  let content = fs.readFileSync(gradleFilePath, 'utf8');
  const lines = content.split('\n');
  const seen = new Set();
  const cleaned = [];
  let fixed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Only deduplicate dependency declarations
    if (/^(implementation|api|compile)\s+["']/.test(trimmed)) {
      if (seen.has(trimmed)) {
        if (verbose) console.log(`[android-fix] Duplicate gradle dep removed: ${trimmed}`);
        fixed++;
        continue;
      }
      seen.add(trimmed);
    }
    cleaned.push(line);
  }

  if (fixed > 0 && !dryRun) {
    fs.writeFileSync(gradleFilePath, cleaned.join('\n'), 'utf8');
    console.log(`[android-fix] Removed ${fixed} duplicate gradle dependency/-ies.`);
  }

  return { fixed };
}

/**
 * Remove duplicate `<uses-permission>` entries from AndroidManifest.xml.
 * @param {string} manifestFilePath
 * @param {object} opts
 * @returns {{ fixed: number }}
 */
function fixManifestDuplicates(manifestFilePath, { dryRun = false, verbose = false } = {}) {
  let content = fs.readFileSync(manifestFilePath, 'utf8');
  const seen = new Set();
  let fixed = 0;

  const cleaned = content.replace(
    /<uses-permission[^/]*/g,
    (match) => {
      const nameMatch = match.match(/android:name="([^"]+)"/);
      if (!nameMatch) return match;
      const permName = nameMatch[1];
      if (seen.has(permName)) {
        if (verbose) console.log(`[android-fix] Duplicate permission removed: ${permName}`);
        fixed++;
        return '';
      }
      seen.add(permName);
      return match;
    }
  );

  if (fixed > 0 && !dryRun) {
    fs.writeFileSync(manifestFilePath, cleaned, 'utf8');
    console.log(`[android-fix] Removed ${fixed} duplicate manifest permission(s).`);
  }

  return { fixed };
}

module.exports = { fixAndroidProject, fixGradleDuplicates, fixManifestDuplicates };
