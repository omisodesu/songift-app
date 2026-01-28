import { Link } from 'react-router-dom';
import { track } from '../../lib/analytics';
import { motion, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars

/**
 * A/Bテスト: バリアントB
 * 楽しさ・ワクワク感を前面に出したBento Gridデザイン
 * TikTok/Instagram世代に刺さるトレンディなLP
 */

// Sparkle SVG Icon
const SparkleIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
);

// Music Note SVG Icon
const MusicNoteIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
  </svg>
);

// Gift SVG Icon
const GiftIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
  </svg>
);

// Wand SVG Icon
const WandIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 0 0-1.41 0L1.29 18.96a.996.996 0 0 0 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05a.996.996 0 0 0 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/>
  </svg>
);

// Mail SVG Icon
const MailIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
  </svg>
);

// Crystal Ball SVG Icon
const CrystalBallIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="10" r="8" opacity="0.3"/>
    <path d="M12 2C7.03 2 3 6.03 3 11c0 3.19 1.66 5.99 4.16 7.59C7.06 18.73 7 18.86 7 19v2c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-2c0-.14-.06-.27-.16-.41C19.34 16.99 21 14.19 21 11c0-4.97-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"/>
    <path d="M12 6c-2.76 0-5 2.24-5 5h2c0-1.65 1.35-3 3-3V6z" opacity="0.6"/>
  </svg>
);

// Guitar SVG Icon
const GuitarIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 3H22V1h-4v3.59L12.76 9.83a3.49 3.49 0 0 0-1.93-.8c-.69-.07-1.42.07-2.08.49l-.04-.04c-.47-.47-1.04-.71-1.71-.71-.71 0-1.33.27-1.86.8-.53.53-.8 1.15-.8 1.86 0 .67.24 1.24.71 1.71l.04.04c-.42.66-.56 1.39-.49 2.08.07.69.34 1.35.8 1.93l-.01.01-1.99 1.99c-.59.59-.59 1.54 0 2.12l1.41 1.41c.59.59 1.54.59 2.12 0l1.99-1.99.01-.01c.58.46 1.24.73 1.93.8.69.07 1.42-.07 2.08-.49l.04.04c.47.47 1.04.71 1.71.71.71 0 1.33-.27 1.86-.8.53-.53.8-1.15.8-1.86 0-.67-.24-1.24-.71-1.71l-.04-.04c.42-.66.56-1.39.49-2.08-.07-.69-.34-1.35-.8-1.93l5.24-5.24V3zM9 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
  </svg>
);

// Coffee SVG Icon
const CoffeeIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.93 0 3.5-1.57 3.5-3.5S20.43 3 18.5 3zM16 5v3H6V5h10zm2.5 3H18V5h.5c.83 0 1.5.67 1.5 1.5S19.33 8 18.5 8zM4 19h16v2H4z"/>
  </svg>
);

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  },
};

// Bento Card Component
const BentoCard = ({
  children,
  className = '',
  gradient = 'from-white to-gray-50',
  span = '',
  prefersReducedMotion = false
}) => (
  <motion.div
    className={`
      bg-gradient-to-br ${gradient}
      rounded-3xl p-5 md:p-6
      shadow-lg border border-white/60
      backdrop-blur-sm
      cursor-pointer
      ${span}
      ${className}
    `}
    variants={fadeInUp}
    whileHover={prefersReducedMotion ? {} : {
      y: -6,
      boxShadow: '0 20px 40px -12px rgba(236, 72, 153, 0.2)',
      transition: { type: 'spring', stiffness: 300, damping: 20 }
    }}
  >
    {children}
  </motion.div>
);

// Floating Icon with 3D effect
const FloatingIcon = ({ icon: IconComponent, color = 'text-pink-500', size = 'w-12 h-12', delay = 0, prefersReducedMotion = false }) => (
  <motion.div
    className={`
      ${size} ${color}
      bg-white rounded-2xl p-3
      shadow-lg shadow-pink-200/40
      flex items-center justify-center
    `}
    animate={prefersReducedMotion ? {} : {
      y: [0, -8, 0],
    }}
    transition={{
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
      delay,
    }}
  >
    <IconComponent className="w-full h-full" />
  </motion.div>
);

