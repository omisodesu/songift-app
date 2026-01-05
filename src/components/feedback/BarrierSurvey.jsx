import { useState, useCallback } from 'react';
import { useVisitorId } from '../../hooks/useVisitorId';
import {
  submitFeedback,
  BARRIER_REASONS,
} from '../../lib/feedbackApi';
import { markFeedbackSubmitted } from '../../lib/visitorStorage';
import { track } from '../../lib/analytics';
import { getVariant } from '../../lib/ab';

/**
 * 阻害理由アンケートコンポーネント（未購入者向け）
 *
 * @param {Object} props
 * @param {string} props.channel - フィードバックチャネル
 * @param {string} [props.orderId] - 注文ID
 * @param {function} [props.onSubmitSuccess] - 送信成功時のコールバック
 */
const BarrierSurvey = ({ channel, orderId, onSubmitSuccess }) => {
  const { visitorId, isLoading: visitorLoading } = useVisitorId();
  const [barrierReason, setBarrierReason] = useState(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!barrierReason) {
      setError('理由を選択してください');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const feedbackData = {
        visitorId,
        orderId,
        channel,
        rating: 3, // 阻害理由アンケートはデフォルト3点
        barrierReason,
        comment: comment.trim() || null,
        variant: getVariant(),
      };

      await submitFeedback(feedbackData);

      // ローカルストレージにも記録
      markFeedbackSubmitted(channel);

      // 分析イベント
      track('barrier_survey_submit', {
        channel,
        orderId,
        barrierReason,
      });

      setIsSubmitted(true);
      onSubmitSuccess?.();
    } catch (err) {
      console.error('Barrier survey submission error:', err);
      setError(err.message || '送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }, [visitorId, orderId, channel, barrierReason, comment, onSubmitSuccess]);

  // 送信済み表示
  if (isSubmitted) {
    return (
      <div className="text-center py-8">
        <div className="text-green-500 text-5xl mb-4">✓</div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          ご回答ありがとうございました
        </h3>
        <p className="text-gray-600 text-sm">
          いただいたご意見はサービス改善に活用させていただきます。
        </p>
      </div>
    );
  }

  // ローディング中
  if (visitorLoading) {
    return (
      <div className="py-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h4 className="font-bold text-gray-800 mb-4 text-center">
        ご購入をお見送りになった理由を教えてください
      </h4>

      <p className="text-gray-600 text-sm mb-4 text-center">
        より良いサービスのため、ご協力をお願いいたします。
      </p>

      {/* 阻害理由 */}
      <div className="space-y-2 mb-4">
        {BARRIER_REASONS.map(({ value, label }) => (
          <label
            key={value}
            className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
              barrierReason === value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <input
              type="radio"
              name="barrierReason"
              value={value}
              checked={barrierReason === value}
              onChange={() => setBarrierReason(value)}
              className="sr-only"
            />
            <span className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 flex items-center justify-center ${
              barrierReason === value
                ? 'border-blue-500'
                : 'border-gray-300'
            }`}>
              {barrierReason === value && (
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </span>
            <span className="text-gray-700">{label}</span>
          </label>
        ))}
      </div>

      {/* コメント（任意） */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          詳細（任意）
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="ご意見があればお聞かせください"
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1 text-right">
          {comment.length}/500
        </p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
      )}

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isSubmitting || !barrierReason}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? '送信中...' : '送信する'}
      </button>
    </form>
  );
};

export default BarrierSurvey;
