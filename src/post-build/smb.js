const SMB2 = require('smb2');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Upload a file to an SMB share.
 * @param {string} localFilePath  - absolute path to the local file
 * @param {string} [remoteDir]    - remote directory on the share (defaults to config.smb.remotePath)
 * @returns {Promise<string>}     - UNC path of the uploaded file
 */
function uploadToSmb(localFilePath, remoteDir) {
  return new Promise((resolve, reject) => {
    if (!config.smb.host || !config.smb.share) {
      return reject(new Error('SMB host and share must be configured (SMB_HOST, SMB_SHARE)'));
    }

    const fileName = path.basename(localFilePath);
    const remotePath = path.join(remoteDir || config.smb.remotePath, fileName).replace(/\//g, '\\');
    const uncPath = `\\\\${config.smb.host}\\${config.smb.share}${remotePath}`;

    const smb2Client = new SMB2({
      share: `\\\\${config.smb.host}\\${config.smb.share}`,
      domain: config.smb.domain,
      username: config.smb.username,
      password: config.smb.password,
    });

    const fileContent = fs.readFileSync(localFilePath);

    smb2Client.writeFile(remotePath, fileContent, (err) => {
      smb2Client.disconnect();
      if (err) {
        return reject(new Error(`SMB upload failed: ${err.message}`));
      }
      console.log(`[smb] Uploaded ${fileName} to ${uncPath}`);
      resolve(uncPath);
    });
  });
}

module.exports = { uploadToSmb };
