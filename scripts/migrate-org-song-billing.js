#!/usr/bin/env node

/**
 * 既存organizationsに曲数制フィールドを付与するマイグレーションスクリプト
 *
 * 追加フィールド:
 *   billingSettings, contract, songBalance
 *
 * 既存ポイント残高は引き継がず全店舗ゼロ開始。
 * 旧ポイント関連フィールドは削除しない。
 *
 * ネストした不足フィールドも個別に補完する。
 * 既存値があるフィールドは上書きしない。
 *
 * 使い方:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json FIREBASE_PROJECT_ID=birthday-song-app node scripts/migrate-org-song-billing.js
 *   node scripts/migrate-org-song-billing.js --dry-run
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

/**
 * デフォルト値をリーフまでフラットな dot-notation パスの Map で返す。
 * 例: { 'billingSettings.addonSongPriceYen': 1000, ... }
 */
function getDefaultPaths() {
  return {
    'billingSettings.basePlanPrices.light': 20000,
    'billingSettings.basePlanPrices.standard': 60000,
    'billingSettings.basePlanPrices.premium': 100000,
    'billingSettings.addonSongPriceYen': 1000,
    'billingSettings.salesChannel': 'direct',
    'billingSettings.agencyName': null,
    'billingSettings.agentPayoutRate.basePlans.light': 0,
    'billingSettings.agentPayoutRate.basePlans.standard': 0,
    'billingSettings.agentPayoutRate.basePlans.premium': 0,
    'billingSettings.agentPayoutRate.addonSong': 0,

    'contract.currentPlan': null,
    'contract.startedAt': null,
    'contract.endsAt': null,
    'contract.includedSongs': 0,

    'songBalance.availableSongs': 0,
    'songBalance.reservedSongs': 0,
    'songBalance.usedSongsTotal': 0,
    'songBalance.expiredSongsTotal': 0,
    'songBalance.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
  };
}

// パス解決の3状態
const PRESENT = 'present';           // leaf に値がある（null 含む）
const MISSING = 'missing';           // leaf が undefined（補完対象）
const BLOCKED = 'blocked_by_null';   // 途中階層が null（補完しない）

/**
 * dot-notation パスで orgData 内の leaf 状態を判定する。
 *
 * - 途中階層が null        → BLOCKED（親が意図的に null なので触らない）
 * - 途中階層が undefined   → そこから先は存在しない → leaf は MISSING
 * - leaf が undefined      → MISSING（補完対象）
 * - leaf が null やその他  → PRESENT（既存値として保持）
 */
function resolvePathStatus(obj, dotPath) {
  const keys = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length; i++) {
    if (current === undefined) return MISSING;
    if (current === null) return BLOCKED;
    current = current[keys[i]];
  }
  // leaf に到達
  return current === undefined ? MISSING : PRESENT;
}

async function main() {
  console.log(`\n=== Organization 曲数制フィールド マイグレーション ===`);
  console.log(`プロジェクト: ${projectId}`);
  console.log(`モード: ${isDryRun ? 'DRY-RUN（変更なし）' : '本番実行'}\n`);

  const orgsSnapshot = await db.collection('organizations').get();

  if (orgsSnapshot.empty) {
    console.log('organizations コレクションが空です');
    return;
  }

  console.log(`対象組織数: ${orgsSnapshot.size}\n`);

  const defaultPaths = getDefaultPaths();
  let updatedCount = 0;
  let skippedCount = 0;

  for (const orgDoc of orgsSnapshot.docs) {
    const orgData = orgDoc.data();
    const orgId = orgDoc.id;

    // 不足パスだけを updates に積む（Firestore の dot-notation update）
    const updates = {};
    const missingPaths = [];
    const blockedPaths = [];

    for (const [dotPath, defaultValue] of Object.entries(defaultPaths)) {
      const status = resolvePathStatus(orgData, dotPath);
      if (status === MISSING) {
        updates[dotPath] = defaultValue;
        missingPaths.push(dotPath);
      } else if (status === BLOCKED) {
        blockedPaths.push(dotPath);
      }
    }

    if (missingPaths.length === 0) {
      const skipDetail = blockedPaths.length > 0
        ? `全フィールド設定済み (null階層によりスキップ: ${blockedPaths.length}件)`
        : '全フィールド設定済み';
      console.log(`  [SKIP] ${orgId} (${orgData.name}): ${skipDetail}`);
      skippedCount++;
      continue;
    }

    if (isDryRun) {
      console.log(`  [DRY-RUN] ${orgId} (${orgData.name}): 補完予定 (${missingPaths.length}件)`);
      for (const p of missingPaths) {
        console.log(`           + ${p}`);
      }
      if (blockedPaths.length > 0) {
        console.log(`           (null階層によりスキップ: ${blockedPaths.length}件)`);
      }
    } else {
      await orgDoc.ref.update(updates);
      console.log(`  [UPDATED] ${orgId} (${orgData.name}): 補完済み (${missingPaths.length}件)`);
      for (const p of missingPaths) {
        console.log(`           + ${p}`);
      }
      if (blockedPaths.length > 0) {
        console.log(`           (null階層によりスキップ: ${blockedPaths.length}件)`);
      }
    }
    updatedCount++;
  }

  console.log(`\n--- 結果 ---`);
  console.log(`更新: ${updatedCount} 件`);
  console.log(`スキップ: ${skippedCount} 件`);

  // 検証フェーズ
  if (!isDryRun) {
    console.log(`\n--- 検証 ---`);
    const verifySnapshot = await db.collection('organizations').get();
    let warnCount = 0;
    for (const doc of verifySnapshot.docs) {
      const data = doc.data();
      const stillMissing = [];
      for (const dotPath of Object.keys(defaultPaths)) {
        if (resolvePathStatus(data, dotPath) === MISSING) {
          stillMissing.push(dotPath);
        }
      }
      if (stillMissing.length > 0) {
        console.log(`  [WARN] ${doc.id} (${data.name}): 未補完パス = [${stillMissing.join(', ')}]`);
        warnCount++;
      }
    }
    if (warnCount === 0) {
      console.log('  全組織のフィールド検証OK');
    } else {
      console.log(`  ${warnCount} 件の警告あり`);
    }
  }

  console.log('完了');
}

main().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});
