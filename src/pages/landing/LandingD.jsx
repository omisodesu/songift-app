import { Link } from 'react-router-dom';
import { track } from '../../lib/analytics';

/**
 * ランディングページ バリアントD
 * 空のテンプレート - デザインは後で追加
 */

const LandingD = () => {
  const handleCtaClick = (ctaName) => {
    track('cta_click', { cta: ctaName, variant: 'D' });
  };

  return (
    <>
      {/* 開発用：variant D の目印 */}
      <div className="fixed top-2 right-2 bg-orange-500 text-white px-2 py-1 text-xs rounded z-50">
        D
      </div>

      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
        {/* ヘッダー */}
        <header className="py-6 px-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Songift</h1>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
              Landing Page D
            </h2>
            <p className="text-xl text-gray-600 mb-10">
              このページはテンプレートです。デザインを追加してください。
            </p>
            <Link
              to="/order"
              onClick={() => handleCtaClick('注文する - LandingD')}
              className="inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-lg bg-orange-500 text-white hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              注文する
            </Link>
          </div>
        </main>

        {/* フッター */}
        <footer className="py-8 px-4 border-t">
          <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
            <p>&copy; 2024 Songift. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingD;
