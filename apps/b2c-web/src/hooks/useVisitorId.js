import { useState, useEffect } from 'react';
import { getOrCreateVisitorId, getVisitorId } from '../lib/visitorStorage';

/**
 * 訪問者ID管理フック
 * @returns {{ visitorId: string, isLoading: boolean }}
 */
export const useVisitorId = () => {
  const [visitorId, setVisitorId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // クライアントサイドでのみ実行
    const id = getOrCreateVisitorId();
    setVisitorId(id);
    setIsLoading(false);
  }, []);

  return { visitorId, isLoading };
};

/**
 * 訪問者IDを取得のみ（生成しない）
 * URLパラメータからのvisitorIdがある場合に使用
 */
export const useExistingVisitorId = () => {
  const [visitorId, setVisitorId] = useState(null);

  useEffect(() => {
    const id = getVisitorId();
    setVisitorId(id);
  }, []);

  return visitorId;
};

export default useVisitorId;
