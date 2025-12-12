# Songift セットアップガイド

## 実装完了した機能

### ✅ 1. Slack通知機能
- 注文時に自動でSlackに通知
- 簡単モード/プロモードの内容を含む詳細な通知

### ✅ 2. 歌詞・スタイル編集機能
- 管理画面で歌詞とスタイルを編集可能
- テキストエリアを拡大（歌詞: h-40、スタイル: h-24）
- 編集/保存/キャンセルボタン実装

### ✅ 3. 楽曲生成やり直し機能
- 何度でもSuno APIで楽曲を再生成可能
- 「Sunoで再生成 🔄」ボタン表示
- 最新の2曲のみ保持（過去履歴は上書き）

### ✅ 4. MP3添付メール送信機能
- Firebase Functions + SendGrid実装
- 自動でMP3をダウンロードしてメールに添付
- 完全自動化（メーラー起動不要）

---

## セットアップ手順

### 1. 環境変数の設定

`.env` ファイルを作成して以下を設定：

\`\`\`bash
cp .env.example .env
\`\`\`

`.env` ファイルを編集：

\`\`\`env
VITE_FIREBASE_API_KEY=あなたのFirebase APIキー
VITE_GEMINI_API_KEY=あなたのGemini APIキー
VITE_SUNO_API_KEY=あなたのSuno APIキー
VITE_SLACK_WEBHOOK_URL=あなたのSlack Webhook URL
VITE_ADMIN_EMAIL=管理者のメールアドレス
\`\`\`

### 2. Slack Webhook URLの取得

1. [Slack API](https://api.slack.com/apps) にアクセス
2. 「Create New App」→「From scratch」
3. App名とWorkspaceを選択
4. 「Incoming Webhooks」を有効化
5. 「Add New Webhook to Workspace」をクリック
6. 通知先チャンネルを選択
7. 生成されたWebhook URLをコピーして `.env` に追加

### 3. Firebase Functionsのセットアップ

#### 3.1 Firebase CLI認証

\`\`\`bash
firebase login --reauth
\`\`\`

#### 3.2 Firebase Billing有効化

Cloud Functionsを使用するには、Firebaseプロジェクトを **Blazeプラン（従量課金）** にアップグレードする必要があります。

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左下の歯車アイコン → 「使用量と請求」
4. 「プランを変更」→「Blazeプラン」を選択

#### 3.3 SendGrid APIキーの取得

1. [SendGrid](https://sendgrid.com/) にサインアップ/ログイン
2. 「Settings」→「API Keys」
3. 「Create API Key」
4. 権限: **Full Access** または **Mail Send** のみ
5. 生成されたAPIキーをコピー（後で使用）

#### 3.4 Functions依存関係のインストール

\`\`\`bash
cd functions
npm install
cd ..
\`\`\`

#### 3.5 SendGrid APIキーをシークレットに設定

\`\`\`bash
firebase functions:secrets:set SENDGRID_API_KEY
\`\`\`

プロンプトが表示されたら、SendGrid APIキーをペースト。

#### 3.6 Firebase Functionsのデプロイ

\`\`\`bash
firebase deploy --only functions
\`\`\`

デプロイ完了後、Function URLが表示されます：
\`\`\`
✔  functions[sendBirthdaySongEmail(us-central1)] Successful create operation.
Function URL (sendBirthdaySongEmail(us-central1)): https://us-central1-birthday-song-app.cloudfunctions.net/sendBirthdaySongEmail
\`\`\`

#### 3.7 送信元メールアドレスの認証（SendGrid）

SendGridで送信元メールアドレスを認証する必要があります：

1. SendGridダッシュボード → 「Settings」→「Sender Authentication」
2. 「Verify a Single Sender」または「Authenticate Your Domain」
3. 指示に従ってメールアドレスまたはドメインを認証

**重要**: `functions/index.js` の43行目付近にある `from` メールアドレスを認証済みのものに変更：

\`\`\`javascript
from: {
  email: "あなたの認証済みメールアドレス@example.com",  // ← ここを変更
  name: "Songift",
},
\`\`\`

変更後、**必ずFunctionsを再デプロイ**：
\`\`\`bash
firebase deploy --only functions
\`\`\`

### 4. フロントエンドのビルド＆デプロイ

\`\`\`bash
npm run build
firebase deploy --only hosting
\`\`\`

または、Functions + Hosting を一度にデプロイする場合：
\`\`\`bash
npm run build
firebase deploy
\`\`\`

---

## 使用方法

### ユーザー側（注文）

1. https://birthday-song-app.web.app/ にアクセス
2. Googleアカウントでログイン
3. 簡単モードまたはプロモードを選択
4. フォームに入力して「この内容で注文する」
5. → **Slackに通知が送信されます** 🎉

### 管理者側（納品作業）

1. 管理者ダッシュボードにアクセス
2. 未対応の注文を確認

#### ステップ1: プロンプト生成
- 「Gemini生成 ✨」ボタンをクリック
- 歌詞とスタイルが自動生成される
- **必要に応じて「編集」ボタンで修正可能**

#### ステップ2: 楽曲生成
- 「Sunoで生成開始 🎵」ボタンをクリック
- 生成中は自動でポーリング（10秒ごと）
- 完成すると2曲の候補が表示される
- **納得いかない場合は「Sunoで再生成 🔄」で何度でもやり直し可能**

#### ステップ3: 楽曲選定
- 2曲を試聴
- ベストな1曲の「この曲を採用 👍」ボタンをクリック

#### ステップ4: メール作成
- 「文面作成 📝」ボタンをクリック
- Geminiが感動的なメール文面を自動生成
- 必要に応じて編集可能

#### ステップ5: 納品
- 「MP3添付で送信 🚀」ボタンをクリック
- Cloud Functions経由でMP3添付メールが自動送信 ✅
- 完了後、ステータスが「納品完了」に更新

---

## トラブルシューティング

### Slack通知が届かない

- `.env` の `VITE_SLACK_WEBHOOK_URL` が正しいか確認
- Slack Appの設定でWebhookが有効になっているか確認
- ブラウザのコンソールでエラーを確認

### 編集ボタンが機能しない

- ブラウザをリフレッシュ
- 一度ログアウトして再ログイン

### 楽曲が生成されない

- Suno APIキーが有効か確認
- Suno APIのクレジット残高を確認
- ブラウザコンソールでエラーメッセージを確認

### メール送信が失敗する

1. **Functions がデプロイされているか確認**
   \`\`\`bash
   firebase functions:list
   \`\`\`

2. **SendGrid APIキーが設定されているか確認**
   \`\`\`bash
   firebase functions:secrets:access SENDGRID_API_KEY
   \`\`\`

3. **SendGridで送信元メールアドレスが認証されているか確認**

4. **Functionsのログを確認**
   \`\`\`bash
   firebase functions:log
   \`\`\`

5. **CORS エラーの場合**
   - Function URLが `https://us-central1-birthday-song-app.cloudfunctions.net/sendBirthdaySongEmail` で正しいか確認
   - Firebase Consoleで Functions が正常にデプロイされているか確認

---

## コスト試算

### Firebase Functions（Blazeプラン）

- **無料枠**: 月200万回の呼び出し、40万GB秒のコンピューティング
- **追加料金**: 100万回あたり$0.40
- **予想コスト**: 月100件の注文 → ほぼ無料枠内

### SendGrid

- **無料プラン**: 月100通まで無料
- **Essentialsプラン**: 月$19.95〜（50,000通/月）
- **予想コスト**: 月100件の注文 → 無料枠内

### Suno API

- プランによる（別途契約）

---

## 今後の拡張案

- [ ] Stripe決済の実装
- [ ] 注文履歴ページ（ユーザー側）
- [ ] 楽曲の試聴プレビュー（納品前にユーザーに確認）
- [ ] 管理画面のフィルター機能（未対応/完了済みなど）
- [ ] 自動テスト実装

---

## サポート

問題が発生した場合は、以下を確認してください：

1. ブラウザのコンソールログ
2. Firebase Functionsのログ（\`firebase functions:log\`）
3. Firestore のデータ構造
4. 環境変数が正しく設定されているか
