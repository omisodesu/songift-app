#!/usr/bin/env node

/**
 * 既存organizationsにポイント制フィールドを補完するマイグレーションスクリプト
 *
 * 追加フィールド:
 *   contractType, contractStartDate, contractEndDate, autoRenew,
 *   salesChannel, agentId, pointBalance
 *
 * 使い方:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json FIREBASE_PROJECT_ID=birthday-song-app node scripts/migrate-org-point-fields.js
 *   node scripts/migrate-org-point-fields.js --dry-run
 */

const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('ERROR: FIREBASE_PROJECT_ID環境変数を設定してください');
  process.exit(1);
}

admin.initializeApp({ projectId });
const db = admin.firestore();

const isDryRun = process.argv.includes('--dry-run');

// デフォルト契約: trialプラン、開始日=now、終了日=90日後
function getDefaultFields() {
  const now = new Date();
  const endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  return {
    contractType: 'trial',
    contractStartDate: admin.firestore.Timestamp.fromDate(now),
    contractEndDate: admin.firestore.Timestamp.fromDate(endDate),
    autoRenew: false,
    salesChannel: 'direct',
    agentId: null,
    pointBalance: {
      freeAvailable: 10000,
      paidAvailable: 0,
      reserved: 0,
      usedTotal: 0,
      expiredTotal: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };
}

async function main() {
  console.log(`\n=== Organization ポイント制フィールド マイグレーション ===`);
  console.log(`プロジェクト: ${projectId}`);
  console.log(`モード: ${isDryRun ? 'DRY-RUN（変更なし）' : '本番実行'}\n`);

  const orgsSnapshot = await db.collection('organizations').get();

  if (orgsSnapshot.empty) {
    console.log('organizations コレクションが空です');
    return;
  }

  console.log(`対象組織数: ${orgsSnapshot.size}\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const orgDoc of orgsSnapshot.docs) {
    const orgData = orgDoc.data();
    const orgId = orgDoc.id;

    // 既にpointBalanceが設定されていればスキップ
    if (orgData.pointBalance && orgData.pointBalance.freeAvailable !== undefined) {
      console.log(`  [SKIP] ${orgId} (${orgData.name}): pointBalance既存`);
      skippedCount++;
      continue;
    }

    const defaults = getDefaultFields();

    // 既に部分的に設定されているフィールドは上書きしない
    const updates = {};
    for (const [key, value] of Object.entries(defaults)) {
      if (orgData[key] === undefined || orgData[key] === null) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  [SKIP] ${orgId} (${orgData.name}): すべてのフィールドが設定済み`);
      skippedCount++;
      continue;
    }

    if (isDryRun) {
      console.log(`  [DRY-RUN] ${orgId} (${orgData.name}): 更新予定フィールド = [${Object.keys(updates).join(', ')}]`);
    } else {
      await orgDoc.ref.update(updates);
      console.log(`  [UPDATED] ${orgId} (${orgData.name}): ${Object.keys(updates).join(', ')}`);
    }
    updatedCount++;

    // 初期ポイント付与の取引記録
    if (updates.pointBalance && !isDryRun) {
      const txnRef = orgDoc.ref.collection('pointTransactions').doc();
      await txnRef.set({
        type: 'grant',
        amount: 10000,
        amountFree: 10000,
        amountPaid: 0,
        balanceAfter: {
          freeAvailable: 10000,
          paidAvailable: 0,
          reserved: 0,
        },
        description: 'マイグレーション: トライアルポイント初期付与',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'migration',
      });
      console.log(`    → 初期ポイント付与 (10000pt free) 記録済み`);
    }
  }

  console.log(`\n--- 結果 ---`);
  console.log(`更新: ${updatedCount} 件`);
  console.log(`スキップ: ${skippedCount} 件`);
  console.log('完了');
}

main().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});
