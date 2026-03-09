const { WebClient } = require('@slack/web-api');
const config = require('../config');

let client = null;

function getClient() {
  if (!client) {
    if (!config.slack.botToken) {
      throw new Error('SLACK_BOT_TOKEN is not configured');
    }
    client = new WebClient(config.slack.botToken);
  }
  return client;
}

/**
 * Post a build notification to Slack.
 * @param {object} options
 * @param {string} options.branch       - Git branch/commit that was built
 * @param {string} options.commit       - Commit SHA
 * @param {string|null} options.apkPath - Local path to APK (for display)
 * @param {string|null} options.aabPath - Local path to AAB (for display)
 * @param {string|null} options.apkUrl  - Download URL for APK (e.g. SMB share link)
 * @param {string|null} options.status  - 'success' | 'failure'
 * @param {string|null} options.error   - Error message if status is 'failure'
 */
async function postBuildNotification({
  branch,
  commit,
  apkPath = null,
  aabPath = null,
  apkUrl = null,
  status = 'success',
  error = null,
} = {}) {
  const slackClient = getClient();
  const shortCommit = commit ? commit.substring(0, 8) : 'unknown';
  const emoji = status === 'success' ? ':white_check_mark:' : ':x:';
  const title = status === 'success'
    ? `${emoji} Android build succeeded`
    : `${emoji} Android build failed`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Branch:*\n${branch || 'unknown'}` },
        { type: 'mrkdwn', text: `*Commit:*\n${shortCommit}` },
      ],
    },
  ];

  if (status === 'success') {
    const artifacts = [];
    if (apkUrl) {
      artifacts.push(`<${apkUrl}|Download APK>`);
    } else if (apkPath) {
      artifacts.push(`APK: \`${apkPath}\``);
    }
    if (aabPath) {
      artifacts.push(`AAB: \`${aabPath}\``);
    }
    if (artifacts.length > 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Artifacts:*\n${artifacts.join('\n')}` },
      });
    }
  }

  if (error) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Error:*\n\`\`\`${error}\`\`\`` },
    });
  }

  const result = await slackClient.chat.postMessage({
    channel: config.slack.channel,
    blocks,
    text: title,
  });

  console.log(`[slack] Message posted to ${config.slack.channel} (ts: ${result.ts})`);
  return result;
}

module.exports = { postBuildNotification };
