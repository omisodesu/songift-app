/**
 * プロモード用プロンプト
 *
 * Q1: ジャンル
 * Q2: 楽器（複数可）
 * Q3: 歌い手の性別
 * Q4: 呼び名
 * Q5-1: メッセージ1（Aメロ用）
 * Q5-2: メッセージ2（Bメロ用）
 */

// =====================================================
// マッピング定義（変更しやすいように分離）
// =====================================================

/**
 * ジャンル → BPMの変換
 */
export const GENRE_TO_BPM = {
  'J-pop（明るいポップス）': { genre: 'J-pop', bpm: 100 },
  'R&B（おしゃれでスムーズ）': { genre: 'R&B', bpm: 75 },
  'Rock（パワフルで熱い）': { genre: 'Rock', bpm: 140 },
  'Jazz（大人っぽく洗練）': { genre: 'Jazz', bpm: 90 },
  'Acoustic（温かみのある生音）': { genre: 'Acoustic', bpm: 90 },
  'EDM（ノリノリでダンサブル）': { genre: 'EDM', bpm: 128 },
  'Bossa Nova（リラックスした雰囲気）': { genre: 'Bossa Nova', bpm: 80 },
};

/**
 * 楽器 → 英語名・キーの変換
 *
 * キー決定ルール（優先順位）:
 * 1. 「その他」が選択されている → Key: C（統一）
 * 2. Guitar, Ukulele, Keyboard が含まれる → Key: G
 * 3. Saxophone, Piano が含まれる → Key: F
 * 4. Synthesizer のみ → Key: C
 * 5. 上記該当なし → Key: C（デフォルト）
 *
 * キー出現確率（理論値）:
 * - Key: G（Guitar, Ukulele, Keyboard）→ 約35-40%
 * - Key: F（Saxophone, Piano）→ 約30-35%
 * - Key: C（Synthesizer, その他）→ 約30-35%
 */
export const INSTRUMENT_MAPPING = {
  'Piano（ピアノ）': { english: 'piano', key: 'F' },
  'Acoustic Guitar（アコースティックギター）': { english: 'acoustic guitar', key: 'G' },
  'Electric Guitar（エレキギター）': { english: 'electric guitar', key: 'G' },
  'Ukulele（ウクレレ）': { english: 'ukulele', key: 'G' },
  'Keyboard（キーボード）': { english: 'keyboard', key: 'G' },
  'Trumpet（トランペット）': { english: 'trumpet', key: null },
  'Saxophone（サックス）': { english: 'saxophone', key: 'F' },
  'Violin（バイオリン）': { english: 'violin', key: null },
  'Strings（ストリングス）': { english: 'strings', key: null },
  'Bells（ベル）': { english: 'bells', key: null },
  'Synthesizer（シンセサイザー）': { english: 'synthesizer', key: 'C' },
  'Harmonica（ハーモニカ）': { english: 'harmonica', key: null },
  'その他': { english: 'other', key: 'C' },
};

/**
 * 性別 → 英語の変換
 */
export const GENDER_MAPPING = {
  '男性（Male）': 'male',
  '女性（Female）': 'female',
};

// =====================================================
// プロンプト生成関数
// =====================================================

/**
 * プロモード用のGeminiプロンプトを生成
 * @param {Object} order - 注文データ
 * @returns {string} Gemini API用のプロンプト
 */
export function buildProModePrompt(order) {
  const instruments = Array.isArray(order.proInstruments)
    ? order.proInstruments.join(', ')
    : order.proInstruments;

  // マッピングをプロンプト内で文字列として表示するため変換
  const genreMappingText = Object.entries(GENRE_TO_BPM)
    .map(([label, data]) => `- ${label} → ジャンル：${data.genre} / BPM：${data.bpm} bpm`)
    .join('\n        ');

  return `
あなたはプロの作詞作曲家兼Suno AIプロンプトエンジニアです。
以下のフォーム回答を元に、定義されたルールに従って「歌詞」と「Suno AI用プロンプト」を作成してください。

【フォーム回答】
質問1（ジャンル）：${order.proGenre}
質問2（楽器）：${instruments}
質問3（性別）：${order.proGender}
質問4（名前）：${order.targetName}
質問5-1（メッセージ1）：${order.proMessage1}
質問5-2（メッセージ2）：${order.proMessage2}

【抽出・変換ルール】
■ 質問1（ジャンル）→ ジャンル名とBPMを抽出
        ${genreMappingText}

■ 質問2（楽器）→ 楽器名とキーを抽出

【キー決定ルール（優先順位）】
1. 「その他」が選択されている → Key: C（統一）
2. Guitar, Ukulele, Keyboard が含まれる → Key: G
3. Saxophone, Piano が含まれる → Key: F
4. Synthesizer のみ → Key: C
5. 上記該当なし → Key: C（デフォルト）

【楽器とキーの対応表】
- Guitar（ギター）→ guitar / Key: G
- Ukulele（ウクレレ）→ ukulele / Key: G
- Keyboard（キーボード）→ keyboard / Key: G
- Saxophone（サックス）→ saxophone / Key: F
- Piano（ピアノ）→ piano / Key: F
- Synthesizer（シンセサイザー）→ synthesizer / Key: C
- その他 → Key: C

【組み合わせ例】
- Guitar + Piano → guitar, piano / Key: G
- Saxophone + Piano → saxophone, piano / Key: F
- Piano + Synthesizer → piano, synthesizer / Key: F
- Keyboard + Synthesizer → keyboard, synthesizer / Key: G
- Guitar + その他「バイオリン」→ guitar, violin / Key: C

■ 質問3（性別）→ 英語部分を小文字で抽出
- 男性（Male）→ male
- 女性（Female）→ female

■ 質問4（名前）→ そのまま使用

■ 質問5-1、5-2（メッセージ）の変換ルール
- 歌詞部分：漢字をひらがなに変換（例：「素敵な一年」→「すてきないちねん」）

【出力フォーマット (JSON)】
必ず以下のJSON形式のみを出力してください。Markdown記法は不要です。
{
  "lyrics": "[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\n[Verse]\\n(質問5-1の回答をひらがな変換したもの)\\n[Pre-Chorus]\\n(質問5-2の回答をひらがな変換したもの)\\n[Final Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}",
  "sunoPrompt": "happy birthday | (質問1から抽出したジャンル名) | (質問1から抽出したBPM) | key: (質問2から決定したKey) | (質問2から抽出した楽器名小文字), clap | Japanese (質問3から抽出したvocal小文字) vocal | #birthday #upbeat #groovy"
}
  `.trim();
}
