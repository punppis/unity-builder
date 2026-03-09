const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');

const { checkAll, printResults } = require('./system');
const { detectInstalledVersions, detectProjectUnityVersion, findBestMatch } = require('./unity');
const { gatherAppleConfig, appleConfigToEnv } = require('./apple');
const { gatherGoogleConfig, googleConfigToEnv } = require('./google');
const { writeEnvFile } = require('./config-writer');

/**
 * Run the interactive init wizard.
 *
 * @param {object} options
 * @param {string}   options.projectPath - path to the Unity project
 * @param {string}   options.envPath     - path to write the .env file
 * @param {function} [options.ask]       - optional prompt function override (for tests)
 */
async function runInit({ projectPath, envPath, ask } = {}) {
  const prompt = ask || inquirer.prompt.bind(inquirer);
  projectPath = projectPath ? path.resolve(projectPath) : process.cwd();
  envPath = envPath || path.join(process.cwd(), '.env');

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║        unity-builder  –  init wizard         ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── Step 1: System dependency check ───────────────────────────────────────
  console.log('Step 1/5 – Checking system dependencies...\n');
  const results = checkAll();
  const allOk = printResults(results);
  if (!allOk) {
    console.log('\n⚠️  Some dependencies are missing. Fix the issues above and re-run init.\n');
    // We continue anyway – user may still want to configure API credentials
  }

  // ── Step 2: Unity version ──────────────────────────────────────────────────
  console.log('\nStep 2/5 – Unity version...\n');
  const installed = detectInstalledVersions();
  const projectVersion = detectProjectUnityVersion(projectPath);

  if (projectVersion) {
    console.log(`  Project requires Unity ${projectVersion}`);
  }

  let unityPath;
  if (installed.length === 0) {
    console.log('  ⚠️  No Unity versions found via Unity Hub.');
    const { manualPath } = await prompt([
      {
        type: 'input',
        name: 'manualPath',
        message: 'Enter the full path to the Unity binary (or leave blank to skip):',
      },
    ]);
    unityPath = manualPath.trim() || undefined;
  } else {
    const best = projectVersion ? findBestMatch(projectVersion, installed) : null;
    const choices = installed.map((v) => ({
      name: `${v.version}${v === best ? ' (recommended for this project)' : ''}`,
      value: v.path,
    }));
    const { selectedPath } = await prompt([
      {
        type: 'list',
        name: 'selectedPath',
        message: 'Select Unity version to use:',
        choices,
        default: best ? best.path : choices[0].value,
      },
    ]);
    unityPath = selectedPath;
  }

  // ── Step 3: Project paths ──────────────────────────────────────────────────
  console.log('\nStep 3/5 – Project configuration...\n');
  const { resolvedProjectPath, buildOutputPath, buildsBranch } = await prompt([
    {
      type: 'input',
      name: 'resolvedProjectPath',
      message: 'Unity project path:',
      default: projectPath,
      validate: (v) => fs.existsSync(v.trim()) || `Directory not found: ${v}`,
    },
    {
      type: 'input',
      name: 'buildOutputPath',
      message: 'Build output directory:',
      default: './build',
    },
    {
      type: 'input',
      name: 'buildsBranch',
      message: 'Name of the "builds" git branch:',
      default: 'builds',
    },
  ]);

  const envValues = {};
  if (unityPath) {
    envValues.UNITY_PATH = unityPath;
  }
  envValues.UNITY_PROJECT_PATH = resolvedProjectPath.trim();
  envValues.BUILD_OUTPUT_PATH = buildOutputPath.trim();
  envValues.BUILDS_BRANCH = buildsBranch.trim();

  // ── Step 4: Android / Google Play ─────────────────────────────────────────
  console.log('\nStep 4/5 – Android & Google Play...\n');
  const { setupAndroid } = await prompt([
    {
      type: 'confirm',
      name: 'setupAndroid',
      message: 'Set up Google Play publishing?',
      default: true,
    },
  ]);

  if (setupAndroid) {
    const googleConfig = await gatherGoogleConfig(prompt);
    Object.assign(envValues, googleConfigToEnv(googleConfig));
  }

  // ── Step 5: iOS / Apple ───────────────────────────────────────────────────
  console.log('\nStep 5/5 – iOS & App Store Connect...\n');
  const { setupIos } = await prompt([
    {
      type: 'confirm',
      name: 'setupIos',
      message: 'Set up App Store Connect / TestFlight?',
      default: process.platform === 'darwin',
    },
  ]);

  if (setupIos) {
    const appleConfig = await gatherAppleConfig(prompt);
    Object.assign(envValues, appleConfigToEnv(appleConfig));
  }

  // ── Write .env ─────────────────────────────────────────────────────────────
  writeEnvFile(envPath, envValues);

  console.log('\n✅  Init complete!');
  console.log(`    Configuration written to: ${envPath}`);
  console.log('    Run `unity-builder build --android` (or `--ios`) to start building.\n');
}

module.exports = { runInit };
