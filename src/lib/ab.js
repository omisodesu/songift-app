/**
 * A/Bテスト variant管理ユーティリティ
 */

const STORAGE_KEY = 'lp_variant';

/**
 * 現在のvariantを取得
 * @returns {"A" | "B" | null}
 */
export function getVariant() {
  try {
    const variant = localStorage.getItem(STORAGE_KEY);
    if (variant === 'A' || variant === 'B') {
      return variant;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * variantを設定
 * @param {"A" | "B"} variant
 */
export function setVariant(variant) {
  try {
    if (variant === 'A' || variant === 'B') {
      localStorage.setItem(STORAGE_KEY, variant);
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * variantを取得、なければランダムで生成して保存
 * @returns {"A" | "B"}
 */
export function getOrCreateVariant() {
  const existing = getVariant();
  if (existing) {
    return existing;
  }
  const newVariant = Math.random() < 0.5 ? 'A' : 'B';
  setVariant(newVariant);
  return newVariant;
}
