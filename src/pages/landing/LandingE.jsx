import { Link } from 'react-router-dom';
import { track } from '../../lib/analytics';
import { useState } from 'react';

/**
 * A/Bテスト: バリアントE
 * フルページランディングページ（Figmaデザイン完全実装版）
 */

// ============================================
// SVG Icons
// ============================================

const SparkleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.33V2.67M8 13.33V14.67M13.33 8H14.67M1.33 8H2.67M11.33 4.67L12.67 3.33M3.33 12.67L4.67 11.33M11.33 11.33L12.67 12.67M3.33 3.33L4.67 4.67" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M13.33 4L6 11.33L2.67 8" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ClockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 5V10L13.33 11.67M18.33 10C18.33 14.6 14.6 18.33 10 18.33C5.4 18.33 1.67 14.6 1.67 10C1.67 5.4 5.4 1.67 10 1.67C14.6 1.67 18.33 5.4 18.33 10Z" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const QuestionIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M7.58 7.5C7.77 6.94 8.16 6.47 8.67 6.17C9.18 5.88 9.77 5.77 10.36 5.87C10.94 5.97 11.47 6.27 11.85 6.72C12.23 7.17 12.43 7.74 12.43 8.33C12.43 10 9.93 10.83 9.93 10.83M10 14.17H10.01M18.33 10C18.33 14.6 14.6 18.33 10 18.33C5.4 18.33 1.67 14.6 1.67 10C1.67 5.4 5.4 1.67 10 1.67C14.6 1.67 18.33 5.4 18.33 10Z" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GiftIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 8V21M12 8H8.46C7.55 8 6.68 7.64 6.03 7.01C5.39 6.37 5 5.51 5 4.62C5 3.72 5.39 2.86 6.03 2.23C6.68 1.6 7.55 1.24 8.46 1.24C11.69 1.24 12 5.06 12 8ZM12 8H15.54C16.45 8 17.32 7.64 17.97 7.01C18.61 6.37 19 5.51 19 4.62C19 3.72 18.61 2.86 17.97 2.23C17.32 1.6 16.45 1.24 15.54 1.24C12.31 1.24 12 5.06 12 8Z" stroke="#E6B8E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 12H19M5 12C3.9 12 3 11.1 3 10C3 8.9 3.9 8 5 8H19C20.1 8 21 8.9 21 10C21 11.1 20.1 12 19 12M5 12V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V12" stroke="#E6B8E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronDownIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const StarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0L9.8 5.5H15.6L10.9 8.9L12.7 14.4L8 11L3.3 14.4L5.1 8.9L0.4 5.5H6.2L8 0Z"/>
  </svg>
);

const MusicIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 18V5L21 3V16M9 18C9 19.66 7.21 21 5 21C2.79 21 1 19.66 1 18C1 16.34 2.79 15 5 15C7.21 15 9 16.34 9 18ZM21 16C21 17.66 19.21 19 17 19C14.79 19 13 17.66 13 16C13 14.34 14.79 13 17 13C19.21 13 21 14.34 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PenIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 20H21M16.5 3.5C16.89 3.11 17.41 2.89 17.96 2.89C18.23 2.89 18.5 2.94 18.74 3.04C18.99 3.14 19.21 3.29 19.39 3.47C19.58 3.66 19.72 3.88 19.82 4.12C19.92 4.37 19.97 4.63 19.97 4.9C19.97 5.45 19.76 5.97 19.36 6.36L6 19.72L2 21L3.27 17L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MailIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowRightIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4.17 10H15.83M10 4.17L15.83 10L10 15.83" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ============================================
// Components
// ============================================

// Hero Section Badge
const HeroBadge = ({ children }) => (
  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 border border-white/40 backdrop-blur-sm">
    <SparkleIcon className="w-4 h-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
    <span className="text-sm text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{children}</span>
  </div>
);

// Feature Badge in Hero
const FeatureBadge = ({ icon: IconComponent, text }) => (
  <div className="flex items-center gap-2">
    <IconComponent className="w-5 h-5 text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
    <span className="text-sm text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{text}</span>
  </div>
);

