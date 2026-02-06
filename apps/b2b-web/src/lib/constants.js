// ---------------------------
// 定数・データ
// ---------------------------

// 簡単モード用
export const COLORS = [
  { label: "🔴 情熱の赤（エネルギッシュ・明るい）", value: "Red (Energetic, Bright)" },
  { label: "🟡 元気な黄色（ポジティブ・太陽みたい）", value: "Yellow (Positive, Sunny)" },
  { label: "🔵 優しい青（穏やか・落ち着いている）", value: "Blue (Gentle, Calm)" },
  { label: "🟢 癒しの緑（安心感・自然体）", value: "Green (Healing, Natural)" },
  { label: "🟣 個性的な紫（おしゃれ・ユニーク）", value: "Purple (Unique, Stylish)" },
  { label: "⚪ 純粋な白（清楚・まじめ）", value: "White (Pure, Serious)" },
];

export const FEELINGS = [
  { label: "😊 楽しい", value: "Fun" },
  { label: "😌 安心する", value: "Relaxed" },
  { label: "💪 元気が出る", value: "Energetic" },
  { label: "🥰 幸せ", value: "Happy" },
  { label: "✨ 刺激的", value: "Exciting" },
  { label: "😁 笑える", value: "Laughing" },
];

export const MAGIC_WORDS = [
  "💖 いつもありがとう",
  "✨ 出会えて本当によかった",
  "🎸 夢を応援してるよ",
  "🎉 最高の一年になりますように",
  "😍 あなたは特別な存在",
  "🌈 これからもよろしくね",
  "⭐ ずっと友達でいてね",
];

export const MAGIC_SPELLS = [
  "✨ キラキラ輝く魔法（夢が叶う）",
  "💪 勇気が湧く魔法（挑戦を応援）",
  "💖 愛に包まれる魔法（温かい一年に）",
  "🎉 笑顔が溢れる魔法（楽しい毎日）",
  "🌈 希望の魔法（素敵な出会いがある）",
];

// プロモード用
export const PRO_GENRES = [
  "J-pop（明るいポップス）",
  "R&B（おしゃれでスムーズ）",
  "Rock（パワフルで熱い）",
  "Jazz（大人っぽく洗練）",
  "Acoustic（温かみのある生音）",
  "EDM（ノリノリでダンサブル）",
  "Bossa Nova（リラックスした雰囲気）"
];

export const PRO_INSTRUMENTS = [
  "Piano（ピアノ）",
  "Acoustic Guitar（アコースティックギター）",
  "Electric Guitar（エレキギター）",
  "Ukulele（ウクレレ）",
  "Trumpet（トランペット）",
  "Saxophone（サックス）",
  "Violin（バイオリン）",
  "Strings（ストリングス）",
  "Bells（ベル・鐘）",
  "Synthesizer（シンセサイザー）",
  "Harmonica（ハーモニカ）",
  "その他"
];

export const PRO_GENDERS = [
  "男性（Male）",
  "女性（Female）"
];

// 楽曲生成用（老人ホーム向け）
export const NH_GENDERS = [
  { label: "👨 男性の声（力強く、温かい雰囲気）", value: "男性" },
  { label: "👩 女性の声（優しく、柔らかい雰囲気）", value: "女性" },
];

export const NH_GENRES = [
  { label: "🎌 演歌（しっとり、情緒たっぷり）", value: "演歌" },
  { label: "🌸 昭和歌謡（懐かしく、温かい）", value: "昭和歌謡" },
  { label: "🎸 フォークソング（優しく、アコースティック）", value: "フォークソング" },
  { label: "🎷 ジャズ（大人っぽく、落ち着いた）", value: "ジャズ" },
];

export const NH_SEASONS = [
  { label: "🌸 春(3月・4月・5月)", value: "春" },
  { label: "🌊 夏(6月・7月・8月)", value: "夏" },
  { label: "🍁 秋(9月・10月・11月)", value: "秋" },
  { label: "⛄ 冬(12月・1月・2月)", value: "冬" },
];

export const NH_MEMORIES = [
  { label: "👨‍👩‍👧 家族のこと(お子さん、お孫さんの話など)", value: "家族のこと" },
  { label: "💼 お仕事のこと(昔の仕事、働いていた頃の話)", value: "お仕事のこと" },
  { label: "🏡 故郷や育った場所のこと", value: "故郷のこと" },
  { label: "🌸 友人や仲間のこと", value: "友人のこと" },
  { label: "⛰️ 旅行や行楽の思い出", value: "旅行の思い出" },
  { label: "🎨 趣味や好きだったこと", value: "趣味のこと" },
  { label: "🎉 特別な出来事(結婚式、お祝いなど)", value: "特別な出来事" },
  { label: "😊 特にない・いろいろな話をされる", value: "いろいろ" },
];

export const NH_PERSONALITIES = [
  { label: "💖 優しくて温かい", value: "優しくて温かい" },
  { label: "💪 頑張り屋で真面目", value: "頑張り屋で真面目" },
  { label: "😊 いつも笑顔で明るい", value: "いつも笑顔で明るい" },
  { label: "🙏 感謝の気持ちを忘れない", value: "感謝の気持ちを忘れない" },
  { label: "🤝 人との会話が好き", value: "人との会話が好き" },
  { label: "🌸 穏やかで落ち着いている", value: "穏やかで落ち着いている" },
  { label: "😂 ユーモアがあって面白い", value: "ユーモアがあって面白い" },
  { label: "📚 好奇心旺盛", value: "好奇心旺盛" },
];
