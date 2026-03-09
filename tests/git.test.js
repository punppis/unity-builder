jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const { execSync } = require('child_process');
const git = require('../src/git');

beforeEach(() => {
  execSync.mockReset();
});

describe('git.pull', () => {
  it('runs git pull in the given directory', () => {
    git.pull('/repo');
    expect(execSync).toHaveBeenCalledWith('git pull', expect.objectContaining({ cwd: '/repo' }));
  });
});

describe('git.checkout', () => {
  it('runs git checkout with the given ref', () => {
    git.checkout('/repo', 'feature/my-branch');
    expect(execSync).toHaveBeenCalledWith(
      'git checkout feature/my-branch',
      expect.objectContaining({ cwd: '/repo' })
    );
  });
});

describe('git.clean', () => {
  it('runs git clean and git reset', () => {
    git.clean('/repo');
    expect(execSync).toHaveBeenCalledWith('git clean -fdx', expect.objectContaining({ cwd: '/repo' }));
    expect(execSync).toHaveBeenCalledWith('git reset --hard HEAD', expect.objectContaining({ cwd: '/repo' }));
  });
});

describe('git.forcePushToBuildsBranch', () => {
  it('force-pushes HEAD to the builds branch', () => {
    git.forcePushToBuildsBranch('/repo', 'builds');
    expect(execSync).toHaveBeenCalledWith(
      'git push origin HEAD:builds --force',
      expect.objectContaining({ cwd: '/repo' })
    );
  });
});

describe('git.getCurrentCommit', () => {
  it('returns the current commit SHA', () => {
    execSync.mockReturnValue(Buffer.from('abc1234\n'));
    const sha = git.getCurrentCommit('/repo');
    expect(sha).toBe('abc1234');
    expect(execSync).toHaveBeenCalledWith('git rev-parse HEAD', expect.objectContaining({ cwd: '/repo' }));
  });
});

describe('git.getCurrentBranch', () => {
  it('returns the current branch name', () => {
    execSync.mockReturnValue(Buffer.from('main\n'));
    const branch = git.getCurrentBranch('/repo');
    expect(branch).toBe('main');
  });
});
