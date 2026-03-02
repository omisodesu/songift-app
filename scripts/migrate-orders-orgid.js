#!/usr/bin/env node

/**
 * 既存B2B注文（plan === 'nursingHome'）にorgId: 'legacy'を付与するマイグレーションスクリプト
 *
 * 使い方:
 *   # dry-runモード（対象件数の確認のみ）
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json FIREBASE_PROJECT_ID=birthday-song-app-stg node scripts/migrate-orders-orgid.js --dry-run
 *
 *   # 本番実行
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json FIREBASE_PROJECT_ID=birthday-song-app node scripts/migrate-orders-orgid.js
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
const BATCH_SIZE = 500;

async function main() {
  console.log(`\n=== B2B Orders orgId マイグレーション ===`);
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (変更なし)' : '本番実行'}\n`);

  // plan === 'nursingHome' かつ orgIdフィールドが未設定の注文を取得
  const ordersRef = db.collection('orders');
  const snapshot = await ordersRef.where('plan', '==', 'nursingHome').get();

  const targetOrders = [];
  const alreadyMigrated = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.orgId) {
      targetOrders.push({ id: doc.id, email: data.userEmail, targetName: data.targetName });
    } else {
      alreadyMigrated.push({ id: doc.id, orgId: data.orgId });
    }
  });

  console.log(`B2B注文（plan=nursingHome）合計: ${snapshot.size}`);
  console.log(`  orgId未設定（マイグレーション対象）: ${targetOrders.length}`);
  console.log(`  orgId設定済み（スキップ）: ${alreadyMigrated.length}`);

  if (targetOrders.length === 0) {
    console.log('\nマイグレーション対象がありません。');
    process.exit(0);
  }

  console.log('\n--- 対象注文一覧 ---');
  targetOrders.forEach((order) => {
    console.log(`  ${order.id}: ${order.targetName} (${order.email})`);
  });

  if (isDryRun) {
    console.log(`\n[DRY RUN] ${targetOrders.length}件の注文にorgId: 'legacy'を設定します`);
    console.log('[DRY RUN] 実際には変更されていません。--dry-runを外して再実行してください。');
    process.exit(0);
  }

  // バッチ書き込み
  console.log(`\n--- マイグレーション実行 ---`);
  let processed = 0;

  for (let i = 0; i < targetOrders.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = targetOrders.slice(i, i + BATCH_SIZE);

    for (const order of chunk) {
      const ref = ordersRef.doc(order.id);
      batch.update(ref, { orgId: 'legacy' });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  ${processed}/${targetOrders.length} 完了`);
  }

  // 検証: orgIdなしのnursingHome注文が0件であることを確認
  console.log('\n--- 検証 ---');
  const verifySnapshot = await ordersRef.where('plan', '==', 'nursingHome').get();
  let missingCount = 0;
  verifySnapshot.forEach((doc) => {
    if (!doc.data().orgId) missingCount++;
  });

  if (missingCount === 0) {
    console.log('  検証OK: orgId未設定のB2B注文は0件です');
  } else {
    console.error(`  検証NG: orgId未設定のB2B注文が${missingCount}件残っています！`);
    process.exit(1);
  }

  console.log('\n=== マイグレーション完了 ===\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
