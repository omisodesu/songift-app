/**
 * 計測ユーティリティ（GA4対応）
 *
 * - GA4 (gtag) にイベント送信
 * - VITE_GA4_MEASUREMENT_ID が未設定なら送信しない
 * - debug_mode: localhost または ?debug=1 で有効化
 * - PII（email, name, token等）は送信禁止
 */

import { getVariant } from './ab';

// GA4 Measurement ID
const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID || '';

// gtag初期化フラグ
let gtagInitialized = false;

/**
 * debug_mode判定
 * - localhost の場合
 * - URLに ?debug=1 がある場合
 */
function isDebugMode() {
  if (typeof window === 'undefined') return false;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const hasDebugParam = new URLSearchParams(window.location.search).get('debug') === '1';
  return isLocalhost || hasDebugParam;
}

/**
 * gtag.js を動的に読み込み・初期化
 */
function initGtag() {
  if (gtagInitialized || !GA4_MEASUREMENT_ID) return;

  try {
    // gtag.js スクリプトを読み込み
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // dataLayer と gtag関数を初期化
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());

    // debug_mode が有効な場合は DebugView 用の設定
    const configParams = {};
    if (isDebugMode()) {
      configParams.debug_mode = true;
    }
    window.gtag('config', GA4_MEASUREMENT_ID, configParams);

    gtagInitialized = true;
  } catch {
    // 初期化失敗しても握りつぶす
  }
}

// モジュール読み込み時にgtag初期化
if (typeof window !== 'undefined') {
  initGtag();
}

/**
 * PIIフィールドをフィルタリング
 * @param {Object} props
 * @returns {Object} PIIを除いたprops
 */
function filterPII(props) {
  const piiFields = ['email', 'name', 'token', 'password', 'phone', 'address', 'fullUrl'];
  const filtered = { ...props };
  for (const field of piiFields) {
    delete filtered[field];
  }
  return filtered;
}

/**
 * イベントを送信
 * @param {string} eventName - イベント名
 * @param {Object} props - 追加のプロパティ（PIIは送らないこと）
 */
export function track(eventName, props = {}) {
  try {
    // PIIをフィルタリング
    const safeProps = filterPII(props);

    // order_created の場合、orderId も除外（識別性が高いため）
    if (eventName === 'order_created') {
      delete safeProps.orderId;
      safeProps.success = true; // 代わりにbooleanで成功を示す
    }

    // 共通メタデータを付与
    const payload = {
      variant: getVariant(),
      page: typeof window !== 'undefined' ? window.location.pathname : '',
      ts: Date.now(),
      ...safeProps,
    };

    // debug_mode を付与（GA4 DebugView用）
    if (isDebugMode()) {
      payload.debug_mode = true;
    }

    // 開発時はconsole.logで出力
    console.log('[track]', eventName, payload);

    // GA4に送信（measurement IDがある場合のみ）
    if (GA4_MEASUREMENT_ID && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, payload);
    }

  } catch {
    // アプリを壊さないよう例外は握りつぶす
  }
}

/**
 * purchase_success イベント
 * 購入成功時に呼び出す
 *
 * 使用例:
 * trackPurchaseSuccess({ amount: 500 })
 */
export function trackPurchaseSuccess(props = {}) {
  track('purchase_success', props);
}
