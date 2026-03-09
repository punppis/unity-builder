# unity-builder

A Node.js CLI tool that automates Unity builds for Android and iOS with interactive
setup, pre-build fixes for plugin-heavy projects, and post-build distribution actions.

---

## Quick Start

```bash
npm install
unity-builder init          # interactive setup on your dev machine
unity-builder build --android --slack
```

---

## Prerequisites

| Tool | Required for |
|------|-------------|
| Node.js 18+ | the CLI itself |
| Git | pulling / cleaning the project |
| Unity (via Unity Hub) | building the project |
| Xcode (macOS) | iOS builds |
| Android SDK + `ANDROID_HOME` | Android builds |
| CocoaPods | iOS plugin resolution |

---

## Commands

### `unity-builder init`

Interactive wizard that runs on your **dev machine** once per project.

**What it does:**

1. **System check** – verifies Node, Git, Xcode, Android SDK, CocoaPods  
2. **Unity version detection** – scans `~/Unity/Hub/Editor` (or
   `/Applications/Unity/Hub/Editor` on macOS), reads `ProjectSettings/ProjectVersion.txt`,
   and recommends the best matching version  
3. **Project paths** – Unity project path, build output directory, builds branch name  
4. **Google Play setup** – step-by-step instructions to create a Google Cloud service
   account and link it to the Play Console; collects the JSON key path and package name  
5. **App Store Connect setup** – guides you to create an API key on
   <https://appstoreconnect.apple.com/access/api>; collects Key ID, Issuer ID, `.p8` path,
   Bundle ID, and Team ID  
6. **Writes `.env`** – all collected values are written / merged into a `.env` file

```bash
unity-builder init --project /path/to/unity-project --env /path/to/.env
```

After running `init`, copy the `.env` to the build server and run `unity-builder build`.

---

### `unity-builder build`

Runs the full **pull → clean → build → post-build** pipeline.

```bash
# Android APK + Slack notification
unity-builder build --android --slack

# Android APK + AAB, upload to Google Play, download signed APK
unity-builder build --android --aab --google-play --download-signed-apk

# iOS IPA + upload to TestFlight
unity-builder build --ios --testflight

# Build a specific branch/commit
unity-builder build --android --ref abc1234 --repo /path/to/project

# All options
unity-builder build \
  --repo /path/to/project \
  --ref feature/my-branch \
  --android --ios --aab \
  --smb --slack --testflight --google-play --download-signed-apk
```

**Options**

| Option | Description |
|--------|-------------|
| `--repo <path>` | Unity project / git repo path (default: cwd) |
| `--ref <ref>` | Branch or commit SHA to build (default: current HEAD) |
| `--android` | Build Android APK |
| `--ios` | Build iOS IPA |
| `--aab` | Also produce Android App Bundle |
| `--smb` | Upload APK / AAB to SMB share |
| `--slack` | Post Slack notification with artifact links |
| `--testflight` | Upload IPA to TestFlight |
| `--google-play` | Upload AAB to Google Play (internal track) |
| `--download-signed-apk` | Download Google-signed APK after GP upload |

---

### `unity-builder push`

Force-pushes the current repository state to the builds branch (the "build button"
equivalent for the Unity editor workflow).

```bash
unity-builder push --branch builds
```

---

### `unity-builder info`

Prints the currently loaded configuration (with sensitive values masked).

---

## Pre-build Fixes

Unity + plugin combinations frequently produce broken Xcode / Android projects.
The following fixes are applied **automatically** before calling `xcodebuild` or
`gradlew`:

### iOS – Xcode project fixes (`src/fixes/xcode.js`)

- **Missing file references** – scans `project.pbxproj` for `PBXFileReference`
  entries whose file no longer exists on disk (common with ads, mediation and IAP
  plugins), removes the broken GUID from all sections  
- **Duplicate framework references** – removes duplicate `.framework` entries that
  cause "multiple commands produce" linker errors

### Android – Gradle / manifest fixes (`src/fixes/android.js`)

- **Duplicate `implementation` declarations** – deduplicates `build.gradle`
  dependency lines introduced by multiple SDK plugins  
- **Duplicate `<uses-permission>` entries** – deduplicates `AndroidManifest.xml`
  permissions injected by analytics, ads, and other plugins

You can also run fixes in dry-run mode programmatically:

```javascript
const { fixXcodeProject } = require('./src/fixes/xcode');
const result = fixXcodeProject('path/to/Unity-iPhone.xcodeproj', { dryRun: true, verbose: true });
console.log(result); // { missingRefs: 3, duplicateFrameworks: 1 }
```

---

## Configuration

Copy `.env.example` to `.env` and fill in the values, or run `unity-builder init`
to have the wizard fill them in for you.

```
UNITY_PATH=/Applications/Unity/Hub/Editor/2022.3.0f1/Unity.app/Contents/MacOS/Unity
UNITY_VERSION=2022.3.0f1
UNITY_PROJECT_PATH=/path/to/your/unity/project
UNITY_BUILD_METHOD_ANDROID=BuildScript.BuildAndroid
UNITY_BUILD_METHOD_IOS=BuildScript.BuildiOS
BUILDS_BRANCH=builds
...
```

See [.env.example](.env.example) for the full list.

---

## Google Play – What `init` Sets Up

To publish to Google Play, `init` walks you through:

1. Creating a **Google Cloud service account** with the Google Play Android Developer API enabled  
2. Downloading the **JSON key file**  
3. Adding the service account to the **Google Play Console** with "Release manager" permission  

Collected values saved to `.env`:
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` – path to the JSON key file  
- `GOOGLE_PLAY_PACKAGE_NAME` – Android package name  
- `GOOGLE_PLAY_TRACK` – publish track (`internal` / `alpha` / `beta` / `production`)  

---

## Apple / TestFlight – What `init` Sets Up

To upload to TestFlight, `init` walks you through:

1. Creating an **App Store Connect API key** at <https://appstoreconnect.apple.com/access/api>  
   (Developer role or higher; download the `.p8` file – only available once)  
2. Recording the **Key ID** and **Issuer ID**  
3. Entering your **Bundle ID** and **Team ID**  

Collected values saved to `.env`:
- `APPLE_KEY_ID` – API key identifier  
- `APPLE_ISSUER_ID` – issuer UUID  
- `APPLE_PRIVATE_KEY_PATH` – path to the `.p8` file  
- `APPLE_BUNDLE_ID` – iOS bundle identifier  
- `APPLE_TEAM_ID` – Apple developer team ID  

---

## Architecture

```
src/
├── index.js            CLI entry point (commander)
├── config.js           Centralised config (dotenv)
├── build.js            Pipeline orchestrator
├── git.js              Git helpers (pull, checkout, clean, push)
├── builders/
│   ├── android.js      Unity batch-mode Android build
│   └── ios.js          Unity → Xcode project → IPA export
├── post-build/
│   ├── slack.js        Slack notifications
│   ├── smb.js          SMB share uploads
│   ├── appstore.js     TestFlight (App Store Connect API)
│   └── googleplay.js   Google Play AAB upload + signed APK download
├── init/
│   ├── index.js        Init wizard orchestrator
│   ├── system.js       System dependency checks
│   ├── unity.js        Unity version detection
│   ├── apple.js        Apple API key setup prompts
│   ├── google.js       Google Play service account prompts
│   └── config-writer.js Write / merge .env file
└── fixes/
    ├── xcode.js        Xcode project pre-build fixes
    └── android.js      Android project pre-build fixes
```

