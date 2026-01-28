/**
 * フィードバックAPI呼び出しユーティリティ
 */

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL;

/**
 * フィードバックを送信
 * @param {Object} feedbackData
 * @returns {Promise<{success: boolean, feedbackId?: string, error?: string}>}
 */
export const submitFeedback = async (feedbackData) => {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/submitFeedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedbackData),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'フィードバックの送信に失敗しました');
  }

  return result;
};

/**
 * フィードバック送信済み状態をチェック
 * @param {Object} params
 * @param {string} params.visitorId
 * @param {string} params.channel
 * @param {string} [params.orderId]
 * @returns {Promise<{hasSubmitted: boolean, submittedAt?: string}>}
 */
export const checkFeedbackStatus = async ({ visitorId, channel, orderId }) => {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/checkFeedbackStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, channel, orderId }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'ステータス確認に失敗しました');
  }

  return result;
};

/**
 * フォローアップメールのオプトアウト
 * @param {string} visitorId
 * @returns {Promise<{success: boolean}>}
 */
export const optOutFollowup = async (visitorId) => {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/processFollowupOptOut`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'オプトアウト処理に失敗しました');
  }

  return result;
};

/**
 * フィードバックチャネル定数
 */
export const FEEDBACK_CHANNELS = {
  ORDER_RECEIVED: 'order_received',
  ORDER_CONFIRM: 'order_confirm',
  PREVIEW_EMAIL: 'preview_email',
  DELIVERY_EMAIL: 'delivery_email',
  FOLLOWUP_EMAIL: 'followup_email',
  INQUIRY_FORM: 'inquiry_form',
};

/**
 * 問い合わせ種別定数
 */
export const INQUIRY_TYPES = {
  GENERAL: 'general',
  REFUND: 'refund',
};

/**
 * チャネル別質問設定
 */
export const CHANNEL_QUESTIONS = {
  order_received: {
    question: '注文の操作はいかがでしたか？',
    options: [
      { value: 'fun', label: '楽しかった' },
      { value: 'easy', label: '簡単だった' },
      { value: 'normal', label: '普通' },
      { value: 'difficult', label: '難しかった' },
    ],
    fieldName: 'orderingExperience',
    showReorderIntent: false,
    showPricePerception: false,
  },
  preview_email: {
    question: '完成までの時間はいかがでしたか？',
    options: [
      { value: 'fast', label: '早かった' },
      { value: 'appropriate', label: 'ちょうど良い' },
      { value: 'slow', label: '遅かった' },
    ],
    fieldName: 'completionTimePerception',
    showReorderIntent: false,
    showPricePerception: false,
  },
  order_confirm: {
    question: 'この曲は誰に贈りますか？',
    options: [
      { value: 'family', label: '家族' },
      { value: 'friend', label: '友人' },
      { value: 'partner', label: 'パートナー' },
      { value: 'colleague', label: '同僚・知人' },
      { value: 'self', label: '自分用' },
      { value: 'other', label: 'その他' },
    ],
    fieldName: 'recipientType',
    showReorderIntent: false,
    showPricePerception: false,
  },
  delivery_email: {
    question: null,
    showReorderIntent: true,
    showPricePerception: true,
  },
  followup_email: {
    question: null,
    showReorderIntent: true,
    showPricePerception: true,
  },
};

/**
 * 不満理由の選択肢
 */
export const DISSATISFACTION_REASONS = [
  { value: 'price', label: '価格が高い' },
  { value: 'delivery', label: '納期が遅い' },
  { value: 'quality', label: '品質に不満' },
  { value: 'unclear', label: '操作がわかりにくい' },
  { value: 'other', label: 'その他' },
];

/**
 * 阻害理由の選択肢（未購入者向け）
 */
export const BARRIER_REASONS = [
  { value: 'price', label: '価格が高い' },
  { value: 'wrong_use', label: '用途と違う' },
  { value: 'unclear', label: '操作がわからない' },
  { value: 'competitor', label: '他サービスを利用' },
  { value: 'not_now', label: '今は不要' },
  { value: 'other', label: 'その他' },
];

/**
 * 再購入意向の選択肢
 */
export const REORDER_INTENTS = [
  { value: 'yes', label: 'はい' },
  { value: 'no', label: 'いいえ' },
  { value: 'undecided', label: '未定' },
];

/**
 * 価格認知の選択肢
 */
export const PRICE_PERCEPTIONS = [
  { value: 'cheap', label: '安い' },
  { value: 'fair', label: '適正' },
  { value: 'expensive', label: '高い' },
];
