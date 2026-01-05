import { useState, useEffect, useCallback, useRef } from 'react';
import { useVisitorId } from './useVisitorId';
import { checkFeedbackStatus } from '../lib/feedbackApi';
import { hasSubmittedFeedbackLocally } from '../lib/visitorStorage';
import { track } from '../lib/analytics';

/**
 * フィードバック表示制御フック
 * 同一チャネル・同一日の重複表示を防止
 *
 * @param {string} channel - フィードバックチャネル
 * @param {string} [orderId] - 注文ID（オプション）
 * @returns {{ shouldShow: boolean, isChecking: boolean, markShown: () => void }}
 */
export const useFeedbackExposure = (channel, orderId) => {
  const { visitorId, isLoading: visitorLoading } = useVisitorId();
  const [shouldShow, setShouldShow] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const promptShownTracked = useRef(false);

  useEffect(() => {
    const checkExposure = async () => {
      // visitorIdがロード中の場合は待機
      if (visitorLoading || !visitorId) {
        return;
      }

      // まずローカルストレージをチェック（高速）
      if (hasSubmittedFeedbackLocally(channel)) {
        setShouldShow(false);
        setIsChecking(false);
        return;
      }

      // サーバーサイドでもチェック
      try {
        const status = await checkFeedbackStatus({
          visitorId,
          channel,
          orderId,
        });

        setShouldShow(!status.hasSubmitted);
      } catch (error) {
        // エラー時は表示する（念のため）
        console.warn('Failed to check feedback status:', error);
        setShouldShow(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkExposure();
  }, [visitorId, visitorLoading, channel, orderId]);

  /**
   * フィードバックプロンプト表示をトラッキング
   */
  const markShown = useCallback(() => {
    if (!promptShownTracked.current && shouldShow) {
      track('feedback_prompt_shown', { channel, orderId });
      promptShownTracked.current = true;
    }
  }, [shouldShow, channel, orderId]);

  return {
    shouldShow,
    isChecking: isChecking || visitorLoading,
    markShown,
  };
};

export default useFeedbackExposure;
