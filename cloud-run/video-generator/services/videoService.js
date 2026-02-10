const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

class VideoService {
  constructor() {
    this.defaultBackgroundPath = path.join(__dirname, '../assets/default_background.png');
  }

  /**
   * フル動画を生成（縦型1080x1920）
   *
   * 新シグネチャ（オプションオブジェクト）と旧シグネチャの両方に対応
   *
   * 新シグネチャ:
   * @param {object} options
   * @param {string} options.audioPath - 音声ファイルパス
   * @param {string} options.outputPath - 出力動画ファイルパス
   * @param {string} options.templateVideoPath - テンプレート動画パス（ループ再生）
   * @param {string|null} options.assPath - ASS字幕ファイルパス（null可）
   * @param {string} options.backgroundImagePath - フォールバック背景画像パス
   *
   * 旧シグネチャ（互換）:
   * @param {string} audioPath - 音声ファイルパス
   * @param {string} outputPath - 出力動画ファイルパス
   * @param {string} backgroundImagePath - 背景画像パス（"default" = デフォルト背景使用）
   *
   * @returns {Promise<{outputPath: string, audioDurationSeconds: number, videoDurationSeconds: number}>}
   */
  async generateFullVideo(audioPathOrOptions, outputPath, backgroundImagePath = 'default') {
    // 新旧シグネチャの判定
    if (typeof audioPathOrOptions === 'object') {
      // 新シグネチャ（オプションオブジェクト）
      return this._generateFromTemplate(audioPathOrOptions);
    } else {
      // 旧シグネチャ（互換）
      return this._generateFromImage(audioPathOrOptions, outputPath, backgroundImagePath);
    }
  }

