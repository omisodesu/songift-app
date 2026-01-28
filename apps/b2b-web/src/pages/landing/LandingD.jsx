import { Link } from 'react-router-dom';
import { track } from '../../lib/analytics';
import { motion } from 'framer-motion';

/**
 * ランディングページ バリアントD
 * ターゲット: 推し活に熱心な18〜25歳の女性ファン層
 * コンセプト: 「推しへの愛を形にする」「センイル広告の100分の1以下」
 * デザイン: Bento Grid + キラキラ推し活テイスト + Framer Motion
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
  y: [0, -8, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const sparkleAnimation = {
  scale: [1, 1.2, 1],
  opacity: [1, 0.8, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const pulseGlow = {
  boxShadow: [
    '0 0 20px rgba(168, 85, 247, 0.3)',
    '0 0 40px rgba(168, 85, 247, 0.5)',
    '0 0 20px rgba(168, 85, 247, 0.3)',
  ],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// ==========================================
// Reusable Components
// ==========================================

// キラキラ星コンポーネント
const Sparkle = ({ className = '', delay = 0 }) => (
  <motion.span
    className={`absolute text-amber-400 ${className}`}
    animate={sparkleAnimation}
    transition={{ ...sparkleAnimation.transition, delay }}
  >
    ✨
  </motion.span>
);

// 3D風キラキラカード
const BentoCard = ({ children, className = '', span = '', glow = false }) => (
  <motion.div
    className={`
      bg-gradient-to-br from-purple-50 via-white to-pink-50
      rounded-3xl p-6
      shadow-xl shadow-purple-200/30
      border border-purple-100/50
      relative overflow-hidden
      ${span}
      ${className}
    `}
    variants={fadeInUp}
    whileHover={{
      y: -8,
      boxShadow: '0 25px 50px -12px rgba(168, 85, 247, 0.35)',
      scale: 1.02,
    }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    animate={glow ? pulseGlow : {}}
  >
    {/* キラキラエフェクト */}
    <Sparkle className="top-2 right-2 text-xl" delay={0} />
    <Sparkle className="bottom-3 left-3 text-sm" delay={0.5} />
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

// CTAボタン（推し活キラキラ仕様）
const CTAButton = ({ onClick, children, variant = 'primary', className = '' }) => {
  const baseStyles =
    'inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-lg cursor-pointer';
  const variants = {
    primary:
      'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600',
    secondary: 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        boxShadow: [
          '0 0 20px rgba(168, 85, 247, 0.3)',
          '0 0 35px rgba(168, 85, 247, 0.5)',
          '0 0 20px rgba(168, 85, 247, 0.3)',
        ],
      }}
      transition={{
        boxShadow: { duration: 2, repeat: Infinity },
      }}
      className="inline-block rounded-full"
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

// Twitter風投稿カード
const TweetCard = ({ username, handle, content, likes, retweets, replies, delay = 0 }) => (
  <motion.div
    className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    whileHover={{ y: -4 }}
  >
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
      <div>
        <p className="font-bold text-sm text-gray-800">{username}</p>
        <p className="text-gray-400 text-xs">{handle}</p>
      </div>
    </div>
    <p className="text-gray-800 text-sm leading-relaxed">{content}</p>
    <div className="flex gap-6 mt-3 text-gray-400 text-sm">
      <span className="flex items-center gap-1">💬 {replies}</span>
      <span className="flex items-center gap-1">🔁 {retweets}</span>
      <span className="flex items-center gap-1 text-pink-500">❤️ {likes}</span>
    </div>
  </motion.div>
);

// 価格比較カード
const PriceCard = ({ emoji, title, price, description, isHighlight = false }) => (
  <motion.div
    className={`
      rounded-2xl p-5 border-2 transition-all
      ${
        isHighlight
          ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white border-transparent shadow-xl shadow-purple-300/50'
          : 'bg-white border-gray-200 text-gray-800'
      }
    `}
    variants={fadeInUp}
    whileHover={isHighlight ? { scale: 1.05, y: -5 } : { y: -3 }}
  >
    <span className="text-4xl mb-3 block">{emoji}</span>
    <h4 className={`font-bold mb-1 ${isHighlight ? 'text-white' : 'text-gray-800'}`}>{title}</h4>
    <p className={`text-2xl font-bold mb-2 ${isHighlight ? 'text-amber-300' : 'text-purple-600'}`}>
      {price}
    </p>
    <p className={`text-sm ${isHighlight ? 'text-purple-100' : 'text-gray-500'}`}>{description}</p>
  </motion.div>
);

