import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LandingA from './LandingA';
import LandingB from './LandingB';

const STORAGE_KEY = 'lp_variant';

/**
 * A/Bテスト振り分けコンポーネント
 * - /?v=A or /?v=B でvariantを強制指定（localStorageに保存）
 * - クエリがなければlocalStorageを参照
 * - localStorageもなければランダム50/50で決定
 */
const HomeAB = () => {
  const [searchParams] = useSearchParams();
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    const queryVariant = searchParams.get('v');

    if (queryVariant === 'A' || queryVariant === 'B') {
      // クエリパラメータがあれば優先し、localStorageに保存
      localStorage.setItem(STORAGE_KEY, queryVariant);
      setVariant(queryVariant);
    } else {
      // localStorageを確認
      const storedVariant = localStorage.getItem(STORAGE_KEY);
      if (storedVariant === 'A' || storedVariant === 'B') {
        setVariant(storedVariant);
      } else {
        // ランダム50/50で決定し保存
        const randomVariant = Math.random() < 0.5 ? 'A' : 'B';
        localStorage.setItem(STORAGE_KEY, randomVariant);
        setVariant(randomVariant);
      }
    }
  }, [searchParams]);

  // variant決定前は何も表示しない（ちらつき防止）
  if (!variant) return null;

  return variant === 'A' ? <LandingA /> : <LandingB />;
};

export default HomeAB;
