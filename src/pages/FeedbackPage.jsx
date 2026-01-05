import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FeedbackForm from '../components/feedback/FeedbackForm';
import BarrierSurvey from '../components/feedback/BarrierSurvey';
import { useFeedbackExposure } from '../hooks/useFeedbackExposure';
import { FEEDBACK_CHANNELS } from '../lib/feedbackApi';
import { setVisitorId } from '../lib/visitorStorage';
import { track } from '../lib/analytics';

/**
 * フィードバックスタンドアロンページ
 * メールリンクからアクセスされる
 *
 * URL params:
 * - ch: channel (preview_email, delivery_email, followup_email)
 * - oid: orderId
 * - vid: visitorId (メールから引き継ぎ)
 * - type: survey type (feedback, barrier)
 */
const FeedbackPage = () => {
  const [searchParams] = useSearchParams();
  const channel = searchParams.get('ch') || FEEDBACK_CHANNELS.PREVIEW_EMAIL;
  const orderId = searchParams.get('oid');
  const visitorIdParam = searchParams.get('vid');
  const surveyType = searchParams.get('type') || 'feedback';

  const [isReady, setIsReady] = useState(false);

  // URLパラメータからvisitorIdを復元
  useEffect(() => {
    if (visitorIdParam) {
      setVisitorId(visitorIdParam);
    }
    setIsReady(true);
  }, [visitorIdParam]);

  // フィードバック表示制御
  const { shouldShow, isChecking } = useFeedbackExposure(channel, orderId);

  // ページ表示トラッキング
  useEffect(() => {
    if (isReady) {
      track('feedback_page_view', { channel, orderId, surveyType });
    }
  }, [isReady, channel, orderId, surveyType]);

  // チャネル名の日本語表示
  const getChannelDisplayName = () => {
    switch (channel) {
      case FEEDBACK_CHANNELS.ORDER_RECEIVED:
        return '注文受付';
      case FEEDBACK_CHANNELS.ORDER_CONFIRM:
        return '注文確認';
      case FEEDBACK_CHANNELS.PREVIEW_EMAIL:
        return 'プレビューメール';
      case FEEDBACK_CHANNELS.DELIVERY_EMAIL:
        return '納品メール';
      case FEEDBACK_CHANNELS.FOLLOWUP_EMAIL:
        return 'フォローアップ';
      default:
        return 'サービス';
    }
  };

  // ローディング中
  if (!isReady || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 既に回答済みの場合
  if (!shouldShow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow text-center">
          <div className="text-green-500 text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            ご回答ありがとうございます
          </h2>
          <p className="text-gray-600 mb-6">
            既にフィードバックをいただいております。<br />
            ご協力ありがとうございました。
          </p>
          <Link
            to="/"
            className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            トップページへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-md mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            ご意見をお聞かせください
          </h1>
          <p className="text-gray-600 text-sm">
            {getChannelDisplayName()}についてのフィードバック
          </p>
        </div>

        {/* フィードバックフォーム or 阻害理由アンケート */}
        <div className="bg-white rounded-xl shadow p-6">
          {surveyType === 'barrier' ? (
            <BarrierSurvey
              channel={channel}
              orderId={orderId}
              onSubmitSuccess={() => {
                // 送信成功時の追加処理があれば
              }}
            />
          ) : (
            <FeedbackForm
              channel={channel}
              orderId={orderId}
              variant="full"
              initiallyExpanded={true}
            />
          )}
        </div>

        {/* フッター */}
        <div className="text-center mt-8">
          <Link
            to="/"
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
