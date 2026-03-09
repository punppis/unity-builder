jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: {
      postMessage: jest.fn().mockResolvedValue({ ts: '12345.6789' }),
    },
  })),
}));

// Set required env vars before loading the module
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_CHANNEL = '#test';

const { postBuildNotification } = require('../src/post-build/slack');

describe('postBuildNotification', () => {
  it('posts a success notification to Slack', async () => {
    const result = await postBuildNotification({
      branch: 'main',
      commit: 'abc1234567890',
      apkPath: '/build/app.apk',
      status: 'success',
    });
    expect(result.ts).toBe('12345.6789');
  });

  it('posts a failure notification with error details', async () => {
    const result = await postBuildNotification({
      branch: 'feature/test',
      commit: 'deadbeef',
      status: 'failure',
      error: 'Build script crashed',
    });
    expect(result.ts).toBe('12345.6789');
  });

  it('includes APK URL when provided', async () => {
    const { WebClient } = require('@slack/web-api');
    const instance = WebClient.mock.results[0].value;
    const postMessage = instance.chat.postMessage;

    await postBuildNotification({
      branch: 'main',
      commit: 'abc123',
      apkUrl: 'smb://server/share/app.apk',
      status: 'success',
    });

    expect(postMessage).toHaveBeenCalled();
    const callArgs = postMessage.mock.calls[postMessage.mock.calls.length - 1][0];
    const blocksText = JSON.stringify(callArgs.blocks);
    expect(blocksText).toContain('smb://server/share/app.apk');
  });
});