// Problem Card
const ProblemCard = ({ emoji, title, description }) => (
  <div className="bg-white rounded-2xl p-6 border-2 border-pink-100 shadow-lg">
    <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
      <span className="text-2xl">{emoji}</span>
    </div>
    <h3 className="text-lg font-bold text-slate-800 mb-2 whitespace-pre-line">{title}</h3>
    <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
  </div>
);

// About Feature Card
const AboutFeatureCard = ({ icon: IconComponent, title, description }) => (
  <div className="text-center">
    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-pink-400 to-purple-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
      <IconComponent className="w-8 h-8 text-white" />
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

// Question Badge
const QuestionBadge = ({ number, text }) => (
  <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
    <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center">
      <span className="text-sm font-bold text-white">{number}</span>
    </div>
    <span className="text-slate-700">{text}</span>
  </div>
);

// Step Card
const StepCard = ({ number, title, description, color }) => {
  const colorClasses = {
    pink: 'from-pink-400 to-pink-500',
    purple: 'from-purple-400 to-purple-500',
    amber: 'from-amber-300 to-amber-400',
  };

  return (
    <div className="bg-white rounded-3xl p-8 border-2 border-purple-100 shadow-xl relative">
      <div className={`absolute top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-br ${colorClasses[color]} rounded-full flex items-center justify-center shadow-lg`}>
        <span className="text-2xl font-bold text-white">{number}</span>
      </div>
      <div className="pt-20 text-center">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl flex items-center justify-center mb-4">
          {number === '1' && <PenIcon className="w-10 h-10 text-purple-400" />}
          {number === '2' && <MusicIcon className="w-10 h-10 text-purple-400" />}
          {number === '3' && <MailIcon className="w-10 h-10 text-purple-400" />}
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-3">{title}</h3>
        <p className="text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

// Pricing Feature Item
const PricingFeature = ({ text }) => (
  <div className="flex items-center gap-3">
    <div className="w-6 h-6 bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
      <CheckIcon className="w-4 h-4 text-white" />
    </div>
    <span className="text-slate-700">{text}</span>
  </div>
);

// Review Card
const ReviewCard = ({ emoji, name, title, content }) => (
  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-6 border-2 border-purple-100 shadow-lg relative">
    <div className="absolute -top-2.5 -left-2.5 w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg">
      <span className="text-lg">❝</span>
    </div>
    <div className="flex items-center gap-3 mb-4">
      <span className="text-3xl">{emoji}</span>
      <div>
        <p className="font-bold text-slate-800">{name}</p>
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <StarIcon key={i} className="w-4 h-4 text-amber-300" />
          ))}
        </div>
      </div>
    </div>
    <h4 className="font-bold text-slate-800 mb-2">{title}</h4>
    <p className="text-sm text-slate-600 leading-relaxed">{content}</p>
  </div>
);

// Stats Item
const StatsItem = ({ value, label }) => (
  <div className="text-center">
    <p className="text-4xl font-bold bg-gradient-to-br from-pink-400 to-purple-400 bg-clip-text text-transparent">{value}</p>
    <p className="text-slate-600 text-sm">{label}</p>
  </div>
);

