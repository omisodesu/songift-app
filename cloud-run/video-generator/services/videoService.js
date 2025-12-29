const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

class VideoService {
  constructor() {
    this.defaultBackgroundPath = path.join(__dirname, '../assets/default_background.png');
  }

  /**
   * 静止画背景 + 音声でフル動画を生成（縦型1080x1920）
   * @param {string} audioPath - 音声ファイルパス
   * @param {string} outputPath - 出力動画ファイルパス
   * @param {string} backgroundImagePath - 背景画像パス（"default" = デフォルト背景使用）
   * @returns {Promise<{outputPath: string, durationSeconds: number}>}
   */
  async generateFullVideo(audioPath, outputPath, backgroundImagePath = 'default') {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`Generating full video: ${audioPath} -> ${outputPath}`);

        // 背景画像パスの決定
        const bgPath = backgroundImagePath === 'default'
          ? this.defaultBackgroundPath
          : backgroundImagePath;

        // 背景画像が存在するか確認
        try {
          await fs.access(bgPath);
        } catch (err) {
          return reject(new Error(`Background image not found: ${bgPath}`));
        }

        // 音声の長さを取得
        const audioDuration = await this.getAudioDuration(audioPath);
        console.log(`Audio duration: ${audioDuration} seconds`);

        // 出力ディレクトリ作成
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });

        // ffmpegで動画生成
        ffmpeg()
          .input(bgPath)
          .inputOptions([
            '-loop 1',  // 静止画をループ
            '-framerate 1'  // 低フレームレート（静止画なので）
          ])
          .input(audioPath)
          .outputOptions([
            '-c:v libx264',  // H.264 コーデック
            '-tune stillimage',  // 静止画最適化
            '-c:a aac',  // AAC 音声コーデック
            '-b:a 192k',  // 音声ビットレート
            '-pix_fmt yuv420p',  // ピクセルフォーマット（互換性）
            '-shortest',  // 音声の長さに合わせる
            '-vf scale=1080:1920',  // 縦型1080x1920にリサイズ
          ])
          .format('mp4')
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Processing: ${Math.floor(progress.percent)}% done`);
            }
          })
          .on('end', () => {
            console.log('Full video generation completed');
            resolve({
              outputPath: outputPath,
              durationSeconds: Math.floor(audioDuration)
            });
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(new Error(`Failed to generate full video: ${err.message}`));
          })
          .save(outputPath);

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 音声ファイルの長さを取得
   * @param {string} audioPath - 音声ファイルパス
   * @returns {Promise<number>} 長さ（秒）
   */
  async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
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

module.exports = VideoService;