  /**
   * テンプレート動画ベースで動画生成
   * @private
   */
  async _generateFromTemplate(options) {
    const {
      audioPath,
      outputPath,
      templateVideoPath,
      assPath = null,
      backgroundImagePath = 'default'
    } = options;

    return new Promise(async (resolve, reject) => {
      try {
        console.log(`Generating video from template: ${templateVideoPath}`);

        // テンプレート動画が存在するか確認
        try {
          await fs.access(templateVideoPath);
        } catch (err) {
          console.warn(`Template video not found: ${templateVideoPath}, falling back to static image`);
          return resolve(await this._generateFromImage(audioPath, outputPath, backgroundImagePath));
        }

        // 音声の長さを取得
        const audioDuration = await this.getAudioDuration(audioPath);
        console.log(`Audio duration: ${audioDuration} seconds`);

        // 出力ディレクトリ作成
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });

        // ビデオフィルタを構築
        const baseFilter = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1';
        let videoFilter;

        if (assPath) {
          try {
            await fs.access(assPath);
            // ASS字幕パスにエスケープが必要（:と\）
            const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            videoFilter = `${baseFilter},subtitles=${escapedAssPath}`;
            console.log(`Using subtitles: ${assPath}`);
          } catch (e) {
            console.warn(`ASS file not found: ${assPath}, proceeding without subtitles`);
            videoFilter = baseFilter;
          }
        } else {
          videoFilter = baseFilter;
        }

        // ffmpegで動画生成
        ffmpeg()
          .input(templateVideoPath)
          .inputOptions(['-stream_loop', '-1'])  // テンプレートをループ
          .input(audioPath)
          .outputOptions([
            '-map', '0:v:0',           // テンプレートの映像のみ
            '-map', '1:a:0',           // MP3の音声のみ（テンプレート音声は捨てる）
            '-c:v', 'libx264',         // H.264 コーデック
            '-crf', '28',              // 品質設定（23→28で圧縮率向上）
            '-maxrate', '1500k',       // 最大ビットレート制限
            '-bufsize', '3000k',       // バッファサイズ（maxrateの2倍）
            '-preset', 'medium',       // エンコード速度/品質バランス
            '-pix_fmt', 'yuv420p',     // ピクセルフォーマット（互換性）
            '-c:a', 'aac',             // AAC 音声コーデック
            '-b:a', '128k',            // 音声ビットレート（192k→128k）
            '-shortest',               // 短い方に合わせる（音声尺）
            '-movflags', '+faststart', // ストリーミング最適化
            '-r', '30',                // フレームレート
            '-vf', videoFilter,        // ビデオフィルタ（リサイズ + 字幕）
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
            console.log('Template-based video generation completed');
            resolve({
              outputPath: outputPath,
              audioDurationSeconds: audioDuration,
              videoDurationSeconds: audioDuration  // shortestなので音声尺と同じ
            });
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(new Error(`Failed to generate video from template: ${err.message}`));
          })
          .save(outputPath);

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 静止画背景ベースで動画生成（旧ロジック）
   * @private
   */
  async _generateFromImage(audioPath, outputPath, backgroundImagePath = 'default') {
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

        // 動画の長さ = 音声の長さ + 1秒
        const videoDuration = audioDuration + 1.0;
        console.log(`Target video duration: ${videoDuration} seconds`);

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
            '-crf 28',  // 品質設定（23→28で圧縮率向上）
            '-maxrate 1500k',  // 最大ビットレート制限
            '-bufsize 3000k',  // バッファサイズ（maxrateの2倍）
            '-preset medium',  // エンコード速度/品質バランス
            '-tune stillimage',  // 静止画最適化
            '-c:a aac',  // AAC 音声コーデック
            '-b:a 128k',  // 音声ビットレート（192k→128k）
            '-pix_fmt yuv420p',  // ピクセルフォーマット（互換性）
            `-t ${videoDuration}`,  // 動画の長さを明示的に指定
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
              audioDurationSeconds: audioDuration,
              videoDurationSeconds: videoDuration
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

  /**
   * ASS字幕ファイルを生成
   * 歌詞を3ブロックに分割し、フェード+ムーブアニメーションで表示
   *
   * @param {string} lyricsText - 歌詞テキスト
   * @param {number} audioDurationSeconds - 音声の長さ（秒）
   * @param {string} assPath - 出力ASSファイルパス
   * @returns {Promise<void>}
   */
  async generateAssFile(lyricsText, audioDurationSeconds, assPath) {
    // 1. 歌詞のサニタイズ
    const sanitizedLyrics = this._sanitizeLyrics(lyricsText);
    if (!sanitizedLyrics.trim()) {
      console.log('Lyrics is empty after sanitization, skipping ASS generation');
      return;
    }

    // 2. 3ブロックに分割
    const blocks = this._splitLyricsIntoBlocks(sanitizedLyrics, 3);
    console.log(`Lyrics split into ${blocks.length} blocks`);

    // 3. タイミング計算
    const dur = audioDurationSeconds;
    const t0 = 0.5;
    const tEnd = Math.max(3.0, dur - 0.5);
    const blockDuration = (tEnd - t0) / blocks.length;

    // 各ブロック最低2.5秒は確保
    const minBlockDuration = 2.5;
    const effectiveBlockDuration = Math.max(blockDuration, minBlockDuration);

    // 4. ASSファイル生成
    const assContent = this._buildAssContent(blocks, t0, effectiveBlockDuration);

    // 5. ファイル書き出し
    await fs.writeFile(assPath, assContent, 'utf8');
    console.log(`ASS file generated: ${assPath}`);
  }

  /**
   * 歌詞のサニタイズ
   * @private
   */
  _sanitizeLyrics(text) {
    // 空行トリム、連続空行は1つに
    let lines = text.split('\n');

    // 先頭が "[" の行（[Chorus]等）を除去
    lines = lines.filter(line => !line.trim().startsWith('['));

    // 各行をトリム
    lines = lines.map(line => line.trim());

    // 連続空行を1つに
    const result = [];
    let prevEmpty = false;
    for (const line of lines) {
      if (line === '') {
        if (!prevEmpty) {
          result.push('');
          prevEmpty = true;
        }
      } else {
        result.push(line);
        prevEmpty = false;
      }
    }

    // 先頭と末尾の空行を除去
    while (result.length > 0 && result[0] === '') {
      result.shift();
    }
    while (result.length > 0 && result[result.length - 1] === '') {
      result.pop();
    }

    return result.join('\n');
  }

  /**
   * 歌詞を指定数のブロックに分割
   * 段落（空行）単位で分割し、足りなければ行数で均等に分割
   * @private
   */
  _splitLyricsIntoBlocks(text, numBlocks) {
    // まず段落で分割
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

    if (paragraphs.length >= numBlocks) {
      // 段落が十分にある場合は段落単位で分割
      const result = [];
      const paragraphsPerBlock = Math.ceil(paragraphs.length / numBlocks);

      for (let i = 0; i < numBlocks; i++) {
        const start = i * paragraphsPerBlock;
        const end = Math.min(start + paragraphsPerBlock, paragraphs.length);
        if (start < paragraphs.length) {
          result.push(paragraphs.slice(start, end).join('\n\n'));
        }
      }

      return result;
    }

    // 段落が足りない場合は行数で均等分割
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      return [];
    }

    if (lines.length <= numBlocks) {
      // 行数がブロック数以下の場合はそのまま
      return lines.map(line => line);
    }

    // 行数で均等分割
    const result = [];
    const linesPerBlock = Math.ceil(lines.length / numBlocks);

    for (let i = 0; i < numBlocks; i++) {
      const start = i * linesPerBlock;
      const end = Math.min(start + linesPerBlock, lines.length);
      if (start < lines.length) {
        result.push(lines.slice(start, end).join('\n'));
      }
    }

    return result;
  }

  /**
   * ASSファイルの内容を構築
   * @private
   */
  _buildAssContent(blocks, startTime, blockDuration) {
    // ASSヘッダー（1080x1920縦型動画用）
    const header = `[Script Info]
Title: Birthday Song Lyrics
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK JP,60,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,40,40,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // ダイアログ行を生成
    const dialogLines = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const start = startTime + (i * blockDuration);
      const end = start + blockDuration;

      // 時間を ASS フォーマットに変換（H:MM:SS.CC）
      const startStr = this._formatAssTime(start);
      const endStr = this._formatAssTime(end);

      // テキスト内の改行を \N に変換
      const text = block.replace(/\n/g, '\\N');

      // \fad(300,300) + \move(540,1500,540,1380) で簡易モーション
      // 下から上に少し動きながらフェードイン/アウト
      const effectText = `{\\fad(300,300)\\move(540,1500,540,1380)}${text}`;

      dialogLines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${effectText}`);
    }

    return header + dialogLines.join('\n') + '\n';
  }

