#!/usr/bin/env node

/**
 * 既存管理者をsuper_adminとしてorganization_membersに登録するスクリプト
 *
 * 使い方:
 *   # STG環境
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/stg-key.json FIREBASE_PROJECT_ID=birthday-song-app-stg node scripts/seed-super-admins.js
 *
 *   # PROD環境
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/prod-key.json FIREBASE_PROJECT_ID=birthday-song-app node scripts/seed-super-admins.js
 *
 *   # dry-runモード（変更を加えない）
 *   node scripts/seed-super-admins.js --dry-run
 */

const admin = require('firebase-admin');

// 初期化
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('ERROR: FIREBASE_PROJECT_ID環境変数を設定してください');
  process.exit(1);
}

admin.initializeApp({ projectId });
const db = admin.firestore();

const isDryRun = process.argv.includes('--dry-run');

// 既存管理者メールアドレス（firestore.rulesにハードコードされていたもの）
const SUPER_ADMIN_EMAILS = [
  'fukui@tfs.jp.net',
  'gadandan@tfs.jp.net',
  'sknn0811@gmail.com',
];

async function main() {
  console.log(`\n=== Super Admin 初期設定スクリプト ===`);
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (変更なし)' : '本番実行'}\n`);

  // 1. legacy org作成
  console.log('--- 1. legacy org 作成 ---');
  const legacyOrgRef = db.collection('organizations').doc('legacy');
  const legacyOrgDoc = await legacyOrgRef.get();

  if (legacyOrgDoc.exists) {
    console.log('  organizations/legacy は既に存在します。スキップ。');
  } else if (isDryRun) {
    console.log('  [DRY RUN] organizations/legacy を作成します');
  } else {
    await legacyOrgRef.set({
      name: 'レガシー（既存注文）',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
    });
    console.log('  organizations/legacy を作成しました');
  }

  // 2. 各管理者をsuper_adminとして登録
  console.log('\n--- 2. Super Admin 登録 ---');
  for (const email of SUPER_ADMIN_EMAILS) {
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      const uid = userRecord.uid;
      console.log(`  ${email} → UID: ${uid}`);

      const memberRef = db.collection('organization_members').doc(uid);
      const memberDoc = await memberRef.get();

      if (memberDoc.exists) {
        const data = memberDoc.data();
        if (data.role === 'super_admin') {
          console.log(`    既にsuper_adminとして登録済み。スキップ。`);
          continue;
        }
        console.log(`    既存ロール: ${data.role} → super_adminに更新`);
      }

      if (isDryRun) {
        console.log(`    [DRY RUN] organization_members/${uid} を作成/更新します`);
        console.log(`    [DRY RUN] Custom Claims を設定します`);
      } else {
        // organization_members作成/更新
        await memberRef.set({
          email: email,
          orgIds: ['legacy'],
          role: 'super_admin',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // Custom Claims設定（syncCustomClaimsトリガーでも設定されるが、確実に設定）
        await admin.auth().setCustomUserClaims(uid, {
          role: 'super_admin',
          orgIds: ['legacy'],
        });

        console.log(`    organization_members/${uid} を作成し、Custom Claimsを設定しました`);
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`  ${email} → Firebase Authに未登録（スキップ）`);
      } else {
        console.error(`  ${email} → エラー:`, error.message);
      }
    }
  }

  console.log('\n=== 完了 ===\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
