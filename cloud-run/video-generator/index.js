const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const StorageService = require('./services/storageService');
const AudioService = require('./services/audioService');
const VideoService = require('./services/videoService');
const SunoService = require('./services/sunoService');
const LyricsAlignService = require('./services/lyricsAlignService');

const app = express();
const port = process.env.PORT || 8080;

// サービスのインスタンス化
const storageService = new StorageService();
const audioService = new AudioService();
const videoService = new VideoService();
const sunoService = new SunoService();
const lyricsAlignService = new LyricsAlignService();

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
/**
 * POST /generate-previews
 * 2曲分のプレビュー音声（15秒）を生成
 *
 * リクエストボディ:
 * {
 *   "songs": [{ "id": "song1", "audio_url": "https://..." }, ...],
 *   "orderId": "order123"
 * }
 *
 * レスポンス:
 * {
 *   "success": true,
 *   "results": [
 *     { "songId": "song1", "audio_url": "https://...", "previewAudioPath": "audios/order123/preview_0.mp3", "previewReady": true },
 *     ...
 *   ]
 * }
 */
app.post('/generate-previews', async (req, res) => {
  const { songs, orderId } = req.body;

  // バリデーション
  if (!songs || !Array.isArray(songs) || songs.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: songs array'
    });
  }

  if (!orderId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: orderId'
    });
  }

  console.log(`[Generate Previews] Starting for order ${orderId}, ${songs.length} songs`);

  const results = [];
  const axios = require('axios');

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const timestamp = Date.now();
    const tempSourcePath = `/tmp/source_${orderId}_${i}_${timestamp}.mp3`;
    const tempOutputPath = `/tmp/preview_${orderId}_${i}_${timestamp}.mp3`;
    const outputPath = `audios/${orderId}/preview_${i}.mp3`;

    try {
      console.log(`[Generate Previews] Processing song ${i}: ${song.id}`);

      // 1. Suno URLから音声をダウンロード
      const audioResponse = await axios.get(song.audio_url, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      await fs.writeFile(tempSourcePath, Buffer.from(audioResponse.data));

      // 2. 15秒プレビュー生成
      await audioService.generatePreview(tempSourcePath, tempOutputPath);

      // 3. Storageにアップロード
      await storageService.uploadFile(tempOutputPath, outputPath);

      results.push({
        id: song.id,
        audio_url: song.audio_url,
        previewAudioPath: outputPath,
        previewReady: true
      });

      console.log(`[Generate Previews] Song ${i} completed: ${outputPath}`);

      // 一時ファイル削除
      await fs.unlink(tempSourcePath).catch(() => {});
      await fs.unlink(tempOutputPath).catch(() => {});

    } catch (error) {
      console.error(`[Generate Previews] Failed for song ${i}:`, error.message);
      results.push({
        id: song.id,
        audio_url: song.audio_url,
        previewAudioPath: null,
        previewReady: false,
        error: error.message
      });

      // 一時ファイル削除（エラー時）
      await fs.unlink(tempSourcePath).catch(() => {});
      await fs.unlink(tempOutputPath).catch(() => {});
    }
  }

  const allSuccess = results.every(r => r.previewReady);
  console.log(`[Generate Previews] Completed for order ${orderId}, success: ${allSuccess}`);

  res.json({
    success: allSuccess,
    results
  });
});

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
 *   "backgroundImagePath": "default",  // 互換用（静止画フォールバック）
 *   "backgroundTemplateId": "t1",      // テンプレート動画ID (t1/t2/t3)
 *   "lyricsText": "歌詞テキスト...",   // 歌詞（ASS字幕用、空でもOK）
 *   "sunoTaskId": "xxx-xxx",           // V2: Suno生成タスクID（optional）
 *   "selectedSongUrl": "https://..."   // V2: 選択曲のURL（optional）
 * }
 *
 * レスポンス:
 * {
 *   "success": true,
 *   "outputPath": "videos/order123/full.mp4",
 *   "audioDurationSeconds": 180,
 *   "videoDurationSeconds": 181,
 *   "subtitleMode": "v2" | "v1"        // V2またはV1どちらが使用されたか
 * }
 */