  /**
   * 秒数をASSタイムフォーマット（H:MM:SS.CC）に変換
   * @private
   */
  _formatAssTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);

    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  // ===========================================
  // V2: 音楽同期字幕生成（lineEvents ベース）
  // ===========================================

  /**
   * V2: lineEvents から ASS ファイルを生成
   * 音楽のタイムスタンプに合わせた字幕タイミング
   *
   * @param {Array<{start: number, end: number, text: string}>} lineEvents - 行イベント配列
   * @param {number} audioDurationSeconds - 音声の長さ（秒）
   * @param {string} assPath - 出力ASSファイルパス
   * @returns {Promise<void>}
   */
  async generateAssFileV2(lineEvents, audioDurationSeconds, assPath) {
    if (!lineEvents || lineEvents.length === 0) {
      console.log('[V2 ASS] lineEvents is empty, skipping ASS generation');
      return;
    }

    console.log(`[V2 ASS] Generating ASS with ${lineEvents.length} line events`);

    // ASSファイル生成
    const assContent = this._buildAssContentV2(lineEvents, audioDurationSeconds);

    // ファイル書き出し
    await fs.writeFile(assPath, assContent, 'utf8');
    console.log(`[V2 ASS] ASS file generated: ${assPath}`);
  }

  /**
   * V2: ASSファイルの内容を構築（lineEventsベース）
   * @private
   */
  _buildAssContentV2(lineEvents, audioDuration) {
    // ASSヘッダー（V1と同じ見た目を維持）
    const header = `[Script Info]
Title: Birthday Song Lyrics V2
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK JP,60,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,40,40,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // ダイアログ行を生成
    const dialogLines = [];

    for (let i = 0; i < lineEvents.length; i++) {
      const event = lineEvents[i];
      let { start, end, text } = event;

      // audioDurationを超えないようにclamp
      if (end > audioDuration) {
        end = audioDuration;
      }
      if (start >= audioDuration) {
        continue;
      }

      // 時間を ASS フォーマットに変換
      const startStr = this._formatAssTime(start);
      const endStr = this._formatAssTime(end);

      // テキストの整形（長い行は折り返し）
      const formattedText = this._formatLineTextV2(text);

      // V1と同じエフェクト: \fad(300,300) + \move(540,1500,540,1380)
      // 下から上に少し動きながらフェードイン/アウト
      const effectText = `{\\fad(300,300)\\move(540,1500,540,1380)}${formattedText}`;

      dialogLines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${effectText}`);
    }

    return header + dialogLines.join('\n') + '\n';
  }

  /**
   * V2: 行テキストの整形（長すぎる場合は折り返し）
   * @private
   */
  _formatLineTextV2(text) {
    // 既存の改行を \N に変換
    let formatted = text.replace(/\n/g, '\\N');

    // 1行が長すぎる場合は自動折り返し（約30文字で折り返し）
    const maxLineLength = 30;

    if (this._countTextLength(formatted) > maxLineLength && !formatted.includes('\\N')) {
      formatted = this._autoWrapText(formatted, maxLineLength);
    }

    return formatted;
  }

  /**
   * テキストの表示長をカウント（日本語は1、ASCIIは0.5）
   * @private
   */
  _countTextLength(text) {
    let count = 0;
    for (const char of text) {
      if (char.charCodeAt(0) < 128) {
        count += 0.5;
      } else {
        count += 1;
      }
    }
    return count;
  }

  /**
   * テキストを自動折り返し（2行まで）
   * @private
   */
  _autoWrapText(text, maxLength) {
    // 簡易実装: 中央付近で分割
    const chars = [...text];
    const totalLength = this._countTextLength(text);

    if (totalLength <= maxLength) {
      return text;
    }

    // 目標: 半分の位置で分割
    const targetLength = totalLength / 2;
    let currentLength = 0;
    let splitIndex = 0;

    for (let i = 0; i < chars.length; i++) {
      const charLength = chars[i].charCodeAt(0) < 128 ? 0.5 : 1;
      currentLength += charLength;

      if (currentLength >= targetLength) {
        splitIndex = i + 1;
        break;
      }
    }

    // 分割して \N で結合
    const firstPart = chars.slice(0, splitIndex).join('');
    const secondPart = chars.slice(splitIndex).join('');

    return `${firstPart}\\N${secondPart}`;
  }

  // ===========================================
  // 写真スライドショー動画生成
  // ===========================================

  /**
   * 写真スライドショー動画を生成（縦型1080x1920）
   *
   * @param {object} options
   * @param {string} options.audioPath - 音声ファイルパス
   * @param {string} options.outputPath - 出力動画ファイルパス
   * @param {string[]} options.photoPaths - 写真ファイルパス配列（1-5枚）
   * @returns {Promise<{outputPath: string, audioDurationSeconds: number, videoDurationSeconds: number}>}
   */
  async generateSlideshowVideo({ audioPath, outputPath, photoPaths }) {
    const audioDuration = await this.getAudioDuration(audioPath);
    const numPhotos = photoPaths.length;

    console.log(`[Slideshow] Generating slideshow: ${numPhotos} photos, audio: ${audioDuration}s`);

    // 出力ディレクトリ作成
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    if (numPhotos === 1) {
      return this._generateFromSinglePhoto(audioPath, outputPath, photoPaths[0], audioDuration);
    }

    return this._generateFromMultiplePhotos(audioPath, outputPath, photoPaths, audioDuration);
  }

  /**
   * 1枚の写真から動画生成（静止画ベース）
   * @private
   */
  async _generateFromSinglePhoto(audioPath, outputPath, photoPath, audioDuration) {
    return new Promise((resolve, reject) => {
      console.log(`[Slideshow] Single photo mode: ${photoPath}`);

      ffmpeg()
        .input(photoPath)
        .inputOptions(['-loop', '1', '-framerate', '2'])
        .input(audioPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-crf', '28',
          '-maxrate', '1500k',
          '-bufsize', '3000k',
          '-preset', 'medium',
          '-tune', 'stillimage',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-pix_fmt', 'yuv420p',
          '-shortest',
          '-movflags', '+faststart',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1',
        ])
        .format('mp4')
        .on('start', (cmd) => console.log('[Slideshow] FFmpeg command:', cmd))
        .on('progress', (p) => {
          if (p.percent) console.log(`[Slideshow] Processing: ${Math.floor(p.percent)}% done`);
        })
        .on('end', () => {
          console.log('[Slideshow] Single photo video completed');
          resolve({
            outputPath,
            audioDurationSeconds: audioDuration,
            videoDurationSeconds: audioDuration,
          });
        })
        .on('error', (err) => {
          console.error('[Slideshow] FFmpeg error:', err);
          reject(new Error(`Slideshow generation failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  /**
   * 複数写真からクロスフェードスライドショー動画生成（2-5枚）
   * @private
   */
  async _generateFromMultiplePhotos(audioPath, outputPath, photoPaths, audioDuration) {
    return new Promise((resolve, reject) => {
      const numPhotos = photoPaths.length;
      const crossfadeDuration = 1.0;

      // 1枚あたりの表示時間を計算
      // total = N * perPhoto - (N-1) * crossfade = audioDuration
      // perPhoto = (audioDuration + (N-1) * crossfade) / N
      const perPhotoDuration = (audioDuration + (numPhotos - 1) * crossfadeDuration) / numPhotos;

      console.log(`[Slideshow] Multi-photo mode: ${numPhotos} photos, ${perPhotoDuration.toFixed(2)}s each, crossfade: ${crossfadeDuration}s`);

      // FFmpeg complex filter graphを構築
      const filterParts = [];

      // Step 1: 各写真をスケール・クロップして指定秒数の動画ストリームにする
      const loopFrames = Math.ceil(perPhotoDuration * 30) + 30; // 余裕を持たせる
      for (let i = 0; i < numPhotos; i++) {
        filterParts.push(
          `[${i}:v]loop=loop=${loopFrames}:size=1:start=0,` +
          `setpts=N/30/TB,` +
          `scale=1080:1920:force_original_aspect_ratio=increase,` +
          `crop=1080:1920,` +
          `setsar=1,` +
          `trim=duration=${perPhotoDuration.toFixed(3)},` +
          `setpts=PTS-STARTPTS,` +
          `format=yuv420p` +
          `[v${i}]`
        );
      }

      // Step 2: xfade で連鎖的にクロスフェード
      let currentLabel = 'v0';
      for (let i = 1; i < numPhotos; i++) {
        const offset = i * (perPhotoDuration - crossfadeDuration);
        const outputLabel = i === numPhotos - 1 ? 'vout' : `xf${i - 1}`;
        filterParts.push(
          `[${currentLabel}][v${i}]xfade=transition=fade:duration=${crossfadeDuration}:offset=${offset.toFixed(3)}[${outputLabel}]`
        );
        currentLabel = outputLabel;
      }

      const filterComplex = filterParts.join('; ');

      // ffmpegコマンドを構築
      const command = ffmpeg();

      // 全写真を入力として追加
      for (const photoPath of photoPaths) {
        command.input(photoPath);
      }

      // 音声を最後の入力として追加
      command.input(audioPath);

      command
        .complexFilter(filterComplex)
        .outputOptions([
          '-map', '[vout]',
          '-map', `${numPhotos}:a:0`,
          '-c:v', 'libx264',
          '-crf', '28',
          '-maxrate', '1500k',
          '-bufsize', '3000k',
          '-preset', 'medium',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-pix_fmt', 'yuv420p',
          '-shortest',
          '-movflags', '+faststart',
          '-r', '30',
        ])
        .format('mp4')
        .on('start', (cmd) => console.log('[Slideshow] FFmpeg command:', cmd))
        .on('progress', (p) => {
          if (p.percent) console.log(`[Slideshow] Processing: ${Math.floor(p.percent)}% done`);
        })
        .on('end', () => {
          console.log('[Slideshow] Multi-photo video completed');
          resolve({
            outputPath,
            audioDurationSeconds: audioDuration,
            videoDurationSeconds: audioDuration,
          });
        })
        .on('error', (err) => {
          console.error('[Slideshow] FFmpeg error:', err);
          reject(new Error(`Slideshow generation failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }
}

module.exports = VideoService;
