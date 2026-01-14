/**
 * 背景テンプレート定義
 * STG Storage: video-templates/t1.mp4, t2.mp4, t3.mp4
 */

export const BACKGROUND_TEMPLATES = [
  {
    id: 't1',
    name: 'ポップ',
    desc: '明るい・ポップ',
    previewClass: 'bg-gradient-to-r from-pink-400 to-rose-400',
  },
  {
    id: 't2',
    name: '穏やか',
    desc: '温かい',
    previewClass: 'bg-gradient-to-r from-amber-300 to-orange-500',
  },
  {
    id: 't3',
    name: 'シック',
    desc: '落ち着き・大人',
    previewClass: 'bg-gradient-to-r from-slate-600 to-zinc-800',
  },
];

/**
 * IDからテンプレートを取得
 * @param {string} id - テンプレートID
 * @returns {object} テンプレート（見つからなければt1）
 */
export function getBackgroundTemplate(id) {
  const template = BACKGROUND_TEMPLATES.find((t) => t.id === id);
  return template || BACKGROUND_TEMPLATES[0]; // デフォルトはt1
}