// Sparkle decoration
const SparkleDecor = ({ className = '', delay = 0, prefersReducedMotion = false }) => (
  <motion.div
    className={`absolute ${className}`}
    animate={prefersReducedMotion ? {} : {
      opacity: [0.3, 1, 0.3],
      scale: [0.8, 1.1, 0.8],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
      delay,
    }}
  >
    <SparkleIcon className="w-4 h-4 text-amber-400" />
  </motion.div>
);

const LandingB = () => {
  const prefersReducedMotion = useReducedMotion();

  const handleCtaClick = () => {
    track('cta_click', { cta: '¥500で作ってみる', variant: 'B' });
  };

  return (
    <>
      {/* 開発用：variant B の目印 */}
      <div className="fixed top-2 right-2 bg-red-500 text-white px-2 py-1 text-xs rounded z-50">
        B
      </div>

      {/* LP本体 */}
      <div
        className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-violet-50"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {/* ===== Hero Section ===== */}
        <section className="relative px-4 pt-10 pb-12 md:pt-16 md:pb-20 overflow-hidden">
          {/* Background sparkles */}
          <SparkleDecor className="top-16 left-[8%]" delay={0} prefersReducedMotion={prefersReducedMotion} />
          <SparkleDecor className="top-24 right-[12%]" delay={0.7} prefersReducedMotion={prefersReducedMotion} />
          <SparkleDecor className="bottom-16 left-[15%]" delay={1.4} prefersReducedMotion={prefersReducedMotion} />
          <SparkleDecor className="top-32 right-[25%]" delay={0.3} prefersReducedMotion={prefersReducedMotion} />

          <div className="max-w-4xl mx-auto">
            <motion.div
              className="relative bg-gradient-to-br from-pink-500 via-pink-400 to-violet-500 rounded-[2rem] p-6 md:p-10 shadow-2xl shadow-pink-300/30 overflow-hidden"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Floating icons */}
              <div className="absolute top-4 right-4 md:top-6 md:right-8">
                <FloatingIcon icon={MusicNoteIcon} color="text-pink-500" delay={0} prefersReducedMotion={prefersReducedMotion} />
              </div>
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 hidden md:block">
                <FloatingIcon icon={GiftIcon} color="text-violet-500" size="w-10 h-10" delay={0.5} prefersReducedMotion={prefersReducedMotion} />
              </div>
              <div className="absolute top-1/2 right-[12%] -translate-y-1/2 hidden lg:block">
                <FloatingIcon icon={WandIcon} color="text-amber-500" size="w-10 h-10" delay={1} prefersReducedMotion={prefersReducedMotion} />
              </div>

              {/* Hero content */}
              <div className="relative z-10 text-center md:text-left max-w-xl">
                <motion.h1
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4"
                  style={{ fontFamily: "'Righteous', sans-serif" }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  5つの魔法診断で、
                  <br />
                  世界に一つの
                  <br />
                  バースデーソングを。
                </motion.h1>

                <motion.p
                  className="text-white/90 text-base md:text-lg mb-6"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                >
                  相手の"色"や"魔法の言葉"を選ぶだけ。
                  <br className="hidden sm:block" />
                  AIが想いを歌にします。
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <Link to="/order" onClick={handleCtaClick}>
                    <motion.button
                      className="bg-white text-pink-600 font-bold text-base md:text-lg px-6 md:px-8 py-3 md:py-4 rounded-full shadow-lg cursor-pointer"
                      animate={prefersReducedMotion ? {} : {
                        boxShadow: [
                          '0 10px 30px -10px rgba(255,255,255,0.5)',
                          '0 15px 40px -10px rgba(255,255,255,0.7)',
                          '0 10px 30px -10px rgba(255,255,255,0.5)',
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      ¥500で作ってみる
                    </motion.button>
                  </Link>
                  <p className="text-white/80 text-xs md:text-sm mt-3 flex items-center justify-center md:justify-start gap-1">
                    <CoffeeIcon className="w-4 h-4 inline" />
                    スタバのラテ1杯分で、一生モノのサプライズ
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ===== Bento Grid Section ===== */}
        <section className="px-4 pb-12 md:pb-16">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
            >
              {/* Main feature card (2x2) */}
              <BentoCard
                span="col-span-2 row-span-2"
                gradient="from-violet-100 via-violet-50 to-pink-50"
                className="flex flex-col items-center justify-center text-center min-h-[200px] md:min-h-[280px]"
                prefersReducedMotion={prefersReducedMotion}
              >
                <motion.div
                  className="mb-3"
                  animate={prefersReducedMotion ? {} : { y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-pink-400 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200/50">
                    <MusicNoteIcon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                </motion.div>
                <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: "'Righteous', sans-serif" }}>
                  AIが作る、
                  <br />
                  あなただけのオリジナル曲
                </h2>
                <p className="text-gray-600 text-xs md:text-sm">
                  想いを込めた世界に一つだけの歌
                </p>
              </BentoCard>

              {/* Step 1 */}
              <BentoCard gradient="from-pink-100 to-pink-50" className="shadow-pink-200/30" prefersReducedMotion={prefersReducedMotion}>
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-500 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <CrystalBallIcon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-gray-800 text-sm">STEP 1</p>
                <p className="text-gray-600 text-xs">5つの質問に答える</p>
              </BentoCard>

              {/* 500 yen card */}
              <BentoCard gradient="from-amber-100 to-amber-50" className="shadow-amber-200/30" prefersReducedMotion={prefersReducedMotion}>
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-400 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <CoffeeIcon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-gray-800 text-sm">ワンコイン</p>
                <p className="text-pink-600 font-bold text-xl">¥500</p>
              </BentoCard>

              {/* Step 2 */}
              <BentoCard gradient="from-violet-100 to-violet-50" className="shadow-violet-200/30" prefersReducedMotion={prefersReducedMotion}>
                <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-violet-500 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <WandIcon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-gray-800 text-sm">STEP 2</p>
                <p className="text-gray-600 text-xs">AIが魔法をかける</p>
              </BentoCard>

              {/* Only one card */}
              <BentoCard gradient="from-pink-100 to-rose-50" className="shadow-pink-200/30" prefersReducedMotion={prefersReducedMotion}>
                <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-pink-500 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <GiftIcon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-gray-800 text-xs">世界に一つだけ</p>
                <p className="text-gray-600 text-xs">あなたの想いが曲に</p>
              </BentoCard>

              {/* Step 3 */}
              <BentoCard gradient="from-emerald-100 to-emerald-50" className="shadow-emerald-200/30" prefersReducedMotion={prefersReducedMotion}>
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <MailIcon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-gray-800 text-sm">STEP 3</p>
                <p className="text-gray-600 text-xs">3日以内にお届け</p>
              </BentoCard>

              {/* No registration card */}
              <BentoCard gradient="from-sky-100 to-sky-50" className="shadow-sky-200/30" prefersReducedMotion={prefersReducedMotion}>
                <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-500 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <SparkleIcon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-gray-800 text-xs">登録不要</p>
                <p className="text-gray-600 text-xs">メールだけでOK</p>
              </BentoCard>
            </motion.div>
          </div>
        </section>

        {/* ===== Two Modes Section ===== */}
        <section className="px-4 pb-12 md:pb-16">
          <div className="max-w-4xl mx-auto">
            <motion.h2
              className="text-xl md:text-2xl font-bold text-center text-gray-800 mb-6"
              style={{ fontFamily: "'Righteous', sans-serif" }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              2つのモードで、あなたらしく
            </motion.h2>

            <motion.div
              className="grid md:grid-cols-2 gap-4 md:gap-6"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
            >
              {/* Easy Mode */}
              <motion.div
                className="bg-gradient-to-br from-pink-400 to-rose-500 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-pink-300/30 cursor-pointer"
                variants={scaleIn}
                whileHover={prefersReducedMotion ? {} : { y: -6, scale: 1.02 }}
              >
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <CrystalBallIcon className="w-8 h-8 text-white" />
                </div>
                <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                  初めての方におすすめ！
                </span>
                <h3 className="text-xl md:text-2xl font-bold mt-3 mb-2" style={{ fontFamily: "'Righteous', sans-serif" }}>
                  魔法診断モード
                </h3>
                <p className="text-white/90 text-sm mb-4">
                  直感で答えるだけ。5つの質問があなたの想いを引き出します。
                </p>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <p className="text-xs text-white/70 mb-1">質問例:</p>
                  <p className="font-medium text-sm">"その人を色で表すと？"</p>
                </div>
              </motion.div>

              {/* Pro Mode */}
              <motion.div
                className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-300/30 cursor-pointer"
                variants={scaleIn}
                whileHover={prefersReducedMotion ? {} : { y: -6, scale: 1.02 }}
              >
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <GuitarIcon className="w-8 h-8 text-white" />
                </div>
                <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                  こだわり派のあなたへ
                </span>
                <h3 className="text-xl md:text-2xl font-bold mt-3 mb-2" style={{ fontFamily: "'Righteous', sans-serif" }}>
                  プロモード
                </h3>
                <p className="text-white/90 text-sm mb-4">
                  ジャンル・楽器・歌い手・メッセージを自由にカスタマイズ。
                </p>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <p className="text-xs text-white/70 mb-1">選べるジャンル:</p>
                  <p className="font-medium text-sm">J-pop, Rock, Jazz, R&amp;B...</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ===== Use Cases Section ===== */}
        <section className="px-4 pb-12 md:pb-16">
          <div className="max-w-4xl mx-auto">
            <motion.h2
              className="text-xl md:text-2xl font-bold text-center text-gray-800 mb-6"
              style={{ fontFamily: "'Righteous', sans-serif" }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              こんな時に、Songift
            </motion.h2>

            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
            >
              {[
                { icon: '🎂', text: '友達の誕生日に', color: 'from-pink-100 to-pink-50' },
                { icon: '💕', text: '恋人・パートナーへ', color: 'from-rose-100 to-rose-50' },
                { icon: '👨‍👩‍👧', text: '家族のお祝いに', color: 'from-amber-100 to-amber-50' },
                { icon: '🎉', text: '推しの誕生日に', color: 'from-violet-100 to-violet-50' },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  className={`bg-gradient-to-br ${item.color} rounded-3xl p-4 md:p-6 shadow-lg border border-white/60 text-center cursor-pointer`}
                  variants={fadeInUp}
                  whileHover={prefersReducedMotion ? {} : {
                    y: -6,
                    rotateY: 5,
                    rotateX: -3,
                    transition: { type: 'spring', stiffness: 300, damping: 20 },
                  }}
                >
                  <span className="text-4xl md:text-5xl block mb-2">{item.icon}</span>
                  <p className="text-gray-700 font-medium text-xs md:text-sm">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===== Footer CTA Section ===== */}
        <section className="px-4 pb-12 md:pb-16">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="relative bg-gradient-to-br from-pink-500 via-pink-400 to-violet-500 rounded-[2rem] p-8 md:p-12 shadow-2xl shadow-pink-300/30 overflow-hidden text-center"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Background sparkles */}
              <SparkleDecor className="top-6 left-[12%]" delay={0.2} prefersReducedMotion={prefersReducedMotion} />
              <SparkleDecor className="top-8 right-[15%]" delay={0.9} prefersReducedMotion={prefersReducedMotion} />
              <SparkleDecor className="bottom-6 left-[20%]" delay={1.5} prefersReducedMotion={prefersReducedMotion} />
              <SparkleDecor className="bottom-10 right-[18%]" delay={0.6} prefersReducedMotion={prefersReducedMotion} />

              <motion.h2
                className="text-xl md:text-3xl font-bold text-white mb-4 relative z-10"
                style={{ fontFamily: "'Righteous', sans-serif" }}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
              >
                大切な人に、
                <br className="md:hidden" />
                世界に一つの歌を贈ろう
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="relative z-10"
              >
                <Link to="/order" onClick={handleCtaClick}>
                  <motion.button
                    className="bg-white text-pink-600 font-bold text-lg md:text-xl px-8 md:px-10 py-4 md:py-5 rounded-full shadow-lg cursor-pointer"
                    animate={prefersReducedMotion ? {} : {
                      boxShadow: [
                        '0 10px 30px -10px rgba(255,255,255,0.5)',
                        '0 15px 40px -10px rgba(255,255,255,0.7)',
                        '0 10px 30px -10px rgba(255,255,255,0.5)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    ¥500で作成する
                  </motion.button>
                </Link>
                <p className="text-white/90 text-sm md:text-base mt-4">
                  ワンコイン・登録不要・3日以内にお届け
                </p>
              </motion.div>

              {/* Floating decorations */}
              <div className="absolute top-4 right-6 opacity-60">
                <FloatingIcon icon={MusicNoteIcon} color="text-white" size="w-8 h-8" delay={0.3} prefersReducedMotion={prefersReducedMotion} />
              </div>
              <div className="absolute bottom-4 left-6 opacity-60">
                <FloatingIcon icon={GiftIcon} color="text-white" size="w-8 h-8" delay={0.8} prefersReducedMotion={prefersReducedMotion} />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 text-gray-500 text-xs">
          <p>© 2024 Songift. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
};

export default LandingB;
