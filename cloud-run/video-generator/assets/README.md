# Background Image for Video Generation

## 必要な背景画像

このディレクトリに `default_background.png` を配置してください。

### 仕様

- **ファイル名:** `default_background.png`
- **解像度:** 1080 × 1920 px（縦型）
- **フォーマット:** PNG（推奨）または JPG
- **用途:** フル動画の背景として使用

### 推奨デザイン

- 誕生日テーマ（ケーキ、風船、パーティーなど）
- 明るく華やかな色使い
- テキストが読みやすい背景（中央部分は控えめなデザイン推奨）

### 準備方法

1. 生成AI（Midjourney, DALL-E, Stable Diffusion等）で作成
2. フリー素材サイトから取得（商用利用可能なもの）
3. デザイナーに依頼

### プロンプト例（AI生成の場合）

```
A vertical birthday celebration background, 1080x1920 pixels,
featuring colorful balloons, confetti, and a festive atmosphere,
soft gradient background, minimalist design, space for text in the center,
bright and cheerful colors, high quality, suitable for video background
```

### 配置後の確認

配置後、以下のパスに画像が存在することを確認してください：

```
cloud-run/video-generator/assets/default_background.png
```

### ⚠️ 重要

この画像がないと、Cloud Run サービスの `/generate-full-video` エンドポイントがエラーになります。
デプロイ前に必ず準備してください。
