const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs').promises;

class StorageService {
  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.STORAGE_BUCKET;

    if (!this.bucketName) {
      throw new Error('STORAGE_BUCKET environment variable is not set');
    }

    this.bucket = this.storage.bucket(this.bucketName);
  }

  /**
   * Storage からファイルをダウンロード
   * @param {string} storagePath - Storage path (例: "audios/order123/source.mp3")
   * @param {string} localPath - ローカル保存先パス
   * @returns {Promise<string>} ローカルパス
   */
  async downloadFile(storagePath, localPath) {
    try {
      console.log(`Downloading ${storagePath} to ${localPath}`);

      // ディレクトリが存在しない場合は作成
      const dir = path.dirname(localPath);
      await fs.mkdir(dir, { recursive: true });

      // ダウンロード
      await this.bucket.file(storagePath).download({
        destination: localPath
      });

      console.log(`Downloaded successfully: ${localPath}`);
      return localPath;
    } catch (error) {
      console.error(`Download failed for ${storagePath}:`, error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Storage へファイルをアップロード
   * @param {string} localPath - ローカルファイルパス
   * @param {string} storagePath - Storage path (例: "videos/order123/full.mp4")
   * @returns {Promise<string>} Storage path
   */
  async uploadFile(localPath, storagePath) {
    try {
      console.log(`Uploading ${localPath} to ${storagePath}`);

      await this.bucket.upload(localPath, {
        destination: storagePath,
        metadata: {
          cacheControl: 'public, max-age=31536000', // 1年キャッシュ（署名URLで制御）
        },
      });

      console.log(`Uploaded successfully: ${storagePath}`);
      return storagePath;
    } catch (error) {
      console.error(`Upload failed for ${storagePath}:`, error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * ファイルが存在するかチェック
   * @param {string} storagePath - Storage path
   * @returns {Promise<boolean>}
   */
  async fileExists(storagePath) {
    try {
      const [exists] = await this.bucket.file(storagePath).exists();
      return exists;
    } catch (error) {
      console.error(`File exists check failed for ${storagePath}:`, error);
      return false;
    }
  }
}

module.exports = StorageService;
