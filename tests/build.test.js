jest.mock('../src/git');
jest.mock('../src/builders/android');
jest.mock('../src/builders/ios');
jest.mock('../src/post-build/slack');
jest.mock('../src/post-build/smb');
jest.mock('../src/post-build/appstore');
jest.mock('../src/post-build/googleplay');

const git = require('../src/git');
const { buildAndroid } = require('../src/builders/android');
const { buildIos } = require('../src/builders/ios');
const { postBuildNotification } = require('../src/post-build/slack');
const { uploadToSmb } = require('../src/post-build/smb');
const { runBuildPipeline } = require('../src/build');

beforeEach(() => {
  jest.clearAllMocks();
  git.getCurrentBranch.mockReturnValue('main');
  git.getCurrentCommit.mockReturnValue('abc1234567890');
  git.pull.mockImplementation(() => {});
  git.checkout.mockImplementation(() => {});
  git.clean.mockImplementation(() => {});
  buildAndroid.mockResolvedValue({ apkPath: '/build/app.apk', aabPath: null });
  buildIos.mockResolvedValue({ ipaPath: '/build/app.ipa' });
  postBuildNotification.mockResolvedValue({});
  uploadToSmb.mockResolvedValue('smb://server/share/app.apk');
});

describe('runBuildPipeline', () => {
  it('runs pull, clean, and android build by default', async () => {
    const result = await runBuildPipeline({ repoPath: '/repo', android: true });
    expect(git.pull).toHaveBeenCalledWith('/repo');
    expect(git.clean).toHaveBeenCalledWith('/repo');
    expect(buildAndroid).toHaveBeenCalled();
    expect(result.apkPath).toBe('/build/app.apk');
  });

  it('checks out a specific ref when provided', async () => {
    await runBuildPipeline({ repoPath: '/repo', ref: 'abc1234', android: true });
    expect(git.checkout).toHaveBeenCalledWith('/repo', 'abc1234');
    expect(git.pull).not.toHaveBeenCalled();
  });

  it('posts slack notification on success when --slack is set', async () => {
    await runBuildPipeline({ repoPath: '/repo', android: true, uploadSlack: true });
    expect(postBuildNotification).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' })
    );
  });

  it('posts slack failure notification when build throws', async () => {
    buildAndroid.mockRejectedValue(new Error('Unity crashed'));
    await expect(
      runBuildPipeline({ repoPath: '/repo', android: true, uploadSlack: true })
    ).rejects.toThrow('Unity crashed');
    expect(postBuildNotification).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failure', error: 'Unity crashed' })
    );
  });

  it('uploads APK to SMB when --smb is set', async () => {
    await runBuildPipeline({ repoPath: '/repo', android: true, uploadSmb: true });
    expect(uploadToSmb).toHaveBeenCalledWith('/build/app.apk');
  });

  it('builds ios when --ios is set', async () => {
    await runBuildPipeline({ repoPath: '/repo', ios: true });
    expect(buildIos).toHaveBeenCalled();
  });
});
