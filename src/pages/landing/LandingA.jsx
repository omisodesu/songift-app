import { Link } from 'react-router-dom';
import { track } from '../../lib/analytics';
import { useState } from 'react';

/**
 * A/Bテスト: バリアントA
 * プロフェッショナルなランディングページ
 */

// SVG Icons
const MusicNoteIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

const SparklesIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const GiftIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9.375 3a1.875 1.875 0 000 3.75h1.875v4.5H3.375A1.875 1.875 0 011.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 019.375 3zM12.75 7.5h1.875a1.875 1.875 0 100-3.75 3.375 3.375 0 012.807 3.75h3.193c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H12.75v-4.5z" />
    <path d="M11.25 12.75H3v6.75a2.25 2.25 0 002.25 2.25h6v-9zM12.75 12.75v9h6a2.25 2.25 0 002.25-2.25v-6.75h-8.25z" />
  </svg>
);

const HeartIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
  </svg>
);

const CheckCircleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

const ChevronDownIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const StarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
  </svg>
);

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-pink-100 cursor-pointer">
    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-violet-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative">
      <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-violet-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </div>
  </div>
);

// Step Card Component
const StepCard = ({ number, title, description }) => (
  <div className="relative flex flex-col items-center text-center">
    <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-violet-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
      {number}
    </div>
    <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-600 text-sm leading-relaxed max-w-xs">{description}</p>
  </div>
);

// Mode Card Component
const ModeCard = ({ title, description, features, recommended }) => (
  <div className={`relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border transition-all duration-300 cursor-pointer hover:shadow-xl ${recommended ? 'border-pink-300 ring-2 ring-pink-200' : 'border-pink-100'}`}>
    {recommended && (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-violet-500 text-white text-xs font-bold px-4 py-1 rounded-full">
        おすすめ
      </span>
    )}
    <h3 className="text-xl font-bold text-slate-800 mb-2 mt-2">{title}</h3>
    <p className="text-slate-600 text-sm mb-4">{description}</p>
    <ul className="space-y-2">
      {features.map((feature, index) => (
        <li key={index} className="flex items-center gap-2 text-sm text-slate-700">
          <CheckCircleIcon className="w-5 h-5 text-pink-500 flex-shrink-0" />
          {feature}
        </li>
      ))}
    </ul>
  </div>
);

// Testimonial Card Component
const TestimonialCard = ({ name, role, content, rating }) => (
  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-pink-100">
    <div className="flex gap-1 mb-4">
      {[...Array(rating)].map((_, i) => (
        <StarIcon key={i} className="w-5 h-5 text-amber-400" />
      ))}
    </div>
    <p className="text-slate-700 text-sm leading-relaxed mb-4 italic">"{content}"</p>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-violet-400 rounded-full flex items-center justify-center text-white font-bold">
        {name[0]}
      </div>
      <div>
        <p className="font-semibold text-slate-800 text-sm">{name}</p>
        <p className="text-slate-500 text-xs">{role}</p>
      </div>
    </div>
  </div>
);

