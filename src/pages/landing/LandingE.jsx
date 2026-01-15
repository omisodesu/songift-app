import { Link } from 'react-router-dom';
import { track } from '../../lib/analytics';

/**
 * A/Bテスト: バリアントE
 * ヒーローセクション特化型ランディングページ
 */

// SVG Icons
const SparkleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.33333V2.66667M8 13.3333V14.6667M13.3333 8H14.6667M1.33333 8H2.66667M11.3333 4.66667L12.6667 3.33333M3.33333 12.6667L4.66667 11.3333M11.3333 11.3333L12.6667 12.6667M3.33333 3.33333L4.66667 4.66667" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M16.6667 5L7.5 14.1667L3.33333 10" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ClockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 5V10L13.3333 11.6667M18.3333 10C18.3333 14.6024 14.6024 18.3333 10 18.3333C5.39763 18.3333 1.66667 14.6024 1.66667 10C1.66667 5.39763 5.39763 1.66667 10 1.66667C14.6024 1.66667 18.3333 5.39763 18.3333 10Z" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const QuestionIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M7.57501 7.49999C7.77093 6.94304 8.15764 6.47341 8.66664 6.17426C9.17564 5.87512 9.77409 5.76577 10.356 5.86558C10.9378 5.96539 11.4657 6.26792 11.8459 6.71959C12.2261 7.17126 12.4342 7.74292 12.4333 8.33332C12.4333 9.99999 9.93335 10.8333 9.93335 10.8333M10 14.1667H10.0083M18.3333 9.99999C18.3333 14.6024 14.6024 18.3333 10 18.3333C5.39763 18.3333 1.66667 14.6024 1.66667 9.99999C1.66667 5.39762 5.39763 1.66666 10 1.66666C14.6024 1.66666 18.3333 5.39762 18.3333 9.99999Z" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GiftIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 8V21M12 8H8.46154C7.55121 8 6.67833 7.63928 6.03448 7.00589C5.39063 6.3725 5 5.51359 5 4.61765C5 3.72171 5.39063 2.86279 6.03448 2.2294C6.67833 1.59602 7.55121 1.23529 8.46154 1.23529C11.6923 1.23529 12 5.05882 12 8ZM12 8H15.5385C16.4488 8 17.3217 7.63928 17.9655 7.00589C18.6094 6.3725 19 5.51359 19 4.61765C19 3.72171 18.6094 2.86279 17.9655 2.2294C17.3217 1.59602 16.4488 1.23529 15.5385 1.23529C12.3077 1.23529 12 5.05882 12 8Z" stroke="#E6B8E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 12H19M5 12C3.89543 12 3 11.1046 3 10V10C3 8.89543 3.89543 8 5 8H19C20.1046 8 21 8.89543 21 10V10C21 11.1046 20.1046 12 19 12M5 12V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V12" stroke="#E6B8E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Feature Badge Component
const FeatureBadge = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-2">
    <Icon className="w-5 h-5 text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
    <span className="text-sm text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{text}</span>
  </div>
);

// CTA Button Component
const CTAButton = ({ onClick, children }) => (
  <Link
    to="/order"
    onClick={onClick}
    className="relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-white rounded-full font-bold text-lg text-pink-600 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer"
  >
    <GiftIcon className="w-6 h-6" />
    <span>{children}</span>
    {/* Notification Badge */}
    <span className="absolute -top-1 -right-1 w-8 h-8 bg-[#FFE7B8] rounded-full flex items-center justify-center">
      <span className="text-xs font-bold text-[#E6B8E6]">!</span>
    </span>
  </Link>
);

// Decorative Blurred Circles
const DecorativeCircles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" aria-hidden="true">
    <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full blur-[48px]" />
    <div className="absolute top-[33%] right-[20%] w-32 h-32 bg-white rounded-full blur-[80px]" />
    <div className="absolute bottom-[27%] left-[25%] w-24 h-24 bg-white rounded-full blur-[48px]" />
  </div>
);

const LandingE = () => {
  const handleCtaClick = (ctaName) => {
    track('cta_click', { cta: ctaName, variant: 'E' });
  };

  return (
    <>
      {/* 開発用：variant E の目印 */}
      <div className="fixed top-2 right-2 bg-purple-500 text-white px-2 py-1 text-xs rounded z-50">
        E
      </div>

      {/* Custom CSS for animations */}
      <style>{`
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

        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>

      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/images/landing/hero-birthday-e.png)' }}
            aria-hidden="true"
          />

          {/* Gradient Overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 229, 240, 0.6) 0%, rgba(245, 230, 245, 0.5) 50%, rgba(255, 245, 225, 0.6) 100%)',
            }}
            aria-hidden="true"
          />

          {/* Decorative Circles */}
          <DecorativeCircles />

          {/* Content */}
          <div className="relative z-10 w-full max-w-4xl mx-auto px-4 text-center">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/20 border border-white/40 backdrop-blur-sm animate-fade-in-up opacity-0"
              style={{ animationDelay: '0s', animationFillMode: 'forwards' }}
            >
              <SparkleIcon className="w-4 h-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
              <span className="text-sm text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                たった500円で特別なプレゼント
              </span>
            </div>

            {/* Main Heading */}
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in-up opacity-0"
              style={{
                textShadow: '0 4px 16px rgba(0, 0, 0, 0.9)',
                animationDelay: '0.1s',
                animationFillMode: 'forwards',
              }}
            >
              たった500円で、
              <br />
              一生モノのサプライズを。
            </h1>

            {/* Subtitle */}
            <p
              className="text-xl md:text-2xl text-white/90 mb-2 animate-fade-in-up opacity-0"
              style={{
                textShadow: '0 2px 12px rgba(0, 0, 0, 0.8)',
                animationDelay: '0.2s',
                animationFillMode: 'forwards',
              }}
            >
              5つの質問に答えるだけで
            </p>

            {/* Description */}
            <p
              className="text-lg md:text-xl text-white/80 mb-12 animate-fade-in-up opacity-0"
              style={{
                textShadow: '0 2px 12px rgba(0, 0, 0, 0.8)',
                animationDelay: '0.25s',
                animationFillMode: 'forwards',
              }}
            >
              世界に1つだけのオリジナルバースデーソングが完成
            </p>

            {/* CTA Button */}
            <div
              className="mb-12 animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
            >
              <CTAButton onClick={() => handleCtaClick('¥500で作ってみる - Hero')}>
                ¥500で作ってみる
              </CTAButton>
            </div>

            {/* Feature Badges */}
            <div
              className="flex flex-wrap items-center justify-center gap-6 md:gap-8 animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
            >
              <FeatureBadge icon={CheckIcon} text="登録不要" />
              <FeatureBadge icon={ClockIcon} text="3日以内にお届け" />
              <FeatureBadge icon={QuestionIcon} text="5つの質問だけ" />
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <img
              src="/images/landing/wave-bottom.svg"
              alt=""
              className="w-full h-auto"
              aria-hidden="true"
            />
          </div>
        </section>
      </div>
    </>
  );
};

export default LandingE;
