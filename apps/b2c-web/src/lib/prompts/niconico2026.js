/**
 * ニコ超2026 8bitモード用プロンプト
 *
 * Q1: お誕生日の方の呼び名
 * Q2: 曲調・ジャンル
 * Q3: 誰の誕生日ソングを作るか
 * Q4: 推しの好きなところ
 * Q5: これからどうなってほしいか
 */

export const NC_GENRE_TO_MUSIC = {
  'RPG風': {
    genre: '8-bit RPG Chiptune',
    bpm: '110 bpm',
    style: 'bright, cheerful, epic | Dragon Quest style',
    metaphor: '冒険・魔法・勇者・仲間・クエスト・呪文・伝説',
  },
  'アクション風': {
    genre: '8-bit Action Chiptune',
    bpm: '135 bpm',
    style: 'bright, energetic, bouncy | Super Mario style',
    metaphor: 'ステージ・パワーアップ・スター・1UP・コイン・ジャンプ',
  },
  'シューティング風': {
    genre: '8-bit Shooting Chiptune',
    bpm: '125 bpm',
    style: 'bright, heroic, exciting | Gradius style',
    metaphor: 'ビーム・シールド・光弾・宇宙・翼・弾幕',
  },
  'パズル風': {
    genre: '8-bit Puzzle Chiptune',
    bpm: '118 bpm',
    style: 'bright, cheerful, playful | Tetris style',
    metaphor: 'ピース・コンボ・連鎖・ブロック・パズル・つながる',
  },
};

export const NC_WISH_TO_TAGS = {
  '🚀 もっとバズってほしい': '#powerful #uplifting #inspiring',
  '🌟 ずっと配信続けてほしい': '#warm #emotional #gentle',
  '📈 登録者どんどん増えてほしい': '#bright #dreamy #hopeful',
  '😊 ずっと幸せでいてほしい': '#cheerful #fun #joyful',
  '💪 これからもガチ推しする': '#lucky #positive #bright',
};

const RECIPIENT_GUIDELINES = `
■ Q3 誰の誕生日ソングを作りますか？
- 推し: 画面越しの存在が光のように照らしてくれる
- 推しキャラ: 心のヒーローとして勇気をくれる存在
- 友達: 出会いが世界を変えた喜び・絆
- 恋人・パートナー: 同じ夢を追いかける二人の物語
- 自分自身: 頑張った自分を認めて明日への力にする
`;

const FAVORITE_GUIDELINES = `
■ Q4 推しの好きなところ
- 配信がおもしろすぎる: 言葉・配信が宝物のよう
- 歌・声が神すぎる: 声が天使のよう
- トークが最高すぎる: 笑顔や笑い声が太陽のよう
- ゲームがうますぎる: プレイが魔法や必殺技のよう
- 全部好きすぎる: すべてが奇跡のよう
`;

const WISH_GUIDELINES = `
■ Q5 これからどうなってほしい？
- もっとバズってほしい: もっと高く飛んでいってほしい
- ずっと配信続けてほしい: ずっと輝き続けてほしい
- 登録者どんどん増えてほしい: 夢のステージに立ってほしい
- ずっと幸せでいてほしい: 笑顔の花を咲かせてほしい
- これからもガチ推しする: いつまでも隣で歩いていく
`;

/**
 * ニコ超2026 8bitモード用のGeminiプロンプトを生成
 * @param {Object} order - 注文データ
 * @returns {string} Gemini API用のプロンプト
 */
export function buildNiconico2026Prompt(order) {
  const genreMappingText = Object.entries(NC_GENRE_TO_MUSIC)
    .map(([genre, music]) => `- ${genre} → ${music.genre}, ${music.bpm}, NES sound, 3-voice chiptune, ${music.style}`)
    .join('\n        ');

  const metaphorText = Object.entries(NC_GENRE_TO_MUSIC)
    .map(([genre, music]) => `- ${genre}: ${music.metaphor}の比喩を使う`)
    .join('\n        ');

  const wishTagsText = Object.entries(NC_WISH_TO_TAGS)
    .map(([wish, tags]) => `- ${wish} → ${tags}`)
    .join('\n        ');

  return `
あなたはプロの作詞作曲家兼Suno AIプロンプトエンジニアです。
以下のフォーム回答から、ニコニコ超会議向けの8bitバースデーソングの「歌詞」と「Suno AI用プロンプト」を作成してください。

【フォーム回答】
Q1. お誕生日の方の呼び名：${order.targetName}
Q2. 曲調・ジャンル：${order.ncGenre}
Q3. 誰の誕生日ソングを作りますか？：${order.ncRecipientType}
Q4. 推しの好きなところは？：${order.ncFavoritePoint}
Q5. これからどうなってほしい？：${order.ncWish}

【歌詞創作ルール（重要）】
Q3・Q4・Q5の選択肢をそのまま使わず、その意味・感情・メッセージを理解して、自然で詩的な日本語の歌詞に創作してください。毎回異なる表現にしてください。
- 歌詞部分はすべてひらがな＋カタカナ中心で表記してください。ただしQ1の呼び名は入力された表記をそのまま使用してください。
- 絵文字は歌詞に含めないでください。
- ポジティブで温かく、ニコニコ文化に馴染む親しみやすい表現にしてください。
- 比喩表現を含め、歌いやすいリズムにしてください。

【Verse / Aメロ】
- Q3の意味をもとに創作してください。
- 25〜30文字程度、2行で1つの完結した文章にしてください。
- Q2のジャンルに応じて、次の世界観の比喩を使ってください。
        ${metaphorText}
${RECIPIENT_GUIDELINES}

【Pre-Chorus / Bメロ】
- 1行目はQ4の意味をもとに、12〜15文字程度で創作してください。
- 2行目はQ5の意味をもとに、12〜15文字程度で創作してください。
- 1行目と2行目が自然な2行セットになるようにしてください。
${FAVORITE_GUIDELINES}
${WISH_GUIDELINES}

【Sunoプロンプト変換ルール】
■ Q2（曲調・ジャンル）→ ジャンル・BPM・サウンド・スタイル
        ${genreMappingText}

■ ボーカル指定
- すべて Japanese female vocal, Perfume-style, auto-tuned で固定してください。

■ Q5 → 追加タグ
        ${wishTagsText}

【出力フォーマット (JSON)】
必ず以下のJSON形式のみを出力してください。Markdown記法は不要です。
{
  "lyrics": "[Intro]\\n\\n[Chorus]\\nハッピバースデー ${order.targetName}\\nハッピバースデー ${order.targetName}\\nハッピバースデー ${order.targetName}\\nハッピバースデー ${order.targetName}\\n\\n[Verse]\\n(Q3とQ2ジャンル世界観から創作した自然な歌詞1行目)\\n(Q3とQ2ジャンル世界観から創作した自然な歌詞2行目)\\n\\n[Pre-Chorus]\\n(Q4から創作した12〜15文字程度の歌詞)\\n(Q5から創作した12〜15文字程度の歌詞)\\n\\n[Chorus]\\nハッピバースデー ${order.targetName}\\nハッピバースデー ${order.targetName}\\nハッピバースデー ${order.targetName}\\nハッピバースデー ${order.targetName}",
  "sunoPrompt": "happy birthday | (Q2から変換したGenre) | (Q2から変換したBPM) | NES sound | 3-voice chiptune | Japanese female vocal, Perfume-style, auto-tuned | (Q2から変換したStyle) | #birthday #8bit #ファミコン (Q5から変換した追加タグ)"
}
  `.trim();
}
