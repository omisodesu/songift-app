import LandingPage from './LandingPage';

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
  return (
    <>
      {/* 開発用：variant B の目印 */}
      <div className="fixed top-2 right-2 bg-red-500 text-white px-2 py-1 text-xs rounded z-50">
        B
      </div>
      <LandingPage />
    </>
  );
};

export default LandingB;
