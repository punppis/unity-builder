const fs = require('fs');
const path = require('path');

/**
 * Remove references to non-existent files from a Unity-generated Xcode project.
 *
 * Unity occasionally generates `.xcodeproj/project.pbxproj` entries that
 * reference files which no longer exist on disk (e.g. plugin stubs, deleted
 * resources).  xcodebuild then fails with "file not found" or similar errors.
 *
 * This function:
 *   1. Reads the pbxproj file
 *   2. Identifies every PBXFileReference entry
 *   3. Resolves each referenced path relative to the project root
 *   4. Collects the GUIDs of references whose file is missing
 *   5. Removes all occurrences of those GUIDs from the pbxproj
 *   6. Writes the cleaned file back
 *
 * @param {string} xcodeProjectPath  - path to the `.xcodeproj` directory
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]    - if true, report problems but don't write
 * @param {boolean} [opts.verbose]   - extra logging
 * @returns {{ fixed: number, removed: string[] }}  number of removed references
 */
function fixMissingFileReferences(xcodeProjectPath, { dryRun = false, verbose = false } = {}) {
  const pbxprojPath = path.join(xcodeProjectPath, 'project.pbxproj');

  if (!fs.existsSync(pbxprojPath)) {
    throw new Error(`project.pbxproj not found: ${pbxprojPath}`);
  }

  const projectRoot = path.dirname(xcodeProjectPath);
  let content = fs.readFileSync(pbxprojPath, 'utf8');

  // Regex to capture PBXFileReference blocks
  // Pattern: <GUID> /* name */ = {isa = PBXFileReference; ... path = "some/path"; ... };
  const fileRefPattern =
    /([0-9A-F]{24})\s+\/\*[^*]*\*\/\s*=\s*\{[^}]*isa\s*=\s*PBXFileReference;[^}]*\}/g;

  const missingGuids = new Set();
  const removedPaths = [];

  let match;
  while ((match = fileRefPattern.exec(content)) !== null) {
    const guid = match[1];
    const block = match[0];

    // Extract path value (may be quoted or unquoted)
    const pathMatch = block.match(/\bpath\s*=\s*("([^"]+)"|([^;"\s]+))/);
    if (!pathMatch) continue;
    const refPath = pathMatch[2] || pathMatch[3];

    // Resolve: absolute paths stay absolute; relative paths are relative to project root
    const absPath = path.isAbsolute(refPath) ? refPath : path.join(projectRoot, refPath);

    if (!fs.existsSync(absPath)) {
      missingGuids.add(guid);
      removedPaths.push(refPath);
      if (verbose) {
        console.log(`[xcode-fix] Missing file: ${refPath} (GUID ${guid})`);
      }
    }
  }

  if (missingGuids.size === 0) {
    if (verbose) console.log('[xcode-fix] No missing file references found.');
    return { fixed: 0, removed: [] };
  }

  console.log(`[xcode-fix] Removing ${missingGuids.size} missing file reference(s)...`);

  if (!dryRun) {
    for (const guid of missingGuids) {
      // Remove the full PBXFileReference line
      content = content.replace(
        new RegExp(`\\s*${guid}\\s+\\/\\*[^*]*\\*\\/\\s*=\\s*\\{[^}]*\\};`, 'g'),
        ''
      );

      // Remove any remaining GUID reference (e.g. in build phases or groups)
      content = content.replace(new RegExp(`\\s*${guid}\\s+\\/\\*[^*]*\\*\\/,?`, 'g'), '');
    }

    fs.writeFileSync(pbxprojPath, content, 'utf8');
    console.log('[xcode-fix] project.pbxproj updated.');
  }

  return { fixed: missingGuids.size, removed: removedPaths };
}

/**
 * Remove duplicate framework entries from a pbxproj to avoid "multiple commands
 * produce" linker errors that can arise from Unity plugin integration.
 *
 * @param {string} xcodeProjectPath
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]
 * @param {boolean} [opts.verbose]
 * @returns {{ fixed: number }}
 */
function fixDuplicateFrameworks(xcodeProjectPath, { dryRun = false, verbose = false } = {}) {
  const pbxprojPath = path.join(xcodeProjectPath, 'project.pbxproj');
  if (!fs.existsSync(pbxprojPath)) {
    throw new Error(`project.pbxproj not found: ${pbxprojPath}`);
  }

  let content = fs.readFileSync(pbxprojPath, 'utf8');

  // Find all framework file references by name
  const frameworkPattern = /([0-9A-F]{24})\s+\/\*\s*([^*]+\.framework)\s*\*\/\s*=\s*\{[^}]*isa\s*=\s*PBXFileReference;[^}]*\}/g;

  const seen = new Map(); // framework name → first GUID
  const duplicateGuids = new Set();

  let match;
  while ((match = frameworkPattern.exec(content)) !== null) {
    const guid = match[1];
    const name = match[2].trim();
    if (seen.has(name)) {
      duplicateGuids.add(guid);
      if (verbose) {
        console.log(`[xcode-fix] Duplicate framework: ${name} (GUID ${guid})`);
      }
    } else {
      seen.set(name, guid);
    }
  }

  if (duplicateGuids.size === 0) {
    return { fixed: 0 };
  }

  console.log(`[xcode-fix] Removing ${duplicateGuids.size} duplicate framework reference(s)...`);

  if (!dryRun) {
    for (const guid of duplicateGuids) {
      content = content.replace(
        new RegExp(`\\s*${guid}\\s+\\/\\*[^*]*\\*\\/\\s*=\\s*\\{[^}]*\\};`, 'g'),
        ''
      );
      content = content.replace(new RegExp(`\\s*${guid}\\s+\\/\\*[^*]*\\*\\/,?`, 'g'), '');
    }
    fs.writeFileSync(pbxprojPath, content, 'utf8');
    console.log('[xcode-fix] Duplicate frameworks removed.');
  }

  return { fixed: duplicateGuids.size };
}

/**
 * Run all Xcode project fixes.
 * @param {string} xcodeProjectPath
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]
 * @param {boolean} [opts.verbose]
 * @returns {{ missingRefs: number, duplicateFrameworks: number }}
 */
function fixXcodeProject(xcodeProjectPath, opts = {}) {
  console.log(`[xcode-fix] Fixing Xcode project: ${xcodeProjectPath}`);
  const refs = fixMissingFileReferences(xcodeProjectPath, opts);
  const dups = fixDuplicateFrameworks(xcodeProjectPath, opts);
  return { missingRefs: refs.fixed, duplicateFrameworks: dups.fixed };
}

module.exports = {
  fixXcodeProject,
  fixMissingFileReferences,
  fixDuplicateFrameworks,
};
