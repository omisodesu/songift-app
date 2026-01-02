import LandingPage from './LandingPage';

/**
 * A/Bテスト: バリアントA
 * 現状は既存のLandingPageをそのまま表示
 */
const LandingA = () => {
  return (
    <>
      {/* 開発用：variant A の目印 */}
      <div className="fixed top-2 right-2 bg-blue-500 text-white px-2 py-1 text-xs rounded z-50">
        A
      </div>
      <LandingPage />
    </>
  );
};

export default LandingA;
