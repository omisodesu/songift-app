/**
 * 訪問者ID管理ユーティリティ
 * localStorage + cookie を使用してブラウザ間で一意のIDを保持
 */

const VISITOR_ID_KEY = 'songift_visitor_id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1年

/**
 * UUID v4を生成
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Cookieを設定
 */
const setCookie = (name, value, maxAge = COOKIE_MAX_AGE) => {
  document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
};

/**
 * Cookieを取得
 */
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
};

/**
 * 訪問者IDを取得（なければ生成して保存）
 */
export const getOrCreateVisitorId = () => {
  // まずlocalStorageをチェック
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);

  // localStorageになければcookieをチェック
  if (!visitorId) {
    visitorId = getCookie(VISITOR_ID_KEY);
  }

  // どちらにもなければ新規生成
  if (!visitorId) {
    visitorId = generateUUID();
  }

  // 両方に保存（同期）
  localStorage.setItem(VISITOR_ID_KEY, visitorId);
  setCookie(VISITOR_ID_KEY, visitorId);

  return visitorId;
};

/**
 * 訪問者IDを取得（存在しなければnull）
 */
export const getVisitorId = () => {
  return localStorage.getItem(VISITOR_ID_KEY) || getCookie(VISITOR_ID_KEY) || null;
};

/**
 * 訪問者IDを設定（外部から指定する場合）
 */
export const setVisitorId = (visitorId) => {
  localStorage.setItem(VISITOR_ID_KEY, visitorId);
  setCookie(VISITOR_ID_KEY, visitorId);
};

/**
 * フィードバック送信済みフラグのキーを生成
 * format: feedback_submitted_{channel}_{date}
 */
const getFeedbackKey = (channel, date = new Date().toISOString().split('T')[0]) => {
  return `feedback_submitted_${channel}_${date}`;
};

/**
 * フィードバック送信済みかどうかをローカルでチェック
 */
export const hasSubmittedFeedbackLocally = (channel) => {
  const key = getFeedbackKey(channel);
  return localStorage.getItem(key) === 'true';
};

/**
 * フィードバック送信済みフラグを設定
 */
export const markFeedbackSubmitted = (channel) => {
  const key = getFeedbackKey(channel);
  localStorage.setItem(key, 'true');
};

/**
 * フォローアップメールオプトアウトフラグ
 */
const OPTOUT_KEY = 'songift_followup_optout';

export const hasOptedOutFollowup = () => {
  return localStorage.getItem(OPTOUT_KEY) === 'true';
};

export const setFollowupOptOut = (optOut = true) => {
  localStorage.setItem(OPTOUT_KEY, optOut ? 'true' : 'false');
};
