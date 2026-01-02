/**
 * 計測ユーティリティ
 *
 * 現在はconsole.logで出力。
 * 後からGA/Amplitude等に差し替え可能な設計。
 */

import { getVariant } from './ab';

/**
 * イベントを送信
 * @param {string} eventName - イベント名
 * @param {Object} props - 追加のプロパティ（PIIは送らないこと）
 */
export function track(eventName, props = {}) {
  try {
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      variant: getVariant(),
      ...props,
    };

    // 開発時はconsole.logで出力
    console.log('[track]', eventName, payload);

    // TODO: 本番ではGA/Amplitude等に送信
    // gtag('event', eventName, payload);
    // amplitude.track(eventName, payload);

  } catch {
    // アプリを壊さないよう例外は握りつぶす
  }
}

/**
 * TODO: purchase_success イベント
 * 購入成功時に呼び出す
 * 現時点では発火ポイントが不明なため、スタブとして定義
 *
 * 使用例:
 * trackPurchaseSuccess({ orderId: '...', amount: 1000 })
 */
export function trackPurchaseSuccess(props = {}) {
  track('purchase_success', props);
}
