import LandingPage from './LandingPage';
import { track } from '../../lib/analytics';

/**
 * A/Bテスト: バリアントA
 * 現状は既存のLandingPageをそのまま表示
 */
const LandingA = () => {
  const handleCtaClick = () => {
    track('cta_click', { cta: '作成を申し込む', variant: 'A' });
  };

  return (
    <>
      {/* 開発用：variant A の目印 */}
      <div className="fixed top-2 right-2 bg-blue-500 text-white px-2 py-1 text-xs rounded z-50">
        A
      </div>
      <LandingPage onCtaClick={handleCtaClick} />
    </>
  );
};

export default LandingA;
