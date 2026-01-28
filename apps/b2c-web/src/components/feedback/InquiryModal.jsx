import { useState, useCallback, useEffect } from 'react';
import StarRating from './StarRating';
import { useVisitorId } from '../../hooks/useVisitorId';
import {
  submitFeedback,
  FEEDBACK_CHANNELS,
  DISSATISFACTION_REASONS,
  INQUIRY_TYPES,
} from '../../lib/feedbackApi';
import { markFeedbackSubmitted } from '../../lib/visitorStorage';
import { track } from '../../lib/analytics';
import { getVariant } from '../../lib/ab';

/**
 * 問い合わせモーダルコンポーネント
 * 返金申請オプション + 不満アンケートを含む
 *
 * @param {Object} props
 * @param {string} props.orderId - 注文ID
 * @param {boolean} props.isOpen - モーダル表示状態
 * @param {function} props.onClose - 閉じるコールバック
 * @param {function} [props.onRefundRequested] - 返金申請時のコールバック
 */
const InquiryModal = ({ orderId, isOpen, onClose, onRefundRequested }) => {
  const { visitorId } = useVisitorId();
  const [step, setStep] = useState('initial'); // 'initial' | 'general_form' | 'refund_form' | 'submitted'
  const [rating, setRating] = useState(0);
  const [dissatisfactionReason, setDissatisfactionReason] = useState(null);
  const [comment, setComment] = useState('');
  const [generalInquiry, setGeneralInquiry] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // モーダルが開いた時にトラッキング
  useEffect(() => {
    if (isOpen) {
      track('inquiry_modal_open', { orderId });
    }
  }, [isOpen, orderId]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleRefundClick = useCallback(() => {
    setStep('refund_form');
    track('inquiry_refund_start', { orderId });
  }, [orderId]);

  const handleGeneralInquiryClick = useCallback(() => {
    setStep('general_form');
    track('inquiry_general_start', { orderId });
  }, [orderId]);

  const handleGeneralInquirySubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!generalInquiry.trim()) {
      setError('お問い合わせ内容を入力してください');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const feedbackData = {
        visitorId,
        orderId,
        channel: FEEDBACK_CHANNELS.INQUIRY_FORM,
        rating: null,
        comment: generalInquiry.trim(),
        refundRequested: false,
        inquiryType: INQUIRY_TYPES.GENERAL,
        variant: getVariant(),
      };

      await submitFeedback(feedbackData);

      // ローカルストレージにも記録
      markFeedbackSubmitted(FEEDBACK_CHANNELS.INQUIRY_FORM);

      // 分析イベント
      track('inquiry_submit', {
        orderId,
        type: 'general',
      });

      setStep('submitted');
    } catch (err) {
      console.error('General inquiry submission error:', err);
      setError(err.message || '送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }, [visitorId, orderId, generalInquiry]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!rating) {
      setError('評価を選択してください');
      return;
    }

    if (!dissatisfactionReason) {
      setError('不満の理由を選択してください');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const feedbackData = {
        visitorId,
        orderId,
        channel: FEEDBACK_CHANNELS.INQUIRY_FORM,
        rating,
        comment: comment.trim() || null,
        refundRequested: true,
        inquiryType: INQUIRY_TYPES.REFUND,
        dissatisfactionReason,
        variant: getVariant(),
      };

      await submitFeedback(feedbackData);

      // ローカルストレージにも記録
      markFeedbackSubmitted(FEEDBACK_CHANNELS.INQUIRY_FORM);

      // 分析イベント
      track('inquiry_submit', {
        orderId,
        type: 'refund',
        dissatisfactionReason,
        rating,
      });

      setStep('submitted');
      onRefundRequested?.();
    } catch (err) {
      console.error('Inquiry submission error:', err);
      setError(err.message || '送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }, [visitorId, orderId, rating, dissatisfactionReason, comment, onRefundRequested]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* モーダル本体 */}
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inquiry-modal-title"
      >
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <h2 id="inquiry-modal-title" className="text-lg font-bold text-gray-800">
            お問い合わせ
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="閉じる"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="px-6 py-4">
          {step === 'initial' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                ご不明な点がございましたら、お気軽にお問い合わせください。
              </p>

              <button
                onClick={handleGeneralInquiryClick}
                className="w-full p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-800">一般的なお問い合わせ</div>
                <div className="text-sm text-gray-500 mt-1">
                  サービスや操作方法についてのご質問
                </div>
              </button>

              <button
                onClick={handleRefundClick}
                className="w-full p-4 border border-red-200 rounded-lg text-left hover:bg-red-50 transition-colors"
              >
                <div className="font-medium text-red-700">返金のご相談</div>
                <div className="text-sm text-red-500 mt-1">
                  ご満足いただけなかった場合のご相談
                </div>
              </button>
            </div>
          )}

          {step === 'general_form' && (
            <form onSubmit={handleGeneralInquirySubmit} className="space-y-5">
              <p className="text-gray-600 text-sm">
                お問い合わせ内容をご入力ください。担当者より改めてご連絡いたします。
              </p>

              {/* お問い合わせ内容（必須） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  お問い合わせ内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={generalInquiry}
                  onChange={(e) => setGeneralInquiry(e.target.value)}
                  placeholder="ご質問やご要望をお聞かせください"
                  rows={5}
                  maxLength={1000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {generalInquiry.length}/1000
                </p>
              </div>

              {/* エラーメッセージ */}
              {error && (
                <p className="text-red-600 text-sm text-center">{error}</p>
              )}

              {/* 送信ボタン */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('initial');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  戻る
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !generalInquiry.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? '送信中...' : '送信する'}
                </button>
              </div>
            </form>
          )}

          {step === 'refund_form' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-gray-600 text-sm">
                ご不満をおかけして申し訳ございません。改善のため、以下のアンケートにご協力ください。
              </p>

              {/* 星評価（必須） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  今回のサービスの評価 <span className="text-red-500">*</span>
                </label>
                <div className="flex justify-center">
                  <StarRating
                    value={rating}
                    onChange={setRating}
                    size="lg"
                  />
                </div>
              </div>

              {/* 不満理由（必須） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  不満の理由 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {DISSATISFACTION_REASONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        dissatisfactionReason === value
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-red-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="dissatisfactionReason"
                        value={value}
                        checked={dissatisfactionReason === value}
                        onChange={() => setDissatisfactionReason(value)}
                        className="sr-only"
                      />
                      <span className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 ${
                        dissatisfactionReason === value
                          ? 'border-red-500 bg-red-500'
                          : 'border-gray-300'
                      }`}>
                        {dissatisfactionReason === value && (
                          <span className="block w-2 h-2 bg-white rounded-full m-0.5" />
                        )}
                      </span>
                      <span className="text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* コメント（任意） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  詳細・ご要望（任意）
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="具体的な内容をお聞かせください"
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {comment.length}/500
                </p>
              </div>

              {/* エラーメッセージ */}
              {error && (
                <p className="text-red-600 text-sm text-center">{error}</p>
              )}

              {/* 送信ボタン */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('initial')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  戻る
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? '送信中...' : '送信する'}
                </button>
              </div>
            </form>
          )}

          {step === 'submitted' && (
            <div className="text-center py-8">
              <div className="text-green-500 text-5xl mb-4">✓</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                ご回答ありがとうございました
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                担当者より改めてご連絡いたします。<br />
                しばらくお待ちください。
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors"
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InquiryModal;