app.post('/generate-full-video', async (req, res) => {
  const {
    sourceAudioPath,
    outputPath,
    backgroundImagePath = 'default',
    backgroundTemplateId = 't1',
    lyricsText = '',
    sunoTaskId = null,
    selectedSongUrl = null,
    photoPaths = []
  } = req.body;

  // バリデーション
  if (!sourceAudioPath || !outputPath) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: sourceAudioPath, outputPath'
    });
  }

  // スライドショーモード判定
  console.log(`[Full Video] Received photoPaths: ${JSON.stringify(photoPaths)}, isArray: ${Array.isArray(photoPaths)}, length: ${photoPaths ? photoPaths.length : 'null'}`);
  const isSlideshowMode = Array.isArray(photoPaths) && photoPaths.length > 0;
  console.log(`[Full Video] isSlideshowMode: ${isSlideshowMode}`);

  if (isSlideshowMode && photoPaths.length > 5) {
    return res.status(400).json({
      success: false,
      error: 'photoPaths must contain 1-5 items'
    });
  }

  // 一時ファイルパス
  const timestamp = Date.now();
  const tempAudioPath = `/tmp/audio_${timestamp}.mp3`;
  const tempTemplatePath = `/tmp/template_${timestamp}.mp4`;
  const tempAssPath = `/tmp/lyrics_${timestamp}.ass`;
  const tempVideoPath = `/tmp/video_${timestamp}.mp4`;
  const tempPhotoDir = `/tmp/photos_${timestamp}`;

  // cleanup用にパスを収集
  const tempFiles = [tempAudioPath, tempVideoPath];

  try {
    console.log(`[Full Video] Starting generation for ${sourceAudioPath}`);
    console.log(`[Full Video] Mode: ${isSlideshowMode ? 'slideshow' : 'template'}`);

    // 1. Storage からソース音声をダウンロード
    await storageService.downloadFile(sourceAudioPath, tempAudioPath);

    if (isSlideshowMode) {
      // ==========================================
      // スライドショーモード（B2B写真）
      // ==========================================
      console.log(`[Full Video] Slideshow mode: ${photoPaths.length} photos`);

      // 2. 写真をダウンロード
      await fs.mkdir(tempPhotoDir, { recursive: true });
      const localPhotoPaths = [];
      for (let i = 0; i < photoPaths.length; i++) {
        const ext = path.extname(photoPaths[i]) || '.jpg';
        const localPath = path.join(tempPhotoDir, `photo_${i}${ext}`);
        await storageService.downloadFile(photoPaths[i], localPath);
        localPhotoPaths.push(localPath);
        tempFiles.push(localPath);
      }

      // 3. スライドショー動画生成
      const result = await videoService.generateSlideshowVideo({
        audioPath: tempAudioPath,
        outputPath: tempVideoPath,
        photoPaths: localPhotoPaths,
      });

      // 4. Storage にアップロード
      await storageService.uploadFile(tempVideoPath, outputPath);

      // 5. 一時ファイル削除
      for (const tempFile of tempFiles) {
        await fs.unlink(tempFile).catch((e) => {
          console.warn(`[Full Video] Failed to delete temp file: ${tempFile}`, e.message);
        });
      }
      await fs.rm(tempPhotoDir, { recursive: true, force: true }).catch(() => {});

      console.log(`[Full Video] Slideshow completed: ${outputPath}`);

      res.json({
        success: true,
        outputPath: outputPath,
        audioDurationSeconds: result.audioDurationSeconds,
        videoDurationSeconds: result.videoDurationSeconds,
        subtitleMode: null
      });

    } else {
      // ==========================================
      // 従来モード（B2Cテンプレート動画 + 字幕）
      // ==========================================
      console.log(`[Full Video] Template: ${backgroundTemplateId}, Lyrics: ${lyricsText ? 'yes' : 'no'}`);

      // 2. テンプレート動画をStorageからダウンロード
      let templateDownloaded = false;
      const templateStoragePath = `video-templates/${backgroundTemplateId}.mp4`;

      try {
        console.log(`[Full Video] Downloading template: ${templateStoragePath}`);
        await storageService.downloadFile(templateStoragePath, tempTemplatePath);
        templateDownloaded = true;
        tempFiles.push(tempTemplatePath);
        console.log(`[Full Video] Template downloaded successfully`);
      } catch (templateError) {
        console.warn(`[Full Video] Template ${backgroundTemplateId} download failed: ${templateError.message}`);
        // フォールバック: t1で再試行
        if (backgroundTemplateId !== 't1') {
          try {
            console.log(`[Full Video] Trying fallback template: t1`);
            await storageService.downloadFile('video-templates/t1.mp4', tempTemplatePath);
            templateDownloaded = true;
            tempFiles.push(tempTemplatePath);
            console.log(`[Full Video] Fallback template downloaded successfully`);
          } catch (fallbackError) {
            console.warn(`[Full Video] Fallback template also failed: ${fallbackError.message}`);
          }
        }
      }

      // 3. 歌詞がある場合はASSファイルを生成
      //    V2: Suno timestamped lyrics を試行、失敗時はV1へフォールバック
      let assPath = null;
      let subtitleMode = null; // 'v2' | 'v1' | null

      if (lyricsText && lyricsText.trim()) {
        // 音声尺を取得
        const audioDuration = await videoService.getAudioDuration(tempAudioPath);

        // === V2: timestamped lyrics による同期字幕を試行 ===
        let v2Success = false;

        if (sunoTaskId && selectedSongUrl) {
          console.log(`[Full Video] V2 subtitles: attempting (sunoTaskId=${sunoTaskId})`);

          try {
            // Suno APIからalignedWordsを取得
            const alignedWords = await sunoService.getAlignedWords(sunoTaskId, selectedSongUrl);

            if (alignedWords && alignedWords.length > 0) {
              console.log(`[Full Video] V2 subtitles: got ${alignedWords.length} aligned words`);

              // alignedWords → lineEvents に変換
              const lineEvents = lyricsAlignService.convertToLineEvents(alignedWords, audioDuration);

              if (lineEvents && lineEvents.length > 0) {
                console.log(`[Full Video] V2 subtitles: generated ${lineEvents.length} line events`);

                // V2でASS生成
                await videoService.generateAssFileV2(lineEvents, audioDuration, tempAssPath);
                assPath = tempAssPath;
                tempFiles.push(tempAssPath);
                v2Success = true;
                subtitleMode = 'v2';
                console.log(`[Full Video] V2 subtitles: enabled ✓`);
              } else {
                console.warn(`[Full Video] V2 subtitles: fallback to V1 (reason=lineEvents empty)`);
              }
            } else {
              console.warn(`[Full Video] V2 subtitles: fallback to V1 (reason=alignedWords not found)`);
            }
          } catch (v2Error) {
            console.warn(`[Full Video] V2 subtitles: fallback to V1 (reason=exception: ${v2Error.message})`);
          }
        } else {
          console.log(`[Full Video] V2 subtitles: skipped (sunoTaskId or selectedSongUrl missing)`);
        }

        // === V1 フォールバック: 固定間隔3ブロック ===
        if (!v2Success) {
          console.log(`[Full Video] V1 subtitles: generating fixed-interval 3-block ASS`);
          try {
            await videoService.generateAssFile(lyricsText, audioDuration, tempAssPath);
            assPath = tempAssPath;
            tempFiles.push(tempAssPath);
            subtitleMode = 'v1';
            console.log(`[Full Video] V1 subtitles: enabled ✓`);
          } catch (v1Error) {
            console.error(`[Full Video] V1 subtitles: failed (${v1Error.message}), proceeding without subtitles`);
            subtitleMode = null;
          }
        }
      }

      // 4. 動画生成
      let result;
      if (templateDownloaded) {
        // テンプレート動画ベースで生成
        console.log(`[Full Video] Generating video from template`);
        result = await videoService.generateFullVideo({
          audioPath: tempAudioPath,
          outputPath: tempVideoPath,
          templateVideoPath: tempTemplatePath,
          assPath: assPath,
          backgroundImagePath: backgroundImagePath
        });
      } else {
        // 従来互換: 静止画ベースで生成
        console.log(`[Full Video] Generating video from static image (fallback)`);
        result = await videoService.generateFullVideo(
          tempAudioPath,
          tempVideoPath,
          backgroundImagePath
        );
      }

      // 5. Storage にアップロード
      await storageService.uploadFile(tempVideoPath, outputPath);

      // 6. 一時ファイル削除
      for (const tempFile of tempFiles) {
        await fs.unlink(tempFile).catch((e) => {
          console.warn(`[Full Video] Failed to delete temp file: ${tempFile}`, e.message);
        });
      }

      console.log(`[Full Video] Completed: ${outputPath}`);

      res.json({
        success: true,
        outputPath: outputPath,
        audioDurationSeconds: result.audioDurationSeconds,
        videoDurationSeconds: result.videoDurationSeconds,
        subtitleMode: subtitleMode // 'v2' | 'v1' | null
      });
    }

  } catch (error) {
    console.error('[Full Video] Error:', error);

    // エラー時も一時ファイル削除を試みる
    for (const tempFile of tempFiles) {
      await fs.unlink(tempFile).catch(() => {});
    }
    if (isSlideshowMode) {
      await fs.rm(tempPhotoDir, { recursive: true, force: true }).catch(() => {});
    }

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
  console.log(`Video Generator service v2-slideshow listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Storage bucket: ${process.env.STORAGE_BUCKET}`);
});
