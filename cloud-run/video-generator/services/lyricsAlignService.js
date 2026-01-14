/**
 * Lyrics Alignment Service
 * V2: alignedWords (word-level timestamps) を lineEvents (行単位) に変換する
 */

class LyricsAlignService {
  constructor(options = {}) {
    // 設定パラメータ（必要に応じて調整可能）
    this.gapThreshold = options.gapThreshold || 0.6; // 行区切り判定: ギャップ秒数
    this.maxCharsPerLine = options.maxCharsPerLine || 24; // 日本語1行の最大文字数
    this.maxLines = options.maxLines || 40; // 最大行数（超えたら閾値を上げて再生成）
    this.minLineDuration = options.minLineDuration || 0.5; // 最小行表示時間（秒）
    this.defaultWordDuration = options.defaultWordDuration || 0.4; // end未指定時のデフォルト長さ
  }

  /**
   * alignedWords を lineEvents に変換
   *
   * @param {Array<{word: string, start: number, end: number|null}>} alignedWords
   * @param {number} audioDuration - 音声の長さ（秒）
   * @returns {Array<{start: number, end: number, text: string}>} lineEvents
   */
  convertToLineEvents(alignedWords, audioDuration) {
    if (!alignedWords || alignedWords.length === 0) {
      console.warn('[LyricsAlignService] alignedWords is empty');
      return [];
    }

    console.log(`[LyricsAlignService] Converting ${alignedWords.length} words to line events`);

    // 1. 単語の前処理（end補完、無効データ除去）
    const processedWords = this._preprocessWords(alignedWords, audioDuration);

    if (processedWords.length === 0) {
      console.warn('[LyricsAlignService] No valid words after preprocessing');
      return [];
    }

    // 2. 行に分割
    let lineEvents = this._splitIntoLines(processedWords, this.maxCharsPerLine);

    // 3. 行数が多すぎる場合は閾値を上げて再生成
    if (lineEvents.length > this.maxLines) {
      console.log(`[LyricsAlignService] Too many lines (${lineEvents.length}), increasing char threshold`);
      lineEvents = this._splitIntoLines(processedWords, this.maxCharsPerLine + 12);

      // それでも多い場合はさらに閾値を上げる
      if (lineEvents.length > this.maxLines) {
        lineEvents = this._splitIntoLines(processedWords, this.maxCharsPerLine + 24);
      }
    }

    // 4. 後処理（最小表示時間の確保、duration clamp）
    lineEvents = this._postprocessLines(lineEvents, audioDuration);

    console.log(`[LyricsAlignService] Generated ${lineEvents.length} line events`);
    return lineEvents;
  }

  /**
   * 単語の前処理
   * - セクションタグ ([Verse], [Chorus], 等) の除去
   * - start/end の逆転チェック
   * - end が無い場合の補完
   * - 無効データの除去
   */
  _preprocessWords(words, audioDuration) {
    const result = [];

    // セクションタグのパターン: [Verse], [Chorus], [Pre-Chorus], [Final Chorus], [Bridge], [Outro], [Intro], etc.
    const sectionTagPattern = /\[(Verse|Chorus|Pre-Chorus|Final\s*Chorus|Bridge|Outro|Intro|Hook|Interlude|Breakdown|Drop|Verse\s*\d*|Chorus\s*\d*)\]/gi;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // 空の単語をスキップ
      if (!word.word || word.word.trim() === '') {
        continue;
      }

      // セクションタグを除去
      let cleanedWord = word.word.replace(sectionTagPattern, '').trim();

      // タグ除去後に空になった場合はスキップ
      if (cleanedWord === '') {
        continue;
      }

      // 元のwordオブジェクトを更新
      word.word = cleanedWord;

      // startが無効な場合スキップ
      if (typeof word.start !== 'number' || word.start < 0) {
        continue;
      }

      let start = word.start;
      let end = word.end;

      // end が無い場合は補完
      if (end === null || typeof end !== 'number') {
        // 次の単語のstartを使うか、デフォルト値を加算
        const nextWord = words[i + 1];
        if (nextWord && typeof nextWord.start === 'number') {
          end = Math.min(nextWord.start, start + this.defaultWordDuration);
        } else {
          end = start + this.defaultWordDuration;
        }
      }

      // start > end の場合はスキップ
      if (start > end) {
        continue;
      }

      // audioDurationを超える場合はclamp
      if (end > audioDuration) {
        end = audioDuration;
      }
      if (start > audioDuration) {
        continue;
      }

      result.push({
        word: word.word.trim(),
        start,
        end
      });
    }

