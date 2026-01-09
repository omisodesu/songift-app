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
      // Step 1: record-info から audioId を取得
      console.log(`[SunoService] Fetching record-info for taskId: ${sunoTaskId}`);

      const recordInfoResponse = await fetch(
        `${this.baseUrl}/generate/record-info?taskId=${sunoTaskId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!recordInfoResponse.ok) {
        console.warn(`[SunoService] record-info request failed: ${recordInfoResponse.status} ${recordInfoResponse.statusText}`);
        return null;
      }

      const recordInfoResult = await recordInfoResponse.json();

      if (recordInfoResult.code !== 200) {
        console.warn(`[SunoService] record-info returned error code: ${recordInfoResult.code}, msg: ${recordInfoResult.msg}`);
        return null;
      }

      // sunoData配列から選択された曲を見つける
      const sunoData = recordInfoResult.data?.response?.sunoData || [];

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

      const audioId = selectedSong.id;
      console.log(`[SunoService] Found selected song: audioId=${audioId}`);

      // Step 2: get-timestamped-lyrics から alignedWords を取得
      console.log(`[SunoService] Fetching timestamped lyrics for taskId: ${sunoTaskId}, audioId: ${audioId}`);

      const lyricsResponse = await fetch(
        `${this.baseUrl}/generate/get-timestamped-lyrics`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            taskId: sunoTaskId,
            audioId: audioId
          })
        }
      );

      if (!lyricsResponse.ok) {
        console.warn(`[SunoService] get-timestamped-lyrics request failed: ${lyricsResponse.status} ${lyricsResponse.statusText}`);
        return null;
      }

      const lyricsResult = await lyricsResponse.json();

      if (lyricsResult.code !== 200) {
        console.warn(`[SunoService] get-timestamped-lyrics returned error code: ${lyricsResult.code}, msg: ${lyricsResult.msg}`);
        return null;
      }

      const alignedWords = lyricsResult.data?.alignedWords;

      if (!Array.isArray(alignedWords) || alignedWords.length === 0) {
        console.warn('[SunoService] alignedWords not found or empty in get-timestamped-lyrics response');
        console.log(`[SunoService] Available keys in response data: ${Object.keys(lyricsResult.data || {}).join(', ')}`);
        return null;
      }

      console.log(`[SunoService] Retrieved ${alignedWords.length} aligned words from get-timestamped-lyrics`);

      // alignedWords の正規化（異なるフォーマットを統一）
      const normalizedWords = this._normalizeAlignedWords(alignedWords);

      if (normalizedWords.length === 0) {
        console.warn('[SunoService] alignedWords normalization resulted in empty array');
        return null;
      }

      console.log(`[SunoService] Successfully normalized ${normalizedWords.length} aligned words`);
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
        // Suno API: startS/endS, 他のAPI: start/end, startTime/endTime
        const start = w.start ?? w.startS ?? w.startTime ?? w.start_time ?? null;
        const end = w.end ?? w.endS ?? w.endTime ?? w.end_time ?? null;

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
