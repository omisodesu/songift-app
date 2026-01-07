/**
 * Suno API Service
 * V2 lyrics alignment: timestamped lyrics (alignedWords) を取得する
 */

class SunoService {
  constructor() {
    // 環境変数から設定を取得
    this.apiKey = process.env.SUNO_API_KEY;
    this.baseUrl = process.env.SUNO_BASE_URL || 'https://api.sunoapi.org/api/v1';
  }

  /**
   * Suno APIからalignedWords（タイムスタンプ付き歌詞）を取得
   *
   * @param {string} sunoTaskId - Sunoの生成タスクID
   * @param {string} selectedSongUrl - 選択された曲のaudio_url
   * @returns {Promise<Array|null>} alignedWords配列、または取得失敗時はnull
   */
  async getAlignedWords(sunoTaskId, selectedSongUrl) {
    if (!this.apiKey) {
      console.warn('[SunoService] SUNO_API_KEY not configured');
      return null;
    }

    if (!sunoTaskId) {
      console.warn('[SunoService] sunoTaskId is missing');
      return null;
    }

    if (!selectedSongUrl) {
      console.warn('[SunoService] selectedSongUrl is missing');
      return null;
    }

    try {
      console.log(`[SunoService] Fetching record-info for taskId: ${sunoTaskId}`);

      const response = await fetch(
        `${this.baseUrl}/generate/record-info?taskId=${sunoTaskId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.warn(`[SunoService] API request failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const result = await response.json();

      if (result.code !== 200) {
        console.warn(`[SunoService] API returned error code: ${result.code}, msg: ${result.msg}`);
        return null;
      }

      // sunoData配列から選択された曲を見つける
      const sunoData = result.data?.response?.sunoData || [];

      if (sunoData.length === 0) {
        console.warn('[SunoService] sunoData is empty');
        return null;
      }

      // selectedSongUrl に一致する曲を検索
      const selectedSong = sunoData.find(song => {
        const audioUrl = song.audioUrl || song.audio_url;
        return audioUrl === selectedSongUrl;
      });

      if (!selectedSong) {
        console.warn(`[SunoService] No song found matching selectedSongUrl: ${selectedSongUrl}`);
        console.log(`[SunoService] Available songs: ${sunoData.map(s => s.audioUrl || s.audio_url).join(', ')}`);
        return null;
      }

      console.log(`[SunoService] Found selected song: id=${selectedSong.id}`);

      // alignedWords を探索（複数の可能なパスを試す）
      let alignedWords = null;

      // パス1: song.alignedWords
      if (Array.isArray(selectedSong.alignedWords) && selectedSong.alignedWords.length > 0) {
        alignedWords = selectedSong.alignedWords;
        console.log(`[SunoService] Found alignedWords at song.alignedWords (${alignedWords.length} items)`);
      }
      // パス2: song.lyricsAlignment.alignedWords
      else if (selectedSong.lyricsAlignment?.alignedWords &&
               Array.isArray(selectedSong.lyricsAlignment.alignedWords) &&
               selectedSong.lyricsAlignment.alignedWords.length > 0) {
        alignedWords = selectedSong.lyricsAlignment.alignedWords;
        console.log(`[SunoService] Found alignedWords at song.lyricsAlignment.alignedWords (${alignedWords.length} items)`);
      }
      // パス3: song.lyrics_alignment.aligned_words (snake_case版)
      else if (selectedSong.lyrics_alignment?.aligned_words &&
               Array.isArray(selectedSong.lyrics_alignment.aligned_words) &&
               selectedSong.lyrics_alignment.aligned_words.length > 0) {
        alignedWords = selectedSong.lyrics_alignment.aligned_words;
        console.log(`[SunoService] Found alignedWords at song.lyrics_alignment.aligned_words (${alignedWords.length} items)`);
      }

      // パス4: result.data.response.alignedWords (トップレベル)
      if (!alignedWords && result.data?.response?.alignedWords &&
          Array.isArray(result.data.response.alignedWords) &&
          result.data.response.alignedWords.length > 0) {
        alignedWords = result.data.response.alignedWords;
        console.log(`[SunoService] Found alignedWords at response.alignedWords (${alignedWords.length} items)`);
      }

      if (!alignedWords) {
        console.warn('[SunoService] alignedWords not found in any expected location');
        // デバッグ用: 利用可能なキーをログ出力
        console.log(`[SunoService] Available keys in selectedSong: ${Object.keys(selectedSong).join(', ')}`);
        return null;
      }

      // alignedWords の正規化（異なるフォーマットを統一）
      const normalizedWords = this._normalizeAlignedWords(alignedWords);

      if (normalizedWords.length === 0) {
        console.warn('[SunoService] alignedWords normalization resulted in empty array');
        return null;
      }

      console.log(`[SunoService] Successfully retrieved ${normalizedWords.length} aligned words`);
      return normalizedWords;

    } catch (error) {
      console.error(`[SunoService] Error fetching alignedWords: ${error.message}`);
      return null;
    }
  }

  /**
   * alignedWordsを正規化（異なるAPIフォーマットを統一形式に変換）
   *
   * @param {Array} words - 元のalignedWords配列
   * @returns {Array<{word: string, start: number, end: number}>}
   */
  _normalizeAlignedWords(words) {
    return words
      .map(w => {
        // 様々なフォーマットに対応
        const word = w.word || w.text || w.value || '';
        const start = w.start ?? w.startTime ?? w.start_time ?? null;
        const end = w.end ?? w.endTime ?? w.end_time ?? null;

        // 不正なデータをスキップ
        if (!word || typeof word !== 'string') {
          return null;
        }
        if (start === null || typeof start !== 'number' || start < 0) {
          return null;
        }

        // endが無い場合は後で補完するので、nullのままでも許容
        return {
          word: word.trim(),
          start,
          end: (end !== null && typeof end === 'number' && end >= start) ? end : null
        };
      })
      .filter(w => w !== null);
  }
}

module.exports = SunoService;
