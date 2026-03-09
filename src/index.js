#!/usr/bin/env node

'use strict';

require('dotenv').config();

const { Command } = require('commander');
const path = require('path');
const { runBuildPipeline } = require('./build');
const git = require('./git');
const config = require('./config');

const program = new Command();

program
  .name('unity-builder')
  .description('CLI tool for building Unity projects for Android and iOS')
  .version('1.0.0');

// ─────────────────────────────────────────────────────────────────────────────
// build command
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('build')
  .description('Run the full build pipeline (pull → clean → build → post-build actions)')
  .option('--repo <path>',      'Path to the Unity project / git repo', process.cwd())
  .option('--ref <ref>',        'Branch name or commit SHA to build (default: current HEAD)')
  .option('--android',          'Build for Android (APK)', false)
  .option('--ios',              'Build for iOS (IPA)',     false)
  .option('--aab',              'Also build Android App Bundle (AAB)', false)
  .option('--smb',              'Upload Android artifacts to SMB share', false)
  .option('--slack',            'Post build notification to Slack', false)
  .option('--testflight',       'Upload iOS IPA to TestFlight', false)
  .option('--google-play',      'Upload AAB to Google Play', false)
  .option('--download-signed-apk', 'Download Google-signed APK after Google Play upload', false)
  .action(async (opts) => {
    const repoPath = path.resolve(opts.repo);
    try {
      await runBuildPipeline({
        repoPath,
        ref: opts.ref,
        android: opts.android,
        ios: opts.ios,
        aab: opts.aab,
        uploadSmb: opts.smb,
        uploadSlack: opts.slack,
        uploadTestFlight: opts.testflight,
        uploadGooglePlay: opts.googlePlay,
        downloadSignedApk: opts.downloadSignedApk,
      });
    } catch (err) {
      console.error('[unity-builder] Build pipeline failed:', err.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// push command  (force-push current state to builds branch)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('push')
  .description('Force-push the current state of the repo to the builds branch')
  .option('--repo <path>',   'Path to the Unity project / git repo', process.cwd())
  .option('--branch <name>', 'Target builds branch', config.git.buildsBranch)
  .action((opts) => {
    const repoPath = path.resolve(opts.repo);
    try {
      git.forcePushToBuildsBranch(repoPath, opts.branch);
      const commit = git.getCurrentCommit(repoPath);
      console.log(`[unity-builder] Force-pushed to ${opts.branch} (commit: ${commit})`);
    } catch (err) {
      console.error('[unity-builder] Push failed:', err.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// info command
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('info')
  .description('Show current configuration')
  .action(() => {
    const safeConfig = JSON.parse(JSON.stringify(config));
    // Mask sensitive values
    if (safeConfig.slack.botToken) safeConfig.slack.botToken = '***';
    if (safeConfig.smb.password)   safeConfig.smb.password   = '***';
    // privateKeyPath is not a secret itself (it is a file path), so we leave it as-is
    console.log(JSON.stringify(safeConfig, null, 2));
  });

program.parse(process.argv);
