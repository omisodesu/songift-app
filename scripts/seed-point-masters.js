#!/usr/bin/env node

/**
 * ポイント制マスタデータ投入スクリプト
 *
 * pointPlans コレクション + serviceConsumption コレクションを作成する。
 *
 * 使い方:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json FIREBASE_PROJECT_ID=birthday-song-app node scripts/seed-point-masters.js
 *   node scripts/seed-point-masters.js --dry-run
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

// ポイントプラン定義
const POINT_PLANS = {
  trial: {
    name: 'トライアル',
    description: '無料お試しプラン',
    basePoints: 1000,
    priceYen: 0,
    durationDays: 30,
    isActive: true,
    sortOrder: 0,
  },
  light: {
    name: 'ライト',
    description: '小規模施設向け',
    basePoints: 10000,
    priceYen: 10000,
    durationDays: 365,
    isActive: true,
    sortOrder: 1,
  },
  standard: {
    name: 'スタンダード',
    description: '中規模施設向け',
    basePoints: 30000,
    priceYen: 30000,
    durationDays: 365,
    isActive: true,
    sortOrder: 2,
  },
  premium: {
    name: 'プレミアム',
    description: '大規模施設・チェーン向け',
    basePoints: 50000,
    priceYen: 50000,
    durationDays: 365,
    isActive: true,
    sortOrder: 3,
  },
};

// サービス消費定義
const SERVICE_CONSUMPTION = {
  song_generation: {
    name: '楽曲生成',
    description: 'Suno AIによるバースデーソング生成（2曲）',
    pointCost: 500,
    isActive: true,
  },
};

async function main() {
  console.log(`\n=== ポイント制マスタデータ投入 ===`);
  console.log(`プロジェクト: ${projectId}`);
  console.log(`モード: ${isDryRun ? 'DRY-RUN（変更なし）' : '本番実行'}\n`);

  // pointPlans 投入
  console.log('--- pointPlans ---');
  for (const [planId, planData] of Object.entries(POINT_PLANS)) {
    const ref = db.collection('pointPlans').doc(planId);
    const existing = await ref.get();

    if (existing.exists) {
      console.log(`  [SKIP] ${planId}: 既に存在 (${existing.data().name})`);
      continue;
    }

    const data = {
      ...planData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (isDryRun) {
      console.log(`  [DRY-RUN] ${planId}: 作成予定`, JSON.stringify(planData));
    } else {
      await ref.set(data);
      console.log(`  [CREATED] ${planId}: ${planData.name} (${planData.basePoints}pt / ¥${planData.priceYen})`);
    }
  }

  // serviceConsumption 投入
  console.log('\n--- serviceConsumption ---');
  for (const [serviceId, serviceData] of Object.entries(SERVICE_CONSUMPTION)) {
    const ref = db.collection('serviceConsumption').doc(serviceId);
    const existing = await ref.get();

    if (existing.exists) {
      console.log(`  [SKIP] ${serviceId}: 既に存在 (${existing.data().name})`);
      continue;
    }

    const data = {
      ...serviceData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (isDryRun) {
      console.log(`  [DRY-RUN] ${serviceId}: 作成予定`, JSON.stringify(serviceData));
    } else {
      await ref.set(data);
      console.log(`  [CREATED] ${serviceId}: ${serviceData.name} (${serviceData.pointCost}pt)`);
    }
  }

  console.log('\n完了');
}

main().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});
