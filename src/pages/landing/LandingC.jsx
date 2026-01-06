import { Link } from 'react-router-dom';
import { track } from '../../lib/analytics';
import { motion } from 'framer-motion';

/**
 * ランディングページ バリアントC
 * ターゲット: サプライズ演出を重視する22〜28歳の女性
 * コンセプト: 「ウケる」「映える」「センスいい」
 * デザイン: Bento Grid + 3Dアイコン風 + Framer Motion
 */

// ==========================================
// Animation Variants
// ==========================================
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const floatAnimation = {
  y: [0, -10, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const pulseAnimation = {
  scale: [1, 1.05, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// ==========================================
// Reusable Components
// ==========================================

// 3D風カードコンポーネント
const BentoCard = ({ children, className = '', span = '', hover = true }) => (
  <motion.div
    className={`
      bg-gradient-to-br from-white to-pink-50/50
      rounded-3xl p-6
      shadow-xl shadow-pink-200/20
      border border-white/60
      backdrop-blur-sm
      ${span}
      ${className}
    `}
    variants={fadeInUp}
    whileHover={
      hover
        ? {
            y: -8,
            boxShadow: '0 25px 50px -12px rgba(236, 72, 153, 0.25)',
          }
        : {}
    }
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  >
    {children}
  </motion.div>
);

// 大きな絵文字コンポーネント
const BigEmoji = ({ emoji, size = 'text-6xl', animate = false }) => (
  <motion.span
    className={`${size} select-none`}
    animate={animate ? floatAnimation : {}}
    whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
    transition={{ type: 'spring', stiffness: 400 }}
  >
    {emoji}
  </motion.span>
);

// CTAボタン
const CTAButton = ({ onClick, children, variant = 'primary', className = '' }) => {
  const baseStyles =
    'inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-lg cursor-pointer';
  const variants = {
    primary:
      'bg-gradient-to-r from-pink-500 to-violet-500 text-white hover:from-pink-600 hover:to-violet-600',
    secondary: 'bg-white text-pink-600 border-2 border-pink-200 hover:border-pink-400',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      animate={pulseAnimation}
    >
      <Link
        to="/order"
        onClick={onClick}
        className={`${baseStyles} ${variants[variant]} ${className}`}
      >
        {children}
      </Link>
    </motion.div>
  );
};

// LINEトーク風吹き出し
const ChatBubble = ({ message, isRight = false, delay = 0 }) => (
  <motion.div
    className={`flex ${isRight ? 'justify-end' : 'justify-start'} mb-3`}
    initial={{ opacity: 0, x: isRight ? 20 : -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.4 }}
  >
    <div
      className={`
        max-w-[280px] px-4 py-3 text-sm
        ${
          isRight
            ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-2xl rounded-br-sm'
            : 'bg-white text-gray-800 rounded-2xl rounded-bl-sm shadow-md'
        }
      `}
    >
      {message}
    </div>
  </motion.div>
);

// iPhone風モックアップ
const PhoneMockup = ({ children }) => (
  <div className="relative mx-auto w-[280px]">
    {/* Phone frame */}
    <div className="bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
      {/* Notch */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-900 rounded-full z-10" />
      {/* Screen */}
      <div className="bg-gradient-to-b from-pink-50 to-white rounded-[2.5rem] overflow-hidden pt-8 pb-4 px-2">
        {children}
      </div>
    </div>
  </div>
);

// Instagram風投稿
const InstagramPost = () => (
  <motion.div
    className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-[320px] mx-auto"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
  >
    {/* Header */}
    <div className="flex items-center gap-3 p-3 border-b border-gray-100">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-500" />
      <span className="text-sm font-semibold text-gray-800">rina_surprise</span>
    </div>
    {/* Image placeholder */}
    <div className="aspect-square bg-gradient-to-br from-pink-100 to-violet-100 flex items-center justify-center">
      <div className="text-center">
        <BigEmoji emoji="🎵" size="text-7xl" />
        <p className="mt-2 text-gray-600 text-sm font-medium">名前入りソング再生中...</p>
      </div>
    </div>
    {/* Actions */}
    <div className="p-3">
      <div className="flex gap-4 mb-2">
        <span className="text-2xl">❤️</span>
        <span className="text-2xl">💬</span>
        <span className="text-2xl">📤</span>
      </div>
      <p className="text-sm">
        <span className="font-semibold">rina_surprise</span>{' '}
        友達が作ってくれた名前入りバースデーソング🎂✨ マジで泣いた...
      </p>
      <p className="text-xs text-gray-400 mt-1">
        #誕生日サプライズ #名前入りソング #友達が作ってくれた #Songift
      </p>
    </div>
    {/* Comments */}
    <div className="px-3 pb-3 space-y-1">
      <p className="text-sm">
        <span className="font-semibold">yuki_party</span> センス良すぎ！私も作りたい✨
      </p>
      <p className="text-sm">
        <span className="font-semibold">miki_2000</span> えっこれどこで作るの！？
      </p>
    </div>
  </motion.div>
);

// 音楽プレイヤー風カード
const MusicPlayerCard = ({ genre, emoji }) => (
  <motion.div
    className="bg-white rounded-2xl p-4 shadow-lg border border-pink-100"
    whileHover={{ scale: 1.02 }}
  >
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pink-100 to-violet-100 flex items-center justify-center text-3xl">
        {emoji}
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-800">{genre}</p>
        <p className="text-xs text-gray-500">Sample Track</p>
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-500 to-violet-500 rounded-full"
            initial={{ width: '0%' }}
            whileInView={{ width: '60%' }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, delay: 0.3 }}
          />
        </div>
      </div>
      <motion.button
        className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 text-white flex items-center justify-center shadow-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="再生"
      >
        ▶
      </motion.button>
    </div>
  </motion.div>
);

// シーンカード
const SceneCard = ({ emoji, title, description }) => (
  <motion.div
    className="bg-white rounded-2xl p-5 shadow-lg border border-pink-100 text-center"
    variants={fadeInUp}
    whileHover={{ y: -5, rotate: [-1, 1, 0] }}
  >
    <BigEmoji emoji={emoji} size="text-5xl" />
    <h4 className="font-bold text-gray-800 mt-3 mb-1">{title}</h4>
    <p className="text-sm text-gray-600">{description}</p>
  </motion.div>
);

// ==========================================
// Main Component
// ==========================================
const LandingC = () => {
  const handleCtaClick = (ctaName) => {
    track('cta_click', { cta: ctaName, variant: 'C' });
  };

  return (
    <>
      {/* 開発用：variant C の目印 */}
      <div className="fixed top-2 right-2 bg-green-500 text-white px-2 py-1 text-xs rounded z-50">
        C
      </div>

      {/* Custom styles for sparkle animation */}
      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        .sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }
        .sparkle-delay-1 { animation-delay: 0.3s; }
        .sparkle-delay-2 { animation-delay: 0.6s; }
        .sparkle-delay-3 { animation-delay: 0.9s; }
        .sparkle-delay-4 { animation-delay: 1.2s; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-violet-50 overflow-x-hidden">
        {/* ==========================================
            1. Hero Section
            ========================================== */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Gradient blobs */}
            <div className="absolute top-20 -left-20 w-72 h-72 bg-pink-300/30 rounded-full blur-3xl" />
            <div className="absolute top-40 -right-20 w-80 h-80 bg-violet-300/30 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-amber-200/20 rounded-full blur-3xl" />

            {/* Sparkles */}
            <div className="absolute top-[15%] left-[10%] text-4xl sparkle">✨</div>
            <div className="absolute top-[25%] right-[15%] text-3xl sparkle sparkle-delay-1">
              🎵
            </div>
            <div className="absolute top-[60%] left-[8%] text-3xl sparkle sparkle-delay-2">
              🎉
            </div>
            <div className="absolute top-[70%] right-[10%] text-4xl sparkle sparkle-delay-3">
              💝
            </div>
            <div className="absolute bottom-[20%] left-[20%] text-3xl sparkle sparkle-delay-4">
              🎂
            </div>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            {/* Logo */}
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                Songift
              </span>
            </motion.div>

            {/* Floating emojis */}
            <motion.div
              className="flex justify-center gap-6 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <BigEmoji emoji="🎵" size="text-5xl md:text-6xl" animate />
              <BigEmoji emoji="🎂" size="text-5xl md:text-6xl" animate />
              <BigEmoji emoji="🎉" size="text-5xl md:text-6xl" animate />
            </motion.div>

            {/* Main headline */}
            <motion.h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-800 mb-6 leading-tight"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.span variants={fadeInUp} className="block">
                &ldquo;えっ何これ！&rdquo;が止まらない
              </motion.span>
              <motion.span
                variants={fadeInUp}
                className="block bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent"
              >
                名前入りバースデーソング
              </motion.span>
            </motion.h1>

            {/* Sub copy */}
            <motion.p
              className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              友達の名前と内輪ネタを入れるだけ。
              <br className="hidden sm:block" />
              AIが世界に一つの曲を作ります。
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <CTAButton onClick={() => handleCtaClick('¥500で作ってみる - Hero')}>
                ¥500で作ってみる
              </CTAButton>
              <p className="mt-4 text-sm text-gray-500">
                🎉 パーティーで流したら盛り上がること間違いなし
              </p>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              className="mt-10 flex flex-wrap justify-center gap-4 text-sm text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <span className="flex items-center gap-1 bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
                ☕ スタバ1杯分
              </span>
              <span className="flex items-center gap-1 bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
                ✨ 登録不要
              </span>
              <span className="flex items-center gap-1 bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
                📧 3日以内にお届け
              </span>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="text-3xl">👇</span>
          </motion.div>
        </section>

        {/* ==========================================
            2. Reaction Section (LINE風)
            ========================================== */}
        <section className="py-20 px-4 bg-gradient-to-b from-white to-pink-50/50">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                パーティーで流した瞬間、
                <br />
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                  こうなります 🤣
                </span>
              </h2>
            </motion.div>

            <PhoneMockup>
              <div className="px-2 py-4">
                <div className="text-center text-xs text-gray-400 mb-4">誕生日会グループ</div>
                <ChatBubble message="ちょっと待って、私の名前入ってるんだけどｗｗｗ" delay={0.1} />
                <ChatBubble
                  message="なんで私がタピオカ好きなの知ってるの！？笑"
                  isRight
                  delay={0.3}
                />
                <ChatBubble message="これ絶対ストーリーに上げるｗｗ" delay={0.5} />
                <ChatBubble
                  message="センス良すぎ、どこで作ったの？？"
                  isRight
                  delay={0.7}
                />
                <ChatBubble message="Songiftってやつ！500円だよ✨" delay={0.9} />
                <ChatBubble message="えっ安っ！私も作る！！" isRight delay={1.1} />
              </div>
            </PhoneMockup>
          </div>
        </section>

        {/* ==========================================
            3. Bento Grid Section (特徴 + How it Works)
            ========================================== */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                  バズるサプライズ
                </span>
                の作り方 🎵
              </h2>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
            >
              {/* 大カード: メイン訴求 */}
              <BentoCard span="col-span-2 row-span-2" className="flex flex-col justify-center">
                <BigEmoji emoji="🎵" size="text-7xl" />
                <h3 className="text-xl md:text-2xl font-bold text-gray-800 mt-4 mb-2">
                  名前 × 内輪ネタ × AI
                  <br />= バズるサプライズ
                </h3>
                <p className="text-gray-600">
                  バルーンより安い、
                  <br />
                  ケーキより盛り上がる。
                </p>
              </BentoCard>

              {/* ステップ1 */}
              <BentoCard className="text-center">
                <span className="text-4xl">🔮</span>
                <p className="text-xs text-pink-500 font-bold mt-2">STEP 1</p>
                <p className="font-bold text-gray-800 text-sm mt-1">名前と特徴を入力</p>
                <p className="text-xs text-gray-500 mt-1">猫好き、遅刻魔…</p>
              </BentoCard>

              {/* ステップ2 */}
              <BentoCard className="text-center">
                <span className="text-4xl">🪄</span>
                <p className="text-xs text-violet-500 font-bold mt-2">STEP 2</p>
                <p className="font-bold text-gray-800 text-sm mt-1">AIが作曲</p>
                <p className="text-xs text-gray-500 mt-1">本気のオリジナル曲</p>
              </BentoCard>

              {/* ステップ3 */}
              <BentoCard className="text-center">
                <span className="text-4xl">📧</span>
                <p className="text-xs text-pink-500 font-bold mt-2">STEP 3</p>
                <p className="font-bold text-gray-800 text-sm mt-1">メールでお届け</p>
                <p className="text-xs text-gray-500 mt-1">3日以内に届く</p>
              </BentoCard>

              {/* 安心ポイント: 価格 */}
              <BentoCard className="text-center bg-gradient-to-br from-amber-50 to-amber-100/50">
                <span className="text-4xl">☕</span>
                <p className="font-bold text-gray-800 mt-2">ワンコイン ¥500</p>
                <p className="text-xs text-gray-500">スタバ1杯分！</p>
              </BentoCard>

              {/* 安心ポイント: 唯一性 */}
              <BentoCard span="col-span-2" className="flex items-center gap-4">
                <span className="text-5xl">✨</span>
                <div>
                  <p className="font-bold text-gray-800">絶対被らない、世界に一つ</p>
                  <p className="text-sm text-gray-500">
                    友達の名前とエピソードが歌詞になる
                  </p>
                </div>
              </BentoCard>

              {/* 絵文字アクセント */}
              <BentoCard
                className="flex items-center justify-center bg-gradient-to-br from-pink-100 to-violet-100"
                hover={false}
              >
                <motion.div
                  className="flex gap-2"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <span className="text-3xl">🎂</span>
                  <span className="text-3xl">🎉</span>
                  <span className="text-3xl">🎸</span>
                </motion.div>
              </BentoCard>
            </motion.div>
          </div>
        </section>

        {/* ==========================================
            4. Quality Section (品質訴求)
            ========================================== */}
        <section className="py-20 px-4 bg-gradient-to-b from-violet-50/50 to-white">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                ¥500でこのクオリティ、
                <br />
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                  本気で作ります 🎤
                </span>
              </h2>
              <p className="text-gray-600">
                AIが本気で作曲。チープな着メロとは違います。
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <motion.div variants={fadeInUp}>
                <MusicPlayerCard genre="J-POP" emoji="🎤" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <MusicPlayerCard genre="Rock" emoji="🎸" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <MusicPlayerCard genre="EDM" emoji="🎧" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <MusicPlayerCard genre="Acoustic" emoji="🎹" />
              </motion.div>
            </motion.div>

            <motion.p
              className="text-center text-sm text-gray-500 mt-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              ※ジャンルは注文時に選べます
            </motion.p>
          </div>
        </section>

        {/* ==========================================
            5. Two Modes Section
            ========================================== */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                2つの
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                  作成モード
                </span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 簡単モード */}
              <motion.div
                className="relative bg-gradient-to-br from-pink-500 to-pink-600 rounded-3xl p-6 text-white shadow-xl overflow-hidden"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                {/* Decorative circle */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
                <div className="relative">
                  <BigEmoji emoji="🔮" size="text-6xl" />
                  <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold">
                    おすすめ
                  </span>
                  <h3 className="text-2xl font-bold mt-4 mb-2">簡単モード</h3>
                  <p className="text-pink-100 text-sm mb-4">
                    迷ったらこれ！直感で答えるだけ
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      その人を色で表すと？
                    </li>
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      伝えたい気持ちは？
                    </li>
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      約5分で入力完了
                    </li>
                  </ul>
                </div>
              </motion.div>

              {/* プロモード */}
              <motion.div
                className="relative bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl overflow-hidden"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                {/* Decorative circle */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
                <div className="relative">
                  <BigEmoji emoji="🎸" size="text-6xl" />
                  <h3 className="text-2xl font-bold mt-6 mb-2">プロモード</h3>
                  <p className="text-violet-100 text-sm mb-4">
                    こだわり派のあなたへ
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      ジャンルを自由に選択
                    </li>
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      楽器・歌い手を指定
                    </li>
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      J-pop, Rock, Jazz, EDM...
                    </li>
                  </ul>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ==========================================
            6. Usage Scenes Section
            ========================================== */}
        <section className="py-20 px-4 bg-gradient-to-b from-white to-pink-50/50">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                こんな時に、
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                  Songift 🎉
                </span>
              </h2>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <SceneCard
                emoji="🎂"
                title="友達の誕生日会"
                description="サプライズの定番になる"
              />
              <SceneCard
                emoji="👯‍♀️"
                title="推しの誕生日"
                description="愛を歌にしてSNSで布教"
              />
              <SceneCard
                emoji="💑"
                title="彼氏/彼女へ"
                description="照れくさいことも歌なら言える"
              />
              <SceneCard
                emoji="🎊"
                title="飲み会のネタ"
                description="場が盛り上がること間違いなし"
              />
            </motion.div>
          </div>
        </section>

        {/* ==========================================
            7. SNS Appeal Section
            ========================================== */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                ストーリーに上げたら
                <br />
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                  &ldquo;センスいい&rdquo;の嵐 📱
                </span>
              </h2>
            </motion.div>

            <InstagramPost />

            <motion.div
              className="flex flex-wrap justify-center gap-3 mt-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              {['#誕生日サプライズ', '#名前入りソング', '#友達が作ってくれた', '#Songift'].map(
                (tag) => (
                  <span
                    key={tag}
                    className="px-4 py-2 bg-gradient-to-r from-pink-100 to-violet-100 rounded-full text-sm text-gray-700"
                  >
                    {tag}
                  </span>
                )
              )}
            </motion.div>
          </div>
        </section>

        {/* ==========================================
            8. Footer CTA Section
            ========================================== */}
        <section className="py-20 px-4 bg-gradient-to-br from-pink-500 via-pink-500 to-violet-600 relative overflow-hidden">
          {/* Sparkle decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[10%] left-[5%] text-3xl sparkle">✨</div>
            <div className="absolute top-[20%] right-[10%] text-2xl sparkle sparkle-delay-1">
              🎵
            </div>
            <div className="absolute bottom-[30%] left-[15%] text-2xl sparkle sparkle-delay-2">
              🎉
            </div>
            <div className="absolute bottom-[20%] right-[8%] text-3xl sparkle sparkle-delay-3">
              💝
            </div>
            <div className="absolute top-[50%] left-[3%] text-2xl sparkle sparkle-delay-4">
              🎂
            </div>
          </div>

          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-6">
                次の誕生日、
                <br />
                &ldquo;マジでウケた&rdquo;って
                <br />
                言わせよう 🎁
              </h2>
              <p className="text-white/90 mb-8">
                ワンコイン・登録不要・3日以内にお届け
                <br />
                バルーン電報より安い、でも絶対被らない
              </p>

              <CTAButton
                onClick={() => handleCtaClick('¥500で作成する - FinalCTA')}
                variant="secondary"
              >
                ¥500で作成する
              </CTAButton>

              <motion.div
                className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-white/80"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <span>☕ スタバ1杯分</span>
                <span>✨ 世界に一つ</span>
                <span>📧 3日以内</span>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 bg-gray-900 text-center">
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} Songift. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  );
};

export default LandingC;