// FAQ Item
const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div className="bg-white rounded-2xl border-2 border-purple-100 shadow-lg overflow-hidden">
    <button
      onClick={onClick}
      className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer"
      aria-expanded={isOpen}
    >
      <span className="font-bold text-slate-800">{question}</span>
      <ChevronDownIcon className={`w-6 h-6 text-purple-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
      <div className="px-6 pb-5 border-t border-purple-100 pt-4">
        <p className="text-slate-600 leading-relaxed">{answer}</p>
      </div>
    </div>
  </div>
);

// CTA Button
const CTAButton = ({ onClick, children, variant = 'primary', className = '' }) => {
  const baseStyles = 'inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 cursor-pointer';
  const variants = {
    primary: 'bg-white text-pink-600 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.3)] hover:scale-105',
    gradient: 'bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-xl hover:shadow-2xl hover:scale-105',
  };

  return (
    <Link
      to="/order"
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
};

// Trust Badge for footer
const TrustBadge = ({ emoji, title, subtitle }) => (
  <div className="flex items-center gap-2">
    <span className="text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{emoji}</span>
    <div>
      <p className="font-bold text-sm text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{title}</p>
      <p className="text-xs text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{subtitle}</p>
    </div>
  </div>
);

// ============================================
// Main Component
// ============================================

const LandingE = () => {
  const [openFAQ, setOpenFAQ] = useState(0);

  const handleCtaClick = (ctaName) => {
    track('cta_click', { cta: ctaName, variant: 'E' });
  };

  const problems = [
    {
      emoji: '🎁',
      title: '誕生日プレゼント、\nいつも同じになっちゃう...',
      description: '花束やケーキは定番だけど、何か特別なものを贈りたい。でも何がいいか思いつかない。',
    },
    {
      emoji: '⏰',
      title: 'サプライズしたいけど\n準備が大変...',
      description: '友達を喜ばせたいけど、時間もお金もかけられない。でも手抜きには見られたくない。',
    },
    {
      emoji: '📱',
      title: 'SNSに投稿できる\nセンスいいものがほしい',
      description: 'Instagramにアップしたとき、「センスいいね！」って言われるようなプレゼントを探してる。',
    },
  ];

  const aboutFeatures = [
    {
      icon: MusicIcon,
      title: '完全オリジナル',
      description: 'あなたが答えた質問をもとに、世界に1つだけの歌詞とメロディーを作成します。',
    },
    {
      icon: PenIcon,
      title: 'プロが作曲',
      description: '経験豊富な作曲家が、心を込めて一曲一曲丁寧に制作します。',
    },
    {
      icon: MailIcon,
      title: 'すぐに使える',
      description: 'MP3ファイルでお届けするので、SNSや動画編集にすぐ使えます。',
    },
  ];

  const questions = [
    'お友達のお名前は？',
    'どんな性格ですか？',
    '一番の思い出は？',
    '好きな食べ物や趣味は？',
    'どんなメッセージを伝えたい？',
  ];

  const steps = [
    {
      number: '1',
      title: '5つの質問に答える',
      description: 'お友達の名前、性格、思い出など、簡単な質問に答えるだけ。所要時間はたった3分。',
      color: 'pink',
    },
    {
      number: '2',
      title: 'プロが作曲',
      description: 'あなたの回答をもとに、経験豊富な作曲家が心を込めてオリジナルソングを制作します。',
      color: 'purple',
    },
    {
      number: '3',
      title: '3日以内にお届け',
      description: '完成したバースデーソングをメールでお届け。すぐにSNSや動画に使えます。',
      color: 'amber',
    },
  ];

  const pricingFeatures = [
    '5つの質問に答えるだけ',
    'プロの作曲家が制作',
    '完全オリジナルの歌詞とメロディー',
    'MP3ファイルでお届け',
    '3日以内に納品',
    '登録・月額料金なし',
  ];

  const reviews = [
    {
      emoji: '👩',
      name: 'あやかさん (25歳)',
      title: '友達が泣いて喜んでくれました！',
      content: '親友の誕生日に何をプレゼントしようか悩んでいたときに見つけました。500円だし試しに...と思ったら、想像以上のクオリティ！歌詞に2人の思い出が盛り込まれていて、渡したら泣いて喜んでくれました。',
    },
    {
      emoji: '🧑‍🦰',
      name: 'みおさん (23歳)',
      title: 'こんなに簡単でいいの？',
      content: '質問に答えるだけで本当にオリジナルソングができるなんて信じられませんでした。でも届いた曲を聴いて鳥肌！友達の名前も入ってるし、メロディーもすごく素敵で。コスパ最強です！',
    },
    {
      emoji: '👨',
      name: 'ゆうこさん (27歳)',
      title: 'サプライズパーティーで大成功',
      content: '彼女の誕生日パーティーでこの曲を流したら、会場がすごく盛り上がりました！「世界に1つだけの曲」っていうのが特別感あって最高。リピート確定です！',
    },
  ];

  const faqs = [
    {
      question: '本当に5つの質問だけで作れるんですか？',
      answer: 'はい！お友達のお名前、性格、思い出、好きなもの、伝えたいメッセージの5つの質問に答えるだけです。所要時間は約3分。難しい音楽知識は一切不要です。',
    },
    {
      question: 'どんな形式でもらえますか？',
      answer: 'MP3ファイルでメールにてお届けします。スマホでもパソコンでもすぐに聴けて、InstagramやTikTokの動画編集にも簡単に使えます。歌詞カードのPDFも一緒にお送りします。',
    },
    {
      question: '本当に3日以内に届きますか？',
      answer: 'はい、ご注文から3日以内（土日祝除く）にメールでお届けします。お急ぎの場合は、ご注文時に備考欄にてご相談ください。できる限り対応させていただきます。',
    },
    {
      question: '追加料金はかかりませんか？',
      answer: '一切かかりません。表示されている500円（税込）のみです。登録料、月額料金、隠れた追加料金などは一切ありません。安心してご利用ください。',
    },
  ];

  const ctaFeatures = [
    '5つの質問に答えるだけ（3分で完了）',
    'プロの作曲家が心を込めて制作',
    '3日以内にメールでお届け',
    '登録不要・追加料金なし',
  ];

  return (
    <>
      {/* 開発用：variant E の目印 */}
      <div className="fixed top-2 right-2 bg-purple-500 text-white px-2 py-1 text-xs rounded z-50">
        E
      </div>

      {/* Custom CSS */}
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="min-h-screen">
        {/* ============================================ */}
        {/* Hero Section */}
        {/* ============================================ */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          {/* Background */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/images/landing/hero-birthday-e.png)' }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgba(255,229,240,0.6) 0%, rgba(245,230,245,0.5) 50%, rgba(255,245,225,0.6) 100%)' }}
            aria-hidden="true"
          />

          {/* Decorative circles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" aria-hidden="true">
            <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full blur-[48px]" />
            <div className="absolute top-1/3 right-1/5 w-32 h-32 bg-white rounded-full blur-[80px]" />
            <div className="absolute bottom-1/4 left-1/4 w-24 h-24 bg-white rounded-full blur-[48px]" />
          </div>

          {/* Content */}
          <div className="relative z-10 w-full max-w-4xl mx-auto px-4 text-center py-20">
            <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0s', animationFillMode: 'forwards' }}>
              <HeroBadge>たった500円で特別なプレゼント</HeroBadge>
            </div>

            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mt-8 mb-6 leading-tight animate-fade-in-up opacity-0"
              style={{ textShadow: '0 4px 16px rgba(0,0,0,0.9)', animationDelay: '0.1s', animationFillMode: 'forwards' }}
            >
              たった500円で、<br />一生モノのサプライズを。
            </h1>

            <p
              className="text-xl md:text-2xl text-white/90 mb-2 animate-fade-in-up opacity-0"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)', animationDelay: '0.2s', animationFillMode: 'forwards' }}
            >
              5つの質問に答えるだけで
            </p>
            <p
              className="text-lg md:text-xl text-white/80 mb-12 animate-fade-in-up opacity-0"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)', animationDelay: '0.25s', animationFillMode: 'forwards' }}
            >
              世界に1つだけのオリジナルバースデーソングが完成
            </p>

            <div className="mb-12 animate-fade-in-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
              <CTAButton onClick={() => handleCtaClick('Hero CTA')} variant="primary">
                <GiftIcon className="w-6 h-6" />
                <span>¥500で作ってみる</span>
              </CTAButton>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 animate-fade-in-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              <FeatureBadge icon={CheckIcon} text="登録不要" />
              <FeatureBadge icon={ClockIcon} text="3日以内にお届け" />
              <FeatureBadge icon={QuestionIcon} text="5つの質問だけ" />
            </div>
          </div>

          {/* Wave */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <img src="/images/landing/wave-bottom.svg" alt="" className="w-full h-auto" aria-hidden="true" />
          </div>
        </section>

        {/* ============================================ */}
        {/* Problems Section */}
        {/* ============================================ */}
        <section className="py-16 px-4 bg-gradient-to-b from-pink-50 to-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                こんな悩み、ありませんか？
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-pink-400 to-purple-400 mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {problems.map((problem, index) => (
                <ProblemCard key={index} {...problem} />
              ))}
            </div>

            <div className="text-center">
              <p className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                そんなあなたに
              </p>
              <div className="w-1 h-12 bg-gradient-to-b from-pink-400 to-purple-400 mx-auto mt-4 rounded-full" />
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* About Section */}
        {/* ============================================ */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block px-6 py-2 bg-gradient-to-r from-pink-400 to-purple-400 text-white text-sm font-bold rounded-full mb-4">
                世界に1つだけの歌とは
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                5つの質問に答えるだけで<br />特別なバースデーソングが完成
              </h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                友達の名前、思い出、好きなもの...あなたの回答から、<br />
                プロの作曲家が心に響くオリジナルソングを制作します。
              </p>
            </div>

            {/* Image */}
            <div className="rounded-3xl overflow-hidden shadow-2xl mb-12">
              <img
                src="/images/landing/about-image.png"
                alt="バースデーソング作成イメージ"
                className="w-full h-auto"
              />
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {aboutFeatures.map((feature, index) => (
                <AboutFeatureCard key={index} {...feature} />
              ))}
            </div>

            {/* Questions Panel */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-8 border-2 border-purple-100">
              <h3 className="text-2xl font-bold text-slate-800 text-center mb-6">
                たとえば、こんな質問に答えるだけ
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {questions.map((q, index) => (
                  <QuestionBadge key={index} number={index + 1} text={q} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* Steps Section */}
        {/* ============================================ */}
        <section className="py-16 px-4 bg-gradient-to-b from-white to-purple-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                たった3ステップで簡単
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-pink-400 to-purple-400 mx-auto rounded-full" />
            </div>

            {/* Progress bar */}
            <div className="relative mb-8">
              <div className="h-1 bg-gradient-to-r from-pink-200 via-purple-200 to-amber-200 rounded-full opacity-20" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {steps.map((step, index) => (
                <StepCard key={index} {...step} />
              ))}
            </div>

            <p className="text-center text-slate-700">
              <span className="font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">所要時間わずか3分</span>
              <span>で、特別なプレゼントが完成します</span>
            </p>
          </div>
        </section>

        {/* ============================================ */}
        {/* Pricing Section */}
        {/* ============================================ */}
        <section className="py-16 px-4 bg-gradient-to-br from-purple-50 to-pink-50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                シンプルな料金
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-pink-400 to-purple-400 mx-auto rounded-full" />
            </div>

            {/* Pricing Card */}
            <div className="relative">
              {/* Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <div className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-300 to-amber-400 text-amber-800 text-sm font-bold rounded-full shadow-lg">
                  <SparkleIcon className="w-4 h-4" />
                  <span>大人気プラン</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl border-4 border-transparent" style={{ borderImage: 'linear-gradient(135deg, rgba(255,183,213,0.3), rgba(230,184,230,0.3), rgba(255,231,184,0.3)) 1' }}>
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">世界に1つだけの歌</h3>
                  <p className="text-slate-600">オリジナルバースデーソング</p>
                </div>

                <div className="text-center mb-8">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-6xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">¥500</span>
                    <span className="text-slate-500">（税込）</span>
                  </div>
                  <p className="text-slate-600 mt-2">
                    <span className="font-bold">ワンコイン</span>で一生モノのプレゼント
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  {pricingFeatures.map((feature, index) => (
                    <PricingFeature key={index} text={feature} />
                  ))}
                </div>

                <CTAButton onClick={() => handleCtaClick('Pricing CTA')} variant="gradient" className="w-full justify-center">
                  今すぐ注文する
                </CTAButton>

                <p className="text-center text-sm text-slate-500 mt-4">
                  ※ クレジットカード・コンビニ決済対応
                </p>
              </div>
            </div>

            {/* Trust badge */}
            <div className="mt-8 bg-white rounded-2xl p-6 shadow-lg flex items-center justify-center gap-4">
              <span className="text-3xl">🎁</span>
              <div>
                <p className="text-sm text-slate-600">追加料金は一切なし</p>
                <p className="font-bold text-slate-800">見たままの料金で安心</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* Reviews Section */}
        {/* ============================================ */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                お客様の声
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-pink-400 to-purple-400 mx-auto rounded-full mb-4" />
              <p className="text-slate-600">実際にご利用いただいた方の感想です</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {reviews.map((review, index) => (
                <ReviewCard key={index} {...review} />
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <StatsItem value="98%" label="満足度" />
              <StatsItem value="3,000+" label="制作実績" />
              <StatsItem value="4.9" label="平均評価" />
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* FAQ Section */}
        {/* ============================================ */}
        <section className="py-16 px-4 bg-gradient-to-b from-white to-purple-50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                よくある質問
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-pink-400 to-purple-400 mx-auto rounded-full" />
            </div>

            <div className="space-y-4 mb-8">
              {faqs.map((faq, index) => (
                <FAQItem
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFAQ === index}
                  onClick={() => setOpenFAQ(openFAQ === index ? -1 : index)}
                />
              ))}
            </div>

            {/* Contact Card */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-8 text-center border-2 border-purple-100">
              <h3 className="font-bold text-slate-800 text-lg mb-2">その他のご質問はありますか？</h3>
              <p className="text-slate-600 mb-4">お気軽にお問い合わせください。24時間以内にご返信いたします。</p>
              <button className="px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-400 text-white font-bold rounded-full hover:shadow-lg transition-shadow cursor-pointer">
                お問い合わせ
              </button>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* CTA Section */}
        {/* ============================================ */}
        <section className="relative py-20 px-4 overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(255,229,240,1) 0%, rgba(245,230,245,1) 50%, rgba(255,245,225,1) 100%)' }}>
          {/* Decorative circles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10" aria-hidden="true">
            <div className="absolute top-20 left-10 w-32 h-32 bg-white rounded-full blur-[128px]" />
            <div className="absolute bottom-40 right-20 w-40 h-40 bg-white rounded-full blur-[128px]" />
            <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-white rounded-full blur-[80px]" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 border border-white/40 rounded-full mb-6">
                <SparkleIcon className="w-4 h-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                <span className="text-sm text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">今すぐ3分で注文完了</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                世界に1つだけの<br />バースデーソングを作ろう
              </h2>
              <p className="text-xl text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                たった500円で、一生の思い出に残る<br />特別なプレゼントを贈りませんか？
              </p>
            </div>

            {/* CTA Card */}
            <div className="bg-white rounded-3xl p-8 shadow-2xl mb-10">
              <div className="text-center mb-6">
                <span className="inline-block px-6 py-2 bg-gradient-to-r from-pink-400 to-purple-400 text-white text-sm font-bold rounded-full mb-4">
                  期間限定キャンペーン中
                </span>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">¥500</span>
                  <span className="text-slate-500">のみ</span>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {ctaFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckIcon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>

              <CTAButton onClick={() => handleCtaClick('Final CTA')} variant="gradient" className="w-full justify-center">
                <GiftIcon className="w-6 h-6" />
                <span>今すぐ¥500で作成する</span>
                <ArrowRightIcon className="w-5 h-5" />
              </CTAButton>

              <p className="text-center text-sm text-slate-500 mt-4">
                ※ クレジットカード・コンビニ決済に対応しています
              </p>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8">
              <TrustBadge emoji="🔒" title="安全な決済" subtitle="SSL暗号化通信" />
              <TrustBadge emoji="⚡" title="即日対応" subtitle="24時間受付中" />
              <TrustBadge emoji="💝" title="満足度98%" subtitle="3,000件以上の実績" />
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* Footer */}
        {/* ============================================ */}
        <footer className="py-8 px-4 bg-gradient-to-br from-pink-100 to-purple-100 border-t border-white/20">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-slate-600 text-sm mb-4">
              © 2026 世界に1つだけの歌. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500">
              <a href="#" className="hover:text-pink-600 transition-colors">特定商取引法に基づく表記</a>
              <span>|</span>
              <a href="#" className="hover:text-pink-600 transition-colors">プライバシーポリシー</a>
              <span>|</span>
              <a href="#" className="hover:text-pink-600 transition-colors">利用規約</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingE;
