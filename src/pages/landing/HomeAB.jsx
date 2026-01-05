import { useEffect, useMemo, useRef } from 'react';
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
  const trackedRef = useRef(false);

  // variantを計算（useMemoで同期的に決定）
  const variant = useMemo(() => {
    const queryVariant = searchParams.get('v')?.toUpperCase();
    if (queryVariant === 'A' || queryVariant === 'B') {
      return queryVariant;
    }
    return getOrCreateVariant();
  }, [searchParams]);

  // localStorageへの保存（副作用）
  useEffect(() => {
    const queryVariant = searchParams.get('v')?.toUpperCase();
    if (queryVariant === 'A' || queryVariant === 'B') {
      setVariant(queryVariant);
    }
  }, [searchParams]);

  // variant決定後にlp_viewイベントを送信（1回のみ）
  useEffect(() => {
    if (variant && !trackedRef.current) {
      track('lp_view', { variant });
      trackedRef.current = true;
    }
  }, [variant]);

  return variant === 'A' ? <LandingA /> : <LandingB />;
};

export default HomeAB;