// FAQ Item Component
const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div className="border-b border-pink-100 last:border-b-0">
    <button
      onClick={onClick}
      className="w-full py-5 flex items-center justify-between text-left cursor-pointer group"
      aria-expanded={isOpen}
    >
      <span className="font-semibold text-slate-800 group-hover:text-pink-600 transition-colors pr-4">{question}</span>
      <ChevronDownIcon className={`w-5 h-5 text-pink-500 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <div
      className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}
    >
      <p className="text-slate-600 text-sm leading-relaxed">{answer}</p>
    </div>
  </div>
);

// CTA Button Component
const CTAButton = ({ onClick, children, variant = 'primary', className = '' }) => {
  const baseStyles = 'inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-lg cursor-pointer';
  const variants = {
    primary: 'bg-gradient-to-r from-pink-500 to-violet-500 text-white hover:from-pink-600 hover:to-violet-600 hover:shadow-xl hover:scale-105',
    secondary: 'bg-white text-pink-600 border-2 border-pink-200 hover:border-pink-400 hover:shadow-xl',
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

// Floating Decoration Component
const FloatingDecoration = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div className="absolute top-20 left-10 w-64 h-64 bg-pink-300/20 rounded-full blur-3xl animate-float-slow" />
    <div className="absolute top-40 right-20 w-48 h-48 bg-violet-300/20 rounded-full blur-3xl animate-float-medium" />
    <div className="absolute bottom-20 left-1/3 w-56 h-56 bg-amber-200/20 rounded-full blur-3xl animate-float-fast" />

    {/* Music notes decoration */}
    <div className="absolute top-32 left-[15%] text-pink-300/40 animate-float-slow">
      <MusicNoteIcon className="w-8 h-8" />
    </div>
    <div className="absolute top-48 right-[20%] text-violet-300/40 animate-float-medium">
      <MusicNoteIcon className="w-6 h-6" />
    </div>
    <div className="absolute bottom-40 left-[25%] text-pink-300/30 animate-float-fast">
      <SparklesIcon className="w-10 h-10" />
    </div>
    <div className="absolute top-[60%] right-[15%] text-amber-300/40 animate-float-slow">
      <SparklesIcon className="w-7 h-7" />
    </div>
  </div>
);

const LandingA = () => {
  const [openFAQ, setOpenFAQ] = useState(0);

  const handleCtaClick = (ctaName) => {
    track('cta_click', { cta: ctaName, variant: 'A' });
  };

  const features = [
    {
      icon: MusicNoteIcon,
      title: 'AIがオリジナル曲を生成',
      description: '世界に一つだけのバースデーソングをAIが作曲。あなたの想いを特別な歌に。',
    },
    {
      icon: SparklesIcon,
      title: '簡単5ステップ',
      description: '魔法診断に答えるだけで、想いが歌になる。難しい操作は一切不要。',
    },
    {
      icon: GiftIcon,
      title: 'すぐにシェア',
      description: '完成したらメールでお届け。SNSでシェアも簡単にできます。',
    },
    {
      icon: HeartIcon,
      title: 'ワンコイン500円',
      description: '大切な人への想いを、手軽な価格で形に。特別な贈り物をお届けします。',
    },
  ];

  const steps = [
    {
      number: '1',
      title: '答える',
      description: '5つの魔法診断に答える。相手の色、気持ち、魔法の言葉など直感で選ぶだけ。',
    },
    {
      number: '2',
      title: '生成',
      description: 'AIがあなたの想いを込めたオリジナル曲を作成。世界に一つだけの特別な歌が生まれます。',
    },
    {
      number: '3',
      title: '届ける',
      description: '完成した曲をメールで受け取り、大切な人にプレゼント。特別な日をもっと特別に。',
    },
  ];

  const testimonials = [
    {
      name: '田中美咲',
      role: '友人の誕生日に',
      content: '友達の誕生日に作ったら大感動してくれました！名前入りで、しかもその子らしい雰囲気の曲で本当に嬉しかった。',
      rating: 5,
    },
    {
      name: '佐藤健太',
      role: '彼女へのサプライズ',
      content: '普段は照れくさくて言えない気持ちを歌にして贈りました。彼女が泣いて喜んでくれて、作って良かったです。',
      rating: 5,
    },
    {
      name: '山田花子',
      role: '母の誕生日に',
      content: '母の誕生日に子供たちと一緒に贈りました。「こんな素敵なプレゼント初めて」と言ってもらえて家族みんな幸せでした。',
      rating: 5,
    },
  ];

  const faqs = [
    {
      question: '料金はいくらですか？',
      answer: '1曲500円でご利用いただけます。ワンコイン価格で、世界に一つだけのオリジナルバースデーソングをお届けします。',
    },
    {
      question: 'どのくらいで曲が届きますか？',
      answer: 'ご注文から3日以内に、登録いただいたメールアドレスに完成した曲をお届けします。',
    },
    {
      question: '作った曲はSNSでシェアできますか？',
      answer: 'もちろんです！完成した曲はSNSでシェアしたり、音声ファイルとしてダウンロードして自由にお使いいただけます。',
    },
    {
      question: '音楽の知識がなくても大丈夫ですか？',
      answer: 'まったく問題ありません。5つの簡単な質問に直感で答えるだけで、AIが素敵な曲を作ってくれます。専門知識は一切不要です。',
    },
    {
      question: 'プロモードとは何ですか？',
      answer: 'より細かく曲をカスタマイズしたい方向けのモードです。ジャンル、楽器、歌い手の性別、メッセージなどを自分で指定できます。こだわり派の方におすすめです。',
    },
  ];

  return (
    <>
      {/* 開発用：variant A の目印 */}
      <div className="fixed top-2 right-2 bg-blue-500 text-white px-2 py-1 text-xs rounded z-50">
        A
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-3deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 5s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-300 { animation-delay: 0.3s; }
        .animation-delay-400 { animation-delay: 0.4s; }

        @media (prefers-reduced-motion: reduce) {
          .animate-float-slow,
          .animate-float-medium,
          .animate-float-fast,
          .animate-fade-in-up {
            animation: none;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-violet-50">
        {/* Hero Section */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
          <FloatingDecoration />

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            {/* Logo */}
            <div className="mb-8 animate-fade-in-up opacity-0" style={{ animationDelay: '0s', animationFillMode: 'forwards' }}>
              <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                Songift
              </span>
            </div>

            {/* Main Copy */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-slate-800 mb-6 leading-tight animate-fade-in-up opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
              想いを込めた、
              <br className="md:hidden" />
              <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                世界に一つ
              </span>
              の
              <br />
              バースデーソングを。
            </h1>

            {/* Sub Copy */}
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              AIが作る、あなただけのオリジナル楽曲。
              <br className="hidden md:block" />
              大切な人の特別な日を、もっと特別に。
            </p>

            {/* CTA */}
            <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
              <CTAButton onClick={() => handleCtaClick('作ってみる - Hero')}>
                作ってみる
              </CTAButton>
            </div>

            {/* Trust badges */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 animate-fade-in-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              <span className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                ワンコイン500円
              </span>
              <span className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                登録不要
              </span>
              <span className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                3日以内にお届け
              </span>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDownIcon className="w-8 h-8 text-pink-400" />
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4" aria-labelledby="features-heading">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 id="features-heading" className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                Songiftの
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">特徴</span>
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                世界に一つだけのバースデーソングを、誰でも簡単に作成できます
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <FeatureCard key={index} {...feature} />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-pink-50/50 to-violet-50/50" aria-labelledby="how-it-works-heading">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 id="how-it-works-heading" className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">3ステップ</span>
                で完成
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                難しい操作は一切なし。直感的に答えるだけで、あなただけの曲が完成します
              </p>
            </div>

            <div className="relative">
              {/* Connecting line (desktop) */}
              <div className="hidden md:block absolute top-8 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-gradient-to-r from-pink-200 via-violet-200 to-pink-200" aria-hidden="true" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
                {steps.map((step, index) => (
                  <StepCard key={index} {...step} />
                ))}
              </div>
            </div>

            <div className="text-center mt-12">
              <CTAButton onClick={() => handleCtaClick('今すぐ試す - HowItWorks')}>
                今すぐ試す
              </CTAButton>
            </div>
          </div>
        </section>

        {/* Mode Introduction Section */}
        <section className="py-20 px-4" aria-labelledby="modes-heading">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 id="modes-heading" className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                2つの
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">作成モード</span>
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                あなたのスタイルに合わせてお選びください
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ModeCard
                title="簡単モード（魔法診断）"
                description="初めての方におすすめ。直感で答えるだけ。"
                features={[
                  '5つの質問に答えるだけ',
                  '所要時間わずか1分',
                  'AIがぴったりの曲調を選択',
                  '迷わず簡単に作成',
                ]}
                recommended
              />
              <ModeCard
                title="プロモード"
                description="こだわり派向け。細かく指定できます。"
                features={[
                  'ジャンルを自由に選択',
                  '楽器・歌い手を指定',
                  'オリジナルメッセージを入力',
                  '完全カスタマイズ可能',
                ]}
              />
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-pink-50/50 to-violet-50/50" aria-labelledby="testimonials-heading">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 id="testimonials-heading" className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">お客様</span>
                の声
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Songiftで大切な人を喜ばせた方々の声をご紹介します
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <TestimonialCard key={index} {...testimonial} />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 px-4" aria-labelledby="faq-heading">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                よくある
                <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">ご質問</span>
              </h2>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-pink-100 px-6 md:px-8">
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
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-pink-500 to-violet-500" aria-labelledby="final-cta-heading">
          <div className="max-w-4xl mx-auto text-center">
            <h2 id="final-cta-heading" className="text-3xl md:text-4xl font-bold text-white mb-6">
              大切な人の誕生日に、
              <br className="md:hidden" />
              世界に一つの歌を贈ろう
            </h2>
            <p className="text-white/90 text-lg mb-10 max-w-2xl mx-auto">
              あなたの想いをAIが特別な歌に変えます。
              <br />
              ワンコイン500円で作成してみませんか？
            </p>
            <CTAButton
              onClick={() => handleCtaClick('今すぐ作成する - FinalCTA')}
              variant="secondary"
            >
              今すぐ作成する
            </CTAButton>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 bg-slate-900 text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} Songift. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  );
};

export default LandingA;
