#!/bin/bash

# Git履歴から環境変数ファイルを削除するスクリプト
# ⚠️ 警告: このスクリプトは履歴を書き換えます！
# 実行前に必ずバックアップを取ってください。

set -e

echo "🚨 警告: このスクリプトはGit履歴を書き換えます"
echo ""
echo "このスクリプトは以下のファイルをGit履歴から完全に削除します:"
echo "  - .env"
echo "  - .env.stg"
echo "  - .env.production"
echo "  - .env.local"
echo ""
echo "実行する前に:"
echo "  1. すべての変更をコミットしてください"
echo "  2. バックアップを取ってください"
echo "  3. チームメンバーに通知してください"
echo ""
read -p "続行しますか？ (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "中止しました"
    exit 0
fi

echo ""
echo "📦 バックアップを作成しています..."
timestamp=$(date +%Y%m%d_%H%M%S)
backup_dir="../birthday-song-app-backup-${timestamp}"
cp -r . "$backup_dir"
echo "✅ バックアップを作成しました: $backup_dir"
echo ""

echo "🧹 Git履歴から環境変数ファイルを削除しています..."
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env .env.stg .env.production .env.local' \
  --prune-empty --tag-name-filter cat -- --all

echo ""
echo "🗑️  reflog をクリーンアップしています..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ クリーンアップ完了"
echo ""
echo "次のステップ:"
echo "  1. 変更を確認: git log --all --oneline -- .env.stg"
echo "  2. 強制プッシュ: git push origin --force --all"
echo "  3. タグも強制プッシュ: git push origin --force --tags"
echo ""
echo "⚠️ 重要: チームメンバーに以下を実行してもらってください:"
echo "  cd /path/to/repo"
echo "  git fetch origin"
echo "  git reset --hard origin/main  # または適切なブランチ名"
echo ""
