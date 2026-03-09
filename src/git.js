const { execSync, spawn } = require('child_process');
const path = require('path');

/**
 * Run a shell command synchronously with output forwarded to the console.
 * @param {string} cmd
 * @param {object} opts
 */
function run(cmd, opts = {}) {
  console.log(`[git] ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

/**
 * Pull the latest changes on the current branch.
 * @param {string} repoPath
 */
function pull(repoPath) {
  run('git pull', { cwd: repoPath });
}

/**
 * Checkout a specific branch or commit.
 * @param {string} repoPath
 * @param {string} ref - branch name or commit SHA
 */
function checkout(repoPath, ref) {
  run(`git checkout ${ref}`, { cwd: repoPath });
}

/**
 * Remove untracked files and reset working directory to the committed state.
 * @param {string} repoPath
 */
function clean(repoPath) {
  run('git clean -fdx', { cwd: repoPath });
  run('git reset --hard HEAD', { cwd: repoPath });
}

/**
 * Force-push the current state to the builds branch.
 * @param {string} repoPath
 * @param {string} buildsBranch
 */
function forcePushToBuildsBranch(repoPath, buildsBranch) {
  run(`git push origin HEAD:${buildsBranch} --force`, { cwd: repoPath });
}

/**
 * Get the current commit SHA.
 * @param {string} repoPath
 * @returns {string}
 */
function getCurrentCommit(repoPath) {
  return execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();
}

/**
 * Get the current branch name.
 * @param {string} repoPath
 * @returns {string}
 */
function getCurrentBranch(repoPath) {
  return execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath }).toString().trim();
}

module.exports = {
  pull,
  checkout,
  clean,
  forcePushToBuildsBranch,
  getCurrentCommit,
  getCurrentBranch,
};
