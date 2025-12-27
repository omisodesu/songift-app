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

#### 1.1 Firebase設定の取得

**PROD環境の設定取得:**
1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. **birthday-song-app** プロジェクトを選択
3. プロジェクト設定（歯車アイコン）→「全般」タブ
4. 「マイアプリ」セクションで、ウェブアプリを選択
5. 「SDK の設定と構成」で「構成」を選択
6. 表示される `firebaseConfig` の値をコピー

**STG環境の設定取得:**
1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. **birthday-song-app-stg** プロジェクトを選択
3. 同様に設定値を取得

#### 1.2 .env ファイルの作成

`.env` ファイルを作成して以下を設定：

\`\`\`bash
cp .env.example .env
\`\`\`

`.env` ファイルを編集：

\`\`\`env
# Firebase Configuration (PROD)
VITE_FIREBASE_API_KEY=あなたのFirebase APIキー
VITE_FIREBASE_AUTH_DOMAIN=birthday-song-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=birthday-song-app
VITE_FIREBASE_STORAGE_BUCKET=birthday-song-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=あなたのMessaging Sender ID
VITE_FIREBASE_APP_ID=あなたのApp ID

# API Keys
VITE_GEMINI_API_KEY=あなたのGemini APIキー
VITE_SUNO_API_KEY=あなたのSuno APIキー
VITE_SLACK_WEBHOOK_URL=あなたのSlack Webhook URL

# Admin Settings
VITE_ADMIN_EMAIL=管理者のメールアドレス
VITE_ENABLE_ADMIN_CHECK=false

# Cloud Functions Base URL
VITE_FUNCTIONS_BASE_URL=https://us-central1-birthday-song-app.cloudfunctions.net
\`\`\`

**STG環境の場合は `.env.stg` も作成:**

\`\`\`env
# Firebase Configuration (STG)
VITE_FIREBASE_API_KEY=あなたのSTG Firebase APIキー
VITE_FIREBASE_AUTH_DOMAIN=birthday-song-app-stg.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=birthday-song-app-stg
VITE_FIREBASE_STORAGE_BUCKET=birthday-song-app-stg.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=あなたのSTG Messaging Sender ID
VITE_FIREBASE_APP_ID=あなたのSTG App ID

# 他の設定は .env と同じ
VITE_FUNCTIONS_BASE_URL=https://us-central1-birthday-song-app-stg.cloudfunctions.net
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

**⚠️ 重要**: STGとPRODの混同を防ぐため、以下のコマンドをそのままコピペして実行してください。

---

#### 4.1 STG環境へのデプロイ（テスト環境）

**STG環境では以下が適用されます:**
- Functions URL: \`https://us-central1-birthday-song-app-stg.cloudfunctions.net\`
- メール送信先: \`STG_EMAIL_OVERRIDE_TO\` で設定されたテストアドレスに強制変更
- メール件名: \`[STG]\` プレフィックスが付与
- Slack通知: 完全スキップ

**デプロイコマンド（すべて自動化）:**

\`\`\`bash
# STG環境にビルド＆デプロイ（一発コマンド）
npm run deploy:stg
\`\`\`

**または手動で実行する場合:**

\`\`\`bash
# 1. STG向けビルド（.env.stg を使用）
npm run build:stg

# 2. STGプロジェクトに切り替えてデプロイ
firebase use stg && firebase deploy --only hosting:birthday-song-app-stg
\`\`\`

**確認方法:**

⚠️ **重要**: デプロイ後は必ずブラウザのキャッシュをクリアしてください！

1. https://birthday-song-app-stg.web.app/ にアクセス
2. **ハードリフレッシュ**を実行:
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`
3. ブラウザの開発者ツール（F12）を開く
4. **Consoleタブ**で以下のログを確認:
   ```
   [Firebase] Initializing with projectId: birthday-song-app-stg
   ✅ 環境チェックOK: STG環境として正しく動作しています
   ```
5. **Networkタブ**を開き、ページをリロード
6. `identitytoolkit` へのリクエストを探し、Request URL の `key=` パラメータを確認:
   - ✅ 正しい: `key=AIzaSyDCg1...` (STG用APIキー)
   - ❌ 間違い: `key=AIzaSyBQ0E...` (PROD用APIキー) → キャッシュクリアが必要
7. `/admin/login` でGoogleログインが成功することを確認

---

#### 4.2 PROD環境へのデプロイ（本番環境）

**PROD環境では以下が適用されます:**
- Functions URL: \`https://us-central1-birthday-song-app.cloudfunctions.net\`
- メール送信先: ユーザーが入力した実際のメールアドレス
- Slack通知: 有効（本番用Slackチャンネルに通知）

**デプロイコマンド（すべて自動化）:**

\`\`\`bash
# PROD環境にビルド＆デプロイ（一発コマンド）
npm run deploy:prod
\`\`\`

**または手動で実行する場合:**

\`\`\`bash
# 1. PROD向けビルド（.env.production を使用）
npm run build:prod

# 2. PRODプロジェクトに切り替えてデプロイ
firebase use prod && firebase deploy --only hosting:birthday-song-app
\`\`\`

**確認方法:**

⚠️ **重要**: デプロイ後は必ずブラウザのキャッシュをクリアしてください！

1. https://birthday-song-app.web.app/ にアクセス
2. **ハードリフレッシュ**を実行:
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`
3. ブラウザの開発者ツール（F12）を開く
4. **Consoleタブ**で以下のログを確認:
   ```
   [Firebase] Initializing with projectId: birthday-song-app
   ✅ 環境チェックOK: PROD環境として正しく動作しています
   ```