    return result;
  }

  /**
   * 単語を行に分割
   * 分割ルール:
   * 1. 単語間のギャップが閾値以上
   * 2. 句読点/終端記号を含む
   * 3. 文字数が閾値以上
   */
  _splitIntoLines(words, maxChars) {
    const lines = [];
    let currentLine = {
      words: [],
      text: '',
      start: null,
      end: null
    };

    // 句読点/終端記号のパターン
    const endingPattern = /[。！？!?…、,．.：:;；」』）)】〉》〕］\]]/;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const prevWord = words[i - 1];

      // 最初の単語、または改行条件を判定
      let shouldBreak = false;

      if (currentLine.words.length > 0) {
        // 条件1: 単語間ギャップが大きい
        if (prevWord && (word.start - prevWord.end) > this.gapThreshold) {
          shouldBreak = true;
        }

        // 条件2: 前の単語が句読点で終わっている
        if (prevWord && endingPattern.test(prevWord.word)) {
          shouldBreak = true;
        }

        // 条件3: 現在の行の文字数が閾値以上
        const newLength = this._countChars(currentLine.text + word.word);
        if (newLength > maxChars) {
          shouldBreak = true;
        }
      }

      if (shouldBreak && currentLine.words.length > 0) {
        // 現在の行を確定
        lines.push({
          start: currentLine.start,
          end: currentLine.end,
          text: currentLine.text
        });

        // 新しい行を開始
        currentLine = {
          words: [],
          text: '',
          start: null,
          end: null
        };
      }

      // 単語を現在の行に追加
      currentLine.words.push(word);
      if (currentLine.start === null) {
        currentLine.start = word.start;
      }
      currentLine.end = word.end;

      // テキストを結合（日本語は空白なし、英語は空白あり）
      if (currentLine.text) {
        // 前の文字と現在の単語が両方ASCII（英語）なら空白を挿入
        const lastChar = currentLine.text.slice(-1);
        const firstChar = word.word.charAt(0);
        if (this._isAscii(lastChar) && this._isAscii(firstChar)) {
          currentLine.text += ' ';
        }
      }
      currentLine.text += word.word;
    }

    // 最後の行を追加
    if (currentLine.words.length > 0) {
      lines.push({
        start: currentLine.start,
        end: currentLine.end,
        text: currentLine.text
      });
    }

    return lines;
  }

  /**
   * 行の後処理
   * - 最小表示時間の確保
   * - 最終行のduration clamp
   */
  _postprocessLines(lines, audioDuration) {
    return lines.map((line, index) => {
      let { start, end, text } = line;

      // 最小表示時間の確保
      const duration = end - start;
      if (duration < this.minLineDuration) {
        end = start + this.minLineDuration;
      }

      // audioDurationを超えないようにclamp
      if (end > audioDuration) {
        end = audioDuration;
        // それでもstartより小さくなる場合は調整
        if (end <= start) {
          start = Math.max(0, end - this.minLineDuration);
        }
      }

      return { start, end, text };
    });
  }

  /**
   * 文字数をカウント（日本語は1文字、ASCIIは0.5文字として換算）
   */
  _countChars(text) {
    let count = 0;
    for (const char of text) {
      if (this._isAscii(char)) {
        count += 0.5;
      } else {
        count += 1;
      }
    }
    return count;
  }

  /**
   * ASCII文字かどうか判定
   */
  _isAscii(char) {
    return char.charCodeAt(0) < 128;
  }
}

module.exports = LyricsAlignService;
