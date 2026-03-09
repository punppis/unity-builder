const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const UNITY_HUB_EDITORS_PATH_MAC = '/Applications/Unity/Hub/Editor';
const UNITY_HUB_EDITORS_PATH_WIN = 'C:\\Program Files\\Unity\\Hub\\Editor';
const UNITY_HUB_EDITORS_PATH_LINUX = path.join(os.homedir(), 'Unity/Hub/Editor');

/**
 * Get the Unity Hub editors directory for the current platform.
 * @returns {string}
 */
function getUnityHubEditorsPath() {
  switch (process.platform) {
    case 'darwin': return UNITY_HUB_EDITORS_PATH_MAC;
    case 'win32':  return UNITY_HUB_EDITORS_PATH_WIN;
    default:       return UNITY_HUB_EDITORS_PATH_LINUX;
  }
}

/**
 * Get the Unity binary path for a given editor version directory.
 * @param {string} versionDir - full path to the version directory
 * @returns {string}
 */
function getUnityBinaryPath(versionDir) {
  switch (process.platform) {
    case 'darwin':
      return path.join(versionDir, 'Unity.app', 'Contents', 'MacOS', 'Unity');
    case 'win32':
      return path.join(versionDir, 'Editor', 'Unity.exe');
    default:
      return path.join(versionDir, 'Editor', 'Unity');
  }
}

/**
 * Detect all Unity versions installed via Unity Hub.
 * @returns {Array<{ version: string, path: string }>}
 */
function detectInstalledVersions() {
  const editorsPath = getUnityHubEditorsPath();

  if (!fs.existsSync(editorsPath)) {
    return [];
  }

  const entries = fs.readdirSync(editorsPath, { withFileTypes: true });

  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({
      version: e.name,
      path: getUnityBinaryPath(path.join(editorsPath, e.name)),
    }))
    .filter((entry) => fs.existsSync(entry.path))
    .sort((a, b) => {
      // Sort descending (newest first) using semver-like comparison
      const aParts = a.version.replace(/[a-zA-Z].*$/, '').split('.').map(Number);
      const bParts = b.version.replace(/[a-zA-Z].*$/, '').split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const diff = (bParts[i] || 0) - (aParts[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
}

/**
 * Detect the Unity version required by a project (from ProjectSettings/ProjectVersion.txt).
 * @param {string} projectPath
 * @returns {string|null}
 */
function detectProjectUnityVersion(projectPath) {
  const versionFile = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
  if (!fs.existsSync(versionFile)) {
    return null;
  }

  const content = fs.readFileSync(versionFile, 'utf8');
  const match = content.match(/m_EditorVersion:\s*(.+)/);
  return match ? match[1].trim() : null;
}

/**
 * Find the best matching installed Unity version for a project.
 * First tries an exact match, then falls back to same major.minor.
 * @param {string} projectVersion
 * @param {Array<{ version: string, path: string }>} installedVersions
 * @returns {{ version: string, path: string }|null}
 */
function findBestMatch(projectVersion, installedVersions) {
  if (!projectVersion || installedVersions.length === 0) return null;

  // Exact match
  const exact = installedVersions.find((v) => v.version === projectVersion);
  if (exact) return exact;

  // Same major.minor patch (e.g. 2022.3)
  const [major, minor] = projectVersion.split('.');
  const sameMajorMinor = installedVersions.filter((v) => {
    const parts = v.version.split('.');
    return parts[0] === major && parts[1] === minor;
  });
  if (sameMajorMinor.length > 0) return sameMajorMinor[0]; // already sorted newest first

  return null;
}

module.exports = {
  detectInstalledVersions,
  detectProjectUnityVersion,
  findBestMatch,
  getUnityHubEditorsPath,
  getUnityBinaryPath,
};