5. **Networkタブ**を開き、ページをリロード
6. `identitytoolkit` へのリクエストを探し、Request URL の `key=` パラメータを確認:
   - ✅ 正しい: `key=AIzaSyBQ0E...` (PROD用APIキー)
   - ❌ 間違い: `key=AIzaSyDCg1...` (STG用APIキー) → キャッシュクリアが必要
7. 本番用Slackチャンネルに通知が届くことを確認

---

#### 4.3 デプロイ前のチェックリスト

**🔒 重要: STG/PROD混在防止機能**

アプリには起動時のチェック機能が組み込まれています：
- STGドメインで開いたときに、PROD用のAPIキーが使われていたらエラーを表示して停止
- PRODドメインで開いたときに、STG用のAPIキーが使われていたらエラーを表示して停止

このチェック機能により、誤った環境でビルドされたコードがデプロイされても、ユーザーに影響が出る前に検知できます。

**STG環境にデプロイする前:**
- [ ] \`npm run deploy:stg\` コマンドを使用（自動的に build:stg と firebase use stg を実行）
- [ ] \`.env.stg\` の \`VITE_FIREBASE_API_KEY\` が **AIzaSyDCg1** で始まることを確認
- [ ] \`.env.stg\` に以下が設定されていることを確認:
  - \`VITE_FUNCTIONS_BASE_URL=https://us-central1-birthday-song-app-stg.cloudfunctions.net\`
  - \`VITE_FIREBASE_PROJECT_ID=birthday-song-app-stg\`
  - \`VITE_FIREBASE_AUTH_DOMAIN=birthday-song-app-stg.firebaseapp.com\`
  - その他のFirebase設定（messagingSenderId, appId）
- [ ] Firebase Console で STGプロジェクトの Authentication > Sign-in method > Google が有効化されていることを確認
- [ ] Firebase Console で STGプロジェクトの Authentication > 設定 > 承認済みドメイン に \`birthday-song-app-stg.web.app\` が追加されていることを確認

**PROD環境にデプロイする前:**
- [ ] \`npm run deploy:prod\` コマンドを使用（自動的に build:prod と firebase use prod を実行）
- [ ] \`.env.production\` の \`VITE_FIREBASE_API_KEY\` が **AIzaSyBQ0E** で始まることを確認
- [ ] \`.env.production\` に \`VITE_FUNCTIONS_BASE_URL=https://us-central1-birthday-song-app.cloudfunctions.net\` が設定されていることを確認
- [ ] 本番デプロイ前に必ずSTG環境でテスト済みであることを確認

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

### Googleログインが失敗する（STG環境）

**症状**: STG環境で管理画面にログインしようとするとエラーが表示される

**原因と対処**:

1. **STG/PROD環境が混在している（最も多い原因）**
   - ページを開いた直後にアラートが表示される場合:
     ```
     ❌ 環境エラー: STGドメインですがPROD用のAPIキーが使われています！
     ```
   - これは `.env.stg` に誤ったAPIキーが設定されているか、PRODのビルドがSTGにデプロイされたことを意味します
   - **対処**:
     1. `.env.stg` の `VITE_FIREBASE_API_KEY` を確認（AIzaSyDCg1 で始まる必要があります）
     2. Firebase Console > birthday-song-app-stg > プロジェクトの設定 > マイアプリ から正しいAPIキーを取得
     3. `npm run deploy:stg` で再ビルド＆再デプロイ

2. **Firebase設定が間違っている**
   - ブラウザのコンソールを開く（F12キー）
   - Console タブで以下のログを確認:
     ```
     [Firebase] Initializing with projectId: birthday-song-app-stg, authDomain: birthday-song-app-stg.firebaseapp.com
     ```
   - もし `projectId` が `birthday-song-app` (PROD) になっていたら、`.env.stg` の設定が読み込まれていない
   - **対処**: `npm run build:stg` で再ビルドして `firebase use stg && firebase deploy --only hosting:birthday-song-app-stg` で再デプロイ

2. **Firebase Console でGoogle認証が有効化されていない**
   - Firebase Console > Authentication > Sign-in method > Google を確認
   - 「有効」になっていない場合は有効化する

3. **承認済みドメインが登録されていない**
   - Firebase Console > Authentication > 設定 > 承認済みドメイン を確認
   - `birthday-song-app-stg.web.app` が登録されているか確認
   - 登録されていない場合は「ドメインを追加」をクリック

4. **詳細なエラー情報の確認**
   - ログイン失敗時に表示されるアラートに以下が含まれる:
     - エラーコード（例: `auth/unauthorized-domain`）
     - 詳細メッセージ
     - 使用中の projectId と authDomain
   - エラーコードに応じて対処:
     - `auth/unauthorized-domain`: 承認済みドメインに追加
     - `auth/invalid-api-key`: APIキーが間違っている
     - `auth/operation-not-allowed`: Google認証が無効になっている

**確認コマンド**:
\`\`\`bash
# ビルド時にどの環境変数が使われているか確認
npm run build -- --mode stg
# dist/assets/*.js ファイルに "birthday-song-app-stg" が含まれているか grep で確認
grep -r "birthday-song-app-stg" dist/
\`\`\`

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
