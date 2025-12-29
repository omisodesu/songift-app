const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

class AudioService {
  /**
   * 音声ファイルから冒頭15秒を切り出し
   * @param {string} inputPath - 入力音声ファイルパス
   * @param {string} outputPath - 出力音声ファイルパス
   * @returns {Promise<{outputPath: string, durationSeconds: number}>}
   */
  async generatePreview(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      console.log(`Generating preview audio: ${inputPath} -> ${outputPath}`);

      // 出力ディレクトリ作成
      const outputDir = path.dirname(outputPath);
      fs.mkdir(outputDir, { recursive: true })
        .then(() => {
          ffmpeg(inputPath)
            .setStartTime(0)
            .setDuration(15) // 冒頭15秒
            .audioCodec('libmp3lame')
            .audioBitrate('192k')
            .format('mp3')
            .on('start', (commandLine) => {
              console.log('FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
              if (progress.percent) {
                console.log(`Processing: ${Math.floor(progress.percent)}% done`);
              }
            })
            .on('end', () => {
              console.log('Preview audio generation completed');
              resolve({
                outputPath: outputPath,
                durationSeconds: 15
              });
            })
            .on('error', (err) => {
              console.error('FFmpeg error:', err);
              reject(new Error(`Failed to generate preview audio: ${err.message}`));
            })
            .save(outputPath);
        })
        .catch(reject);
    });
  }

  /**
   * 音声ファイルの長さを取得
   * @param {string} filePath - 音声ファイルパス
   * @returns {Promise<number>} 長さ（秒）
   */
  async getDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get audio duration: ${err.message}`));
        } else {
          const duration = metadata.format.duration;
          resolve(duration);
        }
      });
    });
  }
}

module.exports = AudioService;
