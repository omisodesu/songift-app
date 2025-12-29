const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const StorageService = require('./services/storageService');
const AudioService = require('./services/audioService');
const VideoService = require('./services/videoService');

const app = express();
const port = process.env.PORT || 8080;

// サービスのインスタンス化
const storageService = new StorageService();
const audioService = new AudioService();
const videoService = new VideoService();

// JSONリクエストのパース
app.use(express.json());

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'video-generator' });
});

/**
 * POST /generate-preview-audio
 * プレビュー音声（15秒）を生成
 *
 * リクエストボディ:
 * {
 *   "sourceAudioPath": "audios/order123/source.mp3",
 *   "outputPath": "audios/order123/preview.mp3"
 * }
 *
 * レスポンス:
 * {
 *   "success": true,
 *   "outputPath": "audios/order123/preview.mp3",
 *   "durationSeconds": 15
 * }
 */
app.post('/generate-preview-audio', async (req, res) => {
  const { sourceAudioPath, outputPath } = req.body;

  // バリデーション
  if (!sourceAudioPath || !outputPath) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: sourceAudioPath, outputPath'
    });
  }

  try {
    console.log(`[Preview Audio] Starting generation for ${sourceAudioPath}`);

    // 一時ファイルパス
    const tempSourcePath = `/tmp/source_${Date.now()}.mp3`;
    const tempOutputPath = `/tmp/preview_${Date.now()}.mp3`;

    // 1. Storage からソース音声をダウンロード
    await storageService.downloadFile(sourceAudioPath, tempSourcePath);

    // 2. 冒頭15秒を切り出し
    const result = await audioService.generatePreview(tempSourcePath, tempOutputPath);

    // 3. Storage にアップロード
    await storageService.uploadFile(tempOutputPath, outputPath);

    // 4. 一時ファイル削除
    await fs.unlink(tempSourcePath).catch(console.error);
    await fs.unlink(tempOutputPath).catch(console.error);

    console.log(`[Preview Audio] Completed: ${outputPath}`);

    res.json({
      success: true,
      outputPath: outputPath,
      durationSeconds: result.durationSeconds
    });

  } catch (error) {
    console.error('[Preview Audio] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /generate-full-video
 * フル動画（縦型1080x1920）を生成
 *
 * リクエストボディ:
 * {
 *   "sourceAudioPath": "audios/order123/source.mp3",
 *   "outputPath": "videos/order123/full.mp4",
 *   "backgroundImagePath": "default"  // オプション、デフォルトは "default"
 * }
 *
 * レスポンス:
 * {
 *   "success": true,
 *   "outputPath": "videos/order123/full.mp4",
 *   "durationSeconds": 180
 * }
 */
app.post('/generate-full-video', async (req, res) => {
  const { sourceAudioPath, outputPath, backgroundImagePath = 'default' } = req.body;

  // バリデーション
  if (!sourceAudioPath || !outputPath) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: sourceAudioPath, outputPath'
    });
  }

  try {
    console.log(`[Full Video] Starting generation for ${sourceAudioPath}`);

    // 一時ファイルパス
    const tempAudioPath = `/tmp/audio_${Date.now()}.mp3`;
    const tempVideoPath = `/tmp/video_${Date.now()}.mp4`;

    // 1. Storage からソース音声をダウンロード
    await storageService.downloadFile(sourceAudioPath, tempAudioPath);

    // 2. フル動画を生成（静止画背景 + 音声）
    const result = await videoService.generateFullVideo(
      tempAudioPath,
      tempVideoPath,
      backgroundImagePath
    );

    // 3. Storage にアップロード
    await storageService.uploadFile(tempVideoPath, outputPath);

    // 4. 一時ファイル削除
    await fs.unlink(tempAudioPath).catch(console.error);
    await fs.unlink(tempVideoPath).catch(console.error);

    console.log(`[Full Video] Completed: ${outputPath}`);

    res.json({
      success: true,
      outputPath: outputPath,
      audioDurationSeconds: result.audioDurationSeconds,
      videoDurationSeconds: result.videoDurationSeconds
    });

  } catch (error) {
    console.error('[Full Video] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// サーバー起動
app.listen(port, () => {
  console.log(`Video Generator service listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Storage bucket: ${process.env.STORAGE_BUCKET}`);
});
