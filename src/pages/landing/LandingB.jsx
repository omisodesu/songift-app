import LandingPage from './LandingPage';
import { track } from '../../lib/analytics';

/**
 * A/Bテスト: バリアントB
 * 現状はAと同じ内容（LandingPageを表示）
 *
 * ============================================
 * TODO: ここがBの差分ポイント
 * - ヘッドライン変更
 * - CTAボタンの文言・色変更
 * - レイアウト変更
 * など、テストしたい要素をここで変更する
 * ============================================
 */
const LandingB = () => {
  const handleCtaClick = () => {
    track('cta_click', { cta: '作成を申し込む', variant: 'B' });
  };

  return (
    <>
      {/* 開発用：variant B の目印 */}
      <div className="fixed top-2 right-2 bg-red-500 text-white px-2 py-1 text-xs rounded z-50">
        B
      </div>
      <LandingPage onCtaClick={handleCtaClick} />
    </>
  );
};

export default LandingB;
