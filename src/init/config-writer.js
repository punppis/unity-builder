const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Parse an existing .env file into a key/value map.
 * Lines starting with # are ignored. Inline comments are NOT stripped
 * (values may intentionally contain #).
 * @param {string} filePath
 * @returns {Map<string, string>}
 */
function parseEnvFile(filePath) {
  const map = new Map();
  if (!fs.existsSync(filePath)) return map;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    map.set(key, value);
  }
  return map;
}

/**
 * Serialise a key/value map back to .env file format.
 * @param {Map<string, string>} map
 * @returns {string}
 */
function serialiseEnv(map) {
  const lines = [];
  for (const [key, value] of map) {
    // Quote values that contain spaces
    const needsQuotes = /\s/.test(value);
    lines.push(`${key}=${needsQuotes ? `"${value}"` : value}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Merge new values into an existing .env map.
 * Only overrides values that are non-empty in the new map.
 * @param {Map<string, string>} existing
 * @param {Record<string, string>} updates
 * @returns {Map<string, string>}
 */
function mergeValues(existing, updates) {
  const merged = new Map(existing);
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null && value !== '') {
      merged.set(key, String(value));
    }
  }
  return merged;
}

/**
 * Write (or update) a .env file at the given path.
 * If the file already exists its existing values are preserved;
 * only the supplied keys are updated / added.
 * @param {string} filePath
 * @param {Record<string, string>} values
 */
function writeEnvFile(filePath, values) {
  const existing = parseEnvFile(filePath);
  const merged = mergeValues(existing, values);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, serialiseEnv(merged), 'utf8');
  console.log(`[config] .env written to ${filePath}`);
}

module.exports = { parseEnvFile, serialiseEnv, mergeValues, writeEnvFile };
