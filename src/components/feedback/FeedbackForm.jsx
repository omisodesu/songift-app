import { useState, useCallback } from 'react';
import StarRating from './StarRating';
import { useVisitorId } from '../../hooks/useVisitorId';
import {
  submitFeedback,
  FEEDBACK_CHANNELS,
  REORDER_INTENTS,
  PRICE_PERCEPTIONS,
} from '../../lib/feedbackApi';
import { markFeedbackSubmitted } from '../../lib/visitorStorage';
import { track } from '../../lib/analytics';
import { getVariant } from '../../lib/ab';

/**
 * フィードバックフォームコンポーネント
 * @param {Object} props
 * @param {string} props.channel - フィードバックチャネル
 * @param {string} [props.orderId] - 注文ID（オプション）
 * @param {function} [props.onSubmitSuccess] - 送信成功時のコールバック
 * @param {'minimal' | 'full'} [props.variant] - フォームバリアント
 * @param {boolean} [props.initiallyExpanded] - 初期展開状態
 */
const FeedbackForm = ({
  channel = FEEDBACK_CHANNELS.ORDER_CONFIRM,
  orderId,
  onSubmitSuccess,
  variant = 'full',
  initiallyExpanded = false,
}) => {
  const { visitorId, isLoading: visitorLoading } = useVisitorId();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reorderIntent, setReorderIntent] = useState(null);
  const [pricePerception, setPricePerception] = useState(null);
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleRatingChange = useCallback((newRating) => {
    setRating(newRating);
    if (!isExpanded) {
      setIsExpanded(true);
      track('feedback_start', { channel, orderId, rating: newRating });
    }
  }, [isExpanded, channel, orderId]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!rating) {
      setError('評価を選択してください');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const feedbackData = {
        visitorId,
        orderId,
        channel,
        rating,
        comment: comment.trim() || null,
        reorderIntent,
        pricePerception,
        variant: getVariant(),
      };

      await submitFeedback(feedbackData);

      // ローカルストレージにも記録
      markFeedbackSubmitted(channel);

      // 分析イベント
      track('feedback_submit', {
        channel,
        orderId,
        rating,
        hasComment: !!comment.trim(),
        reorderIntent,
        pricePerception,
      });

      setIsSubmitted(true);
      onSubmitSuccess?.();
    } catch (err) {
      console.error('Feedback submission error:', err);
      setError(err.message || 'フィードバックの送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }, [visitorId, orderId, channel, rating, comment, reorderIntent, pricePerception, onSubmitSuccess]);

  // 送信済み表示
  if (isSubmitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="text-green-600 text-2xl mb-2">✓</div>
        <p className="text-green-800 font-medium">
          フィードバックありがとうございました
        </p>
      </div>
    );
  }

  // ローディング中
  if (visitorLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="font-bold text-blue-800 mb-3 text-center">
        ご感想をお聞かせください
      </h4>

      <form onSubmit={handleSubmit}>
        {/* 星評価 */}
        <div className="flex justify-center mb-4">
          <StarRating
            value={rating}
            onChange={handleRatingChange}
            size="lg"
          />
        </div>

        {/* 展開部分 */}
        {isExpanded && variant === 'full' && (
          <div className="space-y-4 mt-4">
            {/* 再購入意向 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                また利用したいですか？
              </label>
              <div className="flex gap-2 flex-wrap">
                {REORDER_INTENTS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReorderIntent(value)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      reorderIntent === value
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 価格認知 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                価格についてどう思いましたか？
              </label>
              <div className="flex gap-2 flex-wrap">
                {PRICE_PERCEPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPricePerception(value)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      pricePerception === value
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* コメント */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ご意見・ご感想（任意）
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="ご自由にお書きください"
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {comment.length}/500
              </p>
            </div>
          </div>
        )}

        {/* エラーメッセージ */}
        {error && (
          <p className="text-red-600 text-sm mt-3 text-center">{error}</p>
        )}

        {/* 送信ボタン */}
        {(isExpanded || rating > 0) && (
          <button
            type="submit"
            disabled={isSubmitting || !rating}
            className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '送信中...' : '送信する'}
          </button>
        )}
      </form>
    </div>
  );
};

export default FeedbackForm;
