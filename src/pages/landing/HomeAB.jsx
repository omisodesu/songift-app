import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import LandingA from './LandingA';
import LandingB from './LandingB';
import { setVariant, getOrCreateVariant } from '../../lib/ab';
import { track } from '../../lib/analytics';

/**
 * A/Bテスト振り分けコンポーネント
 * - /?v=A or /?v=B でvariantを強制指定（localStorageに保存）
 * - クエリがなければlocalStorageを参照
 * - localStorageもなければランダム50/50で決定
 */
const HomeAB = () => {
  const [searchParams] = useSearchParams();
  const [variant, setVariantState] = useState(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    const queryVariant = searchParams.get('v');

    let finalVariant;
    if (queryVariant === 'A' || queryVariant === 'B') {
      // クエリパラメータがあれば優先し、localStorageに保存
      setVariant(queryVariant);
      finalVariant = queryVariant;
    } else {
      // localStorageを確認、なければランダム生成
      finalVariant = getOrCreateVariant();
    }

    setVariantState(finalVariant);
  }, [searchParams]);

  // variant決定後にlp_viewイベントを送信（1回のみ）
  useEffect(() => {
    if (variant && !trackedRef.current) {
      track('lp_view', { variant });
      trackedRef.current = true;
    }
  }, [variant]);

  // variant決定前は何も表示しない（ちらつき防止）
  if (!variant) return null;

  return variant === 'A' ? <LandingA /> : <LandingB />;
};

export default HomeAB;
