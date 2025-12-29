# Video Generator Service

Cloud Run サービス for Birthday Song App Phase1

## 概要

このサービスは、音声ファイルから以下を生成します：
- プレビュー音声（15秒MP3）
- フル動画（縦型1080x1920 MP4、静止画背景 + 音声）

## セットアップ

### 1. 背景画像の準備

`assets/default_background.png` として、1080x1920px の縦型画像を配置してください。

**仕様:**
- 解像度: 1080 × 1920 px（縦型）
- フォーマット: PNG（推奨）または JPG
- 用途: フル動画の背景として使用
- 推奨: 誕生日テーマの背景画像（ケーキ、風船、パーティーなど）

**配置場所:**
```
cloud-run/video-generator/assets/default_background.png
```

### 2. ローカルテスト

```bash
cd cloud-run/video-generator

# 依存関係インストール
npm install

# 環境変数設定
export STORAGE_BUCKET=birthday-song-app-stg.firebasestorage.app
export PORT=8080

# サーバー起動
npm start
```

### 3. Cloud Run デプロイ（STG）

```bash
cd cloud-run/video-generator

gcloud run deploy video-generator \
  --source . \
  --region us-central1 \
  --project birthday-song-app-stg \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600s \
  --no-allow-unauthenticated \
  --set-env-vars PROJECT_ID=birthday-song-app-stg,STORAGE_BUCKET=birthday-song-app-stg.firebasestorage.app

# Invoker 権限付与
gcloud run services add-iam-policy-binding video-generator \
  --region=us-central1 \
  --member="serviceAccount:birthday-song-app-stg@appspot.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=birthday-song-app-stg
```

## API エンドポイント

### 1. ヘルスチェック

```bash
GET /health
```

レスポンス:
```json
{
  "status": "ok",
  "service": "video-generator"
}
```

### 2. プレビュー音声生成

```bash
POST /generate-preview-audio
Content-Type: application/json

{
  "sourceAudioPath": "audios/order123/source.mp3",
  "outputPath": "audios/order123/preview.mp3"
}
```

レスポンス:
```json
{
  "success": true,
  "outputPath": "audios/order123/preview.mp3",
  "durationSeconds": 15
}
```

### 3. フル動画生成

```bash
POST /generate-full-video
Content-Type: application/json

{
  "sourceAudioPath": "audios/order123/source.mp3",
  "outputPath": "videos/order123/full.mp4",
  "backgroundImagePath": "default"
}
```

レスポンス:
```json
{
  "success": true,
  "outputPath": "videos/order123/full.mp4",
  "durationSeconds": 180
}
```

## 認証

Cloud Run は `--no-allow-unauthenticated` で認証必須に設定されています。
Functions から呼び出す際は、ID トークンを Authorization ヘッダーに含める必要があります。

## トラブルシューティング

### 背景画像が見つからない

```
Error: Background image not found: /app/assets/default_background.png
```

→ `assets/default_background.png` を配置してください。

### ffmpeg エラー

```
Error: Failed to generate full video: ...
```

→ Cloud Run のログを確認してください:
```bash
gcloud run logs read video-generator --region us-central1 --project birthday-song-app-stg
```

## ディレクトリ構造

```
cloud-run/video-generator/
├── Dockerfile
├── package.json
├── index.js
├── README.md
├── services/
│   ├── storageService.js
│   ├── audioService.js
│   └── videoService.js
└── assets/
    └── default_background.png (要準備)
```
