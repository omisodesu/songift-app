/**
 * 簡単モード（魔法診断）用プロンプト
 *
 * Q1: お誕生日の主役のお名前
 * Q2: その人を色で表すと
 * Q3: その人といると、どんな気持ち
 * Q4: 魔法の言葉を一つ贈るなら
 * Q5: その人の新しい一年に、どんな魔法をかけたい
 */

// =====================================================
// マッピング定義（変更しやすいように分離）
// =====================================================

/**
 * Q2（色）→ ジャンル・BPM・楽器・キーの変換
 *
 * キー出現確率:
 * - Key: G（赤、黄色）→ 33.3%
 * - Key: F（青、緑）→ 33.3%
 * - Key: C（紫、白）→ 33.3%
 */
export const COLOR_TO_MUSIC = {
  '情熱の赤': { genre: 'Rock', bpm: 140, instruments: 'electric guitar, drums', key: 'G' },
  '元気な黄色': { genre: 'J-pop', bpm: 100, instruments: 'piano, acoustic guitar', key: 'G' },
  '優しい青': { genre: 'R&B', bpm: 75, instruments: 'piano, saxophone', key: 'F' },
  '癒しの緑': { genre: 'Jazz', bpm: 90, instruments: 'piano, saxophone', key: 'F' },
  '個性的な紫': { genre: 'J-pop', bpm: 100, instruments: 'synthesizer, electric guitar', key: 'C' },
  '純粋な白': { genre: 'J-pop', bpm: 100, instruments: 'piano, strings', key: 'C' },
};

/**
 * Q3（気持ち）→ ボーカル性別の決定
 */
export const FEELING_TO_VOCAL = {
  male: ['元気が出る', '笑える', '刺激的'],
  female: ['安心する', '幸せ'],
  default: 'female',
};

/**
 * Q5（魔法）→ 追加タグ
 */
export const SPELL_TO_TAGS = {
  'キラキラ輝く魔法': '#bright #dreamy',
  '勇気が湧く魔法': '#powerful #uplifting',
  '愛に包まれる魔法': '#warm #emotional',
  '笑顔が溢れる魔法': '#cheerful #fun',
  '希望の魔法': '#hopeful #inspiring',
};

// =====================================================
// 歌詞創作ルール（プロンプト内で使用）
// =====================================================

export const VERSE_GUIDELINES = `
■ Verse（8〜15文字程度、1〜2行）
Q4のメッセージの本質的な意味を、歌いやすく自然な日本語で表現してください。
(創作方針例)
- いつもありがとう → 感謝・支えへの気持ち
- 出会えて本当によかった → 出会いへの感謝・奇跡
- 夢を応援してるよ → 応援・サポート
- 最高の一年になりますように → 祝福・幸せへの願い
- あなたは特別な存在 → 唯一無二の存在感
- これからもよろしくね → 友情・関係継続
- ずっと友達でいてね → 永続的な友情
`;

export const PRE_CHORUS_GUIDELINES = `
■ Pre-Chorus（10〜18文字程度、1〜2行）
Q5の魔法に対応する、前向きで温かいオリジナルフレーズにしてください。
(創作方針例)
- キラキラ輝く魔法 → 夢・希望・輝き
- 勇気が湧く魔法 → 勇気・挑戦・成長
- 愛に包まれる魔法 → 愛情・温かさ・優しさ
- 笑顔が溢れる魔法 → 笑顔・楽しさ・喜び
- 希望の魔法 → 希望・出会い・新しい世界
`;

// =====================================================
// プロンプト生成関数
// =====================================================

/**
 * 簡単モード用のGeminiプロンプトを生成
 * @param {Object} order - 注文データ
 * @returns {string} Gemini API用のプロンプト
 */
export function buildSimpleModePrompt(order) {
  const targetFeeling = Array.isArray(order.targetFeeling)
    ? order.targetFeeling.join(', ')
    : order.targetFeeling;

  // マッピングをプロンプト内で文字列として表示するため変換
  const colorMappingText = Object.entries(COLOR_TO_MUSIC)
    .map(([color, music]) => `- ${color} → ${music.genre}, ${music.bpm} bpm, ${music.instruments} / Key: ${music.key}`)
    .join('\n        ');

  const feelingMappingText = `
        - 「${FEELING_TO_VOCAL.male.join('」「')}」が含まれる → male
        - 「${FEELING_TO_VOCAL.female.join('」「')}」が含まれる → female
        - その他・複数選択 → ${FEELING_TO_VOCAL.default}`;

  const spellMappingText = Object.entries(SPELL_TO_TAGS)
    .map(([spell, tags]) => `- ${spell} → ${tags}`)
    .join('\n        ');

  return `
あなたはプロの作詞作曲家兼Suno AIプロンプトエンジニアです。
以下のフォーム回答を元に、定義されたルールに従って「歌詞」と「Suno AI用プロンプト」を作成してください。

【フォーム回答】
Q1. お誕生日の主役のお名前：${order.targetName}
Q2. その人を色で表すと：${order.targetColor}
Q3. その人といると、どんな気持ち：${targetFeeling}
Q4. 魔法の言葉を一つ贈るなら：${order.magicWord}
Q5. その人の新しい一年に、どんな魔法をかけたい：${order.magicSpell}

【歌詞創作ルール（重要）】
Q4とQ5の選択肢をそのまま使わず、その「意味・感情・メッセージ」を理解して、自然で詩的な日本語の歌詞に創作してください。毎回異なる表現にしてください。
${VERSE_GUIDELINES}
${PRE_CHORUS_GUIDELINES}

【変換ルール】
■ Q2（色）→ ジャンル・BPM・楽器・キーの変換
        ${colorMappingText}

■ Q3（気持ち）→ ボーカル性別の決定${feelingMappingText}

■ Q5（魔法）→ 追加タグ
        ${spellMappingText}

【出力フォーマット (JSON)】
必ず以下のJSON形式のみを出力してください。Markdown記法は不要です。
{
  "lyrics": "[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\n[Verse]\\n(Q4から創作した自然な歌詞)\\n[Pre-Chorus]\\n(Q5から創作した自然な歌詞)\\n[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}",
  "sunoPrompt": "happy birthday | (Q2から変換したジャンル) | (Q2から変換したBPM) | key: (Q2から変換したKey) | (Q2から変換した楽器), clap | Japanese (Q3から決定したvocal) vocal | #birthday #upbeat #groovy (Q5から変換した追加タグ)"
}
  `.trim();
}
