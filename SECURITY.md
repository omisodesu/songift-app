# セキュリティガイドライン

## 🔐 機密情報の管理

### 絶対にコミットしてはいけないファイル

以下のファイルには機密情報（APIキー、認証情報）が含まれます。**絶対にGitにコミットしないでください**：

- `.env`
- `.env.stg`
- `.env.production`
- `.env.local`
- `.env.*.local`

これらのファイルは `.gitignore` に含まれていますが、`git add -f` などで強制的にコミットできてしまいます。

### Pre-commit Hook

このリポジトリには、環境変数ファイルの誤コミットを防ぐ pre-commit hook が設定されています。

もし `.git/hooks/pre-commit` が存在しない場合は、以下のコマンドで再作成してください：

```bash
# SETUP.md の指示に従って pre-commit hook を設定
chmod +x .git/hooks/pre-commit
```

### APIキーの取得方法

#### Gemini API Key
1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. 「Create API Key」をクリック
3. APIキーをコピーして `.env.stg` または `.env.production` に貼り付け

#### Suno API Key
1. [Suno API Dashboard](https://suno.ai/account) にログイン
2. APIキーを生成
3. APIキーをコピーして `.env.stg` または `.env.production` に貼り付け

#### Firebase Configuration
1. [Firebase Console](https://console.firebase.google.com/) を開く
2. プロジェクトを選択（STGまたはPROD）
3. プロジェクトの設定 > 全般 > マイアプリ > 構成
4. すべての値をコピーして `.env.stg` または `.env.production` に貼り付け

---

## 🚨 APIキーが漏洩した場合の対処法

### 1. 即座にAPIキーを無効化

**Gemini API Key:**
- [Google AI Studio](https://makersuite.google.com/app/apikey) でキーを削除
- 新しいキーを生成

**Suno API Key:**
- [Suno API Dashboard](https://suno.ai/account) でキーを削除
- 新しいキーを生成

**Firebase API Key:**
- Firebase API Keyは公開されても問題ない設計ですが、念のため以下を確認：
  - Firestore Security Rules が正しく設定されているか
  - Authentication の承認済みドメインが制限されているか

### 2. Git履歴からファイルを削除

⚠️ **警告**: この操作は履歴を書き換えます。チーム開発の場合は事前に通知してください。

```bash
# BFG Repo-Cleaner を使用（推奨）
brew install bfg
bfg --delete-files .env.stg
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 強制プッシュ
git push origin --force --all
```

### 3. GitGuardian の警告を解決

1. GitGuardianのダッシュボードで該当の警告を開く
2. 「Rotate & Revoke the leaked secret」をクリック
3. 新しいAPIキーに更新したことを報告

---

## ✅ ベストプラクティス

### コミット前のチェックリスト

- [ ] `.env` ファイルがステージングされていないか確認: `git status`
- [ ] APIキーが含まれていないか確認: `git diff --cached`
- [ ] pre-commit hook が実行されたか確認（エラーが出ていないか）

### 環境変数の命名規則

- **PROD環境**: `.env.production` を使用
- **STG環境**: `.env.stg` を使用
- **ローカル開発**: `.env.local` を使用（オプション）

### APIキーのローテーション

定期的にAPIキーをローテーションすることを推奨します（3-6ヶ月ごと）：

1. 新しいAPIキーを生成
2. `.env.stg` と `.env.production` を更新
3. 古いAPIキーを無効化
4. 本番環境に再デプロイ

---

## 📞 インシデント報告

セキュリティ上の問題を発見した場合は、以下の手順で報告してください：

1. **公開Issue は作成しない**（情報が公開されてしまうため）
2. リポジトリ管理者に直接連絡
3. 詳細な再現手順と影響範囲を報告

---

## 🔗 参考リンク

- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