// シーンカード
const SceneCard = ({ emoji, title, description }) => (
  <motion.div
    className="bg-white rounded-2xl p-5 shadow-lg border border-purple-100 text-center relative overflow-hidden"
    variants={fadeInUp}
    whileHover={{ y: -5, scale: 1.02 }}
  >
    <Sparkle className="top-1 right-1 text-sm" delay={Math.random()} />
    <BigEmoji emoji={emoji} size="text-5xl" />
    <h4 className="font-bold text-gray-800 mt-3 mb-1">{title}</h4>
    <p className="text-sm text-gray-600">{description}</p>
  </motion.div>
);

// 音楽プレイヤー風カード
const MusicPlayerCard = ({ genre, emoji, description }) => (
  <motion.div
    className="bg-white rounded-2xl p-4 shadow-lg border border-purple-100"
    whileHover={{ scale: 1.02 }}
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-3xl">
        {emoji}
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-800">{genre}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <motion.button
        className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="再生"
      >
        ▶
      </motion.button>
    </div>
  </motion.div>
);

// ==========================================
// Main Component
// ==========================================
const LandingD = () => {
  const handleCtaClick = (ctaName) => {
    track('cta_click', { cta: ctaName, variant: 'D' });
  };

  return (
    <>
      {/* 開発用：variant D の目印 */}
      <div className="fixed top-2 right-2 bg-purple-500 text-white px-2 py-1 text-xs rounded z-50">
        D
      </div>

      {/* Custom styles for sparkle animation */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .twinkle {
          animation: twinkle 2s ease-in-out infinite;
        }
        .twinkle-delay-1 { animation-delay: 0.3s; }
        .twinkle-delay-2 { animation-delay: 0.6s; }
        .twinkle-delay-3 { animation-delay: 0.9s; }
        .twinkle-delay-4 { animation-delay: 1.2s; }
        .twinkle-delay-5 { animation-delay: 1.5s; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-pink-50 overflow-x-hidden">
        {/* ==========================================
            1. Hero Section
            ========================================== */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Gradient blobs */}
            <div className="absolute top-20 -left-20 w-80 h-80 bg-purple-300/30 rounded-full blur-3xl" />
            <div className="absolute top-40 -right-20 w-72 h-72 bg-pink-300/30 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-amber-200/20 rounded-full blur-3xl" />

            {/* Twinkle stars */}
            <div className="absolute top-[10%] left-[8%] text-3xl twinkle">⭐</div>
            <div className="absolute top-[20%] right-[12%] text-2xl twinkle twinkle-delay-1">✨</div>
            <div className="absolute top-[50%] left-[5%] text-2xl twinkle twinkle-delay-2">💜</div>
            <div className="absolute top-[65%] right-[8%] text-3xl twinkle twinkle-delay-3">⭐</div>
            <div className="absolute bottom-[25%] left-[15%] text-2xl twinkle twinkle-delay-4">✨</div>
            <div className="absolute top-[35%] right-[5%] text-xl twinkle twinkle-delay-5">👑</div>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            {/* Logo */}
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
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
              <BigEmoji emoji="🎤" size="text-5xl md:text-6xl" animate />
              <BigEmoji emoji="⭐" size="text-5xl md:text-6xl" animate />
              <BigEmoji emoji="💜" size="text-5xl md:text-6xl" animate />
            </motion.div>

            {/* Main headline */}
            <motion.h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-800 mb-6 leading-tight"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.span variants={fadeInUp} className="block">
                推しの名前を歌う、
              </motion.span>
              <motion.span
                variants={fadeInUp}
                className="block bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent"
              >
                世界に一つのバースデーソング
              </motion.span>
            </motion.h1>

            {/* Sub copy */}
            <motion.p
              className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              センイル広告は高すぎる？
              <br className="sm:hidden" />
              <span className="font-bold text-purple-600">¥500</span>で、愛を曲にしよう。
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <CTAButton onClick={() => handleCtaClick('¥500で推しに曲を贈る - Hero')}>
                ¥500で推しに曲を贈る
              </CTAButton>
              <p className="mt-4 text-sm text-gray-500">
                ⭐ センイル広告の100分の1以下で、愛を届ける
              </p>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              className="mt-10 flex flex-wrap justify-center gap-4 text-sm text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <span className="flex items-center gap-1 bg-white/80 px-3 py-1.5 rounded-full shadow-sm border border-purple-100">
                💜 推しの名前連呼
              </span>
              <span className="flex items-center gap-1 bg-white/80 px-3 py-1.5 rounded-full shadow-sm border border-purple-100">
                ⭐ ワンコイン¥500
              </span>
              <span className="flex items-center gap-1 bg-white/80 px-3 py-1.5 rounded-full shadow-sm border border-purple-100">
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
            2. Price Comparison Section
            ========================================== */}
        <section className="py-20 px-4 bg-gradient-to-b from-white to-purple-50/50">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                センイル広告、
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  諦めてない？ 💜
                </span>
              </h2>
              <p className="text-gray-600">推しへの愛に、金額は関係ない。でも…</p>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <PriceCard
                emoji="🚇"
                title="駅のセンイル広告"
                price="¥50,000〜"
                description="高額、審査あり"
              />
              <PriceCard
                emoji="🖥️"
                title="電子看板広告"
                price="¥30,000〜"
                description="まだ高い…"
              />
              <PriceCard
                emoji="☕"
                title="カフェイベント"
                price="¥3,000〜"
                description="行けない地域も"
              />
              <PriceCard
                emoji="🎵"
                title="Songift"
                price="¥500"
                description="一人でOK、SNSでシェア"
                isHighlight
              />
            </motion.div>

            <motion.p
              className="text-center text-gray-600 mt-8 text-lg"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              ¥500で形にできるなら、
              <span className="font-bold text-purple-600">最高じゃない？</span>
            </motion.p>
          </div>
        </section>

        {/* ==========================================
            3. Love Proof Section
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
                推しの名前を、歌にする。
                <br />
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  それが愛。 👑
                </span>
              </h2>
            </motion.div>

            <motion.div
              className="bg-gradient-to-br from-purple-100 via-white to-pink-100 rounded-3xl p-8 shadow-xl relative overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <Sparkle className="top-4 right-4 text-2xl" delay={0} />
              <Sparkle className="bottom-4 left-4 text-xl" delay={0.7} />
              <Sparkle className="top-1/2 right-8 text-lg" delay={1.4} />

              <div className="text-center space-y-6">
                <motion.div
                  className="text-2xl md:text-3xl font-bold text-purple-700"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  ♪ [推しの名前] Happy Birthday ♪
                </motion.div>
                <div className="flex flex-wrap justify-center gap-4 text-lg text-gray-700">
                  <span className="bg-white/80 px-4 py-2 rounded-full shadow-sm">
                    &ldquo;〇〇くん大好き&rdquo;
                  </span>
                  <span className="bg-white/80 px-4 py-2 rounded-full shadow-sm">
                    &ldquo;〇〇ちゃんおめでとう&rdquo;
                  </span>
                </div>
                <p className="text-gray-600">
                  推しの名前が何度も歌われる、世界に一つだけの曲。
                  <br />
                  歌詞に推しへのメッセージを込められます。
                </p>

                <motion.div
                  className="flex justify-center gap-3"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-3xl">💜</span>
                  <span className="text-3xl">⭐</span>
                  <span className="text-3xl">🎤</span>
                  <span className="text-3xl">👑</span>
                  <span className="text-3xl">💜</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ==========================================
            4. SNS Share Section
            ========================================== */}
        <section className="py-20 px-4 bg-gradient-to-b from-purple-50/50 to-white">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  #推しの名前_誕生日
                </span>
                <br />
                でシェアしよう 📱
              </h2>
              <p className="text-gray-600">
                同担にも異担にもシェアしたくなる。
                <br />
                バズれば、推しに届くかも…？✨
              </p>
            </motion.div>

            <div className="max-w-md mx-auto">
              <TweetCard
                username="推し活アカウント"
                handle="@oshikatu_aya"
                content={
                  <>
                    推しの誕生日にSongiftで曲作った！🎵
                    <br />
                    名前連呼されてて最高すぎる😭💜
                    <br />
                    <span className="text-purple-500">#〇〇_HappyBirthday #〇〇誕生祭</span>
                  </>
                }
                likes="892"
                retweets="156"
                replies="24"
                delay={0.1}
              />

              <motion.div
                className="mt-4 space-y-2 pl-12"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
                  💬 すごい！愛が重いｗｗ
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
                  💬 私も作りたい！どこで作れるの？
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
                  💬 500円でこれはやばい😭✨
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ==========================================
            5. Bento Grid Section
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
                推しへの
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  愛を曲にする方法 🎵
                </span>
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
              <BentoCard span="col-span-2 row-span-2" className="flex flex-col justify-center" glow>
                <BigEmoji emoji="🎤" size="text-7xl" />
                <h3 className="text-xl md:text-2xl font-bold text-gray-800 mt-4 mb-2">
                  推しの名前 × あなたの愛 × AI
                  <br />= 世界に一つの曲
                </h3>
                <p className="text-gray-600">
                  推しへの想いが、
                  <br />
                  歌になって届く。
                </p>
              </BentoCard>

              {/* ステップ1 */}
              <BentoCard className="text-center">
                <span className="text-4xl">💜</span>
                <p className="text-xs text-purple-500 font-bold mt-2">STEP 1</p>
                <p className="font-bold text-gray-800 text-sm mt-1">推しの名前と特徴を入力</p>
              </BentoCard>

              {/* ステップ2 */}
              <BentoCard className="text-center">
                <span className="text-4xl">🎵</span>
                <p className="text-xs text-pink-500 font-bold mt-2">STEP 2</p>
                <p className="font-bold text-gray-800 text-sm mt-1">AIがオリジナル曲を作成</p>
              </BentoCard>

              {/* ステップ3 */}
              <BentoCard className="text-center">
                <span className="text-4xl">📧</span>
                <p className="text-xs text-purple-500 font-bold mt-2">STEP 3</p>
                <p className="font-bold text-gray-800 text-sm mt-1">3日以内にメールでお届け</p>
              </BentoCard>

              {/* 安心ポイント: 価格 */}
              <BentoCard className="text-center bg-gradient-to-br from-amber-50 to-amber-100/50">
                <span className="text-4xl">⭐</span>
                <p className="font-bold text-gray-800 mt-2">ワンコイン ¥500</p>
                <p className="text-xs text-gray-500">センイル広告の100分の1以下</p>
              </BentoCard>

              {/* 安心ポイント: クオリティ */}
              <BentoCard span="col-span-2" className="flex items-center gap-4">
                <span className="text-5xl">👑</span>
                <div>
                  <p className="font-bold text-gray-800">ガチ勢も納得のクオリティ</p>
                  <p className="text-sm text-gray-500">J-pop、K-pop風、バラード…選べる</p>
                </div>
              </BentoCard>

              {/* 絵文字アクセント */}
              <BentoCard className="flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                <motion.div
                  className="flex gap-2"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-3xl">💜</span>
                  <span className="text-3xl">⭐</span>
                  <span className="text-3xl">🎤</span>
                </motion.div>
              </BentoCard>
            </motion.div>
          </div>
        </section>

        {/* ==========================================
            6. Quality Section
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
                ¥500でも、
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  ガチで作ります 🎵
                </span>
              </h2>
              <p className="text-gray-600">
                &ldquo;安いからダサい&rdquo;なんて言わせない。
                <br />
                推しへの愛に見合うクオリティを。
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
                <MusicPlayerCard genre="J-POP" emoji="🎤" description="アイドルソング風" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <MusicPlayerCard genre="K-POP風" emoji="💜" description="推しにぴったり" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <MusicPlayerCard genre="バラード" emoji="🌙" description="感動的なメロディ" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <MusicPlayerCard genre="EDM" emoji="🎧" description="盛り上がる系" />
              </motion.div>
            </motion.div>

            <motion.p
              className="text-center text-sm text-gray-500 mt-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              ※推しに恥ずかしくないクオリティをお約束します
            </motion.p>
          </div>
        </section>

        {/* ==========================================
            7. Two Modes Section
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
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  作成モード
                </span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 簡単モード */}
              <motion.div
                className="relative bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl overflow-hidden"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <Sparkle className="top-4 right-4 text-xl" delay={0} />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
                <div className="relative">
                  <BigEmoji emoji="🔮" size="text-6xl" />
                  <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold">
                    おすすめ
                  </span>
                  <h3 className="text-2xl font-bold mt-4 mb-2">簡単モード</h3>
                  <p className="text-purple-100 text-sm mb-4">推しの魅力を診断形式で入力</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      推しを色で表すと？
                    </li>
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      推しへの気持ちは？
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
                className="relative bg-gradient-to-br from-pink-500 to-pink-600 rounded-3xl p-6 text-white shadow-xl overflow-hidden"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <Sparkle className="top-4 right-4 text-xl" delay={0.5} />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
                <div className="relative">
                  <BigEmoji emoji="🎤" size="text-6xl" />
                  <h3 className="text-2xl font-bold mt-6 mb-2">プロモード</h3>
                  <p className="text-pink-100 text-sm mb-4">ガチ勢向け、細かく指定</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      ジャンルを自由に選択
                    </li>
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      楽器・メッセージを自由に
                    </li>
                    <li className="flex items-center gap-2">
                      <span>✓</span>
                      K-pop風、バラード、EDM...
                    </li>
                  </ul>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ==========================================
            8. Fan Voices Section
            ========================================== */}
        <section className="py-20 px-4 bg-gradient-to-b from-pink-50/50 to-purple-50/50">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4">
                推しを愛するみんなの声
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {' '}
                  💜
                </span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TweetCard
                username="ゆい@推し活垢"
                handle="@yui_oshi2024"
                content="センイル広告参加できなかったけど、これで自分なりの愛を形にできた✨ 500円でここまでできるのすごい"
                likes="423"
                retweets="89"
                replies="12"
                delay={0}
              />
              <TweetCard
                username="みく💜推し最強"
                handle="@miku_oshilove"
                content="同担に見せたら「私も作る！」ってなった🎉 布教成功！！推し活費用助かりすぎる😭"
                likes="567"
                retweets="134"
                replies="31"
                delay={0.1}
              />
              <TweetCard
                username="あや@◯◯担"
                handle="@aya_tan_oshi"
                content="推しの名前が何回も歌われてて聴くたび泣ける😭💜 マジで作ってよかった、一生の宝物"
                likes="892"
                retweets="201"
                replies="45"
                delay={0.2}
              />
              <TweetCard
                username="推し活記録"
                handle="@oshi_kiroku"
                content="500円でこのクオリティはやばい。ガチで曲としてちゃんとしてる。推しに恥ずかしくない✨"
                likes="345"
                retweets="78"
                replies="18"
                delay={0.3}
              />
            </div>
          </div>
        </section>

        {/* ==========================================
            9. Usage Scenes Section
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
                こんな
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  推し活に 💜
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
              <SceneCard emoji="🎂" title="推しの誕生日" description="毎年恒例の愛の形に" />
              <SceneCard emoji="🎤" title="デビュー記念日" description="推しを推し始めた日を祝う" />
              <SceneCard emoji="👑" title="推し卒業・活休前" description="今までありがとうを曲に" />
              <SceneCard emoji="💜" title="布教用" description="新規ファンに推しの魅力を" />
            </motion.div>
          </div>
        </section>

        {/* ==========================================
            10. Footer CTA Section
            ========================================== */}
        <section className="py-20 px-4 bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 relative overflow-hidden">
          {/* Sparkle decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[10%] left-[5%] text-3xl twinkle">⭐</div>
            <div className="absolute top-[20%] right-[10%] text-2xl twinkle twinkle-delay-1">
              ✨
            </div>
            <div className="absolute bottom-[30%] left-[15%] text-2xl twinkle twinkle-delay-2">
              💜
            </div>
            <div className="absolute bottom-[20%] right-[8%] text-3xl twinkle twinkle-delay-3">
              ⭐
            </div>
            <div className="absolute top-[50%] left-[3%] text-2xl twinkle twinkle-delay-4">👑</div>
            <div className="absolute top-[40%] right-[5%] text-xl twinkle twinkle-delay-5">🎤</div>
          </div>

          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-6">
                推しへの愛、
                <br />
                ¥500で歌にしよう 💜
              </h2>
              <p className="text-white/90 mb-8">
                センイル広告の100分の1以下・3日以内にお届け
                <br />
                推しの誕生日、まだ間に合う
              </p>

              <CTAButton
                onClick={() => handleCtaClick('¥500で推しに曲を贈る - FinalCTA')}
                variant="secondary"
              >
                ¥500で推しに曲を贈る
              </CTAButton>

              <motion.div
                className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-white/80"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <span>💜 推しの名前連呼</span>
                <span>⭐ ワンコイン¥500</span>
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

export default LandingD;
