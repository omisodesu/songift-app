// ---------------------------
// Firebase設定（共有）
// ---------------------------
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  // 環境変数から読み込み（Vite標準の書き方）
  // STG環境では .env.stg が、PROD環境では .env が読み込まれる
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 初期化（環境確認ログ追加）
console.log(`[Firebase] Initializing with projectId: ${firebaseConfig.projectId}, authDomain: ${firebaseConfig.authDomain}`);

// ---------------------------
// 起動時の安全チェック（STG/PROD混在防止）
// ---------------------------
(() => {
  const hostname = window.location.hostname;
  const apiKey = firebaseConfig.apiKey;

  // STGドメインのチェック
  if (hostname === 'birthday-song-app-stg.web.app' || hostname === 'birthday-song-app-stg.firebaseapp.com') {
    if (!apiKey.startsWith('AIzaSyDCg1')) {
      const errorMsg = `❌ 環境エラー: STGドメインですがPROD用のAPIキーが使われています！\n\nドメイン: ${hostname}\nAPIキー prefix: ${apiKey.substring(0, 15)}...\n期待値: AIzaSyDCg1...\n\n修正方法:\n1. .env.stg のVITE_FIREBASE_API_KEYをSTG用に変更\n2. npm run build:stg でビルド\n3. npm run deploy:stg でデプロイ`;
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error('STG/PROD環境混在エラー');
    }
    console.log('✅ 環境チェックOK: STG環境として正しく動作しています');
  }

  // PRODドメインのチェック
  if (hostname === 'birthday-song-app.web.app' || hostname === 'birthday-song-app.firebaseapp.com') {
    if (!apiKey.startsWith('AIzaSyBQ0E')) {
      const errorMsg = `❌ 環境エラー: PRODドメインですがSTG用のAPIキーが使われています！\n\nドメイン: ${hostname}\nAPIキー prefix: ${apiKey.substring(0, 15)}...\n期待値: AIzaSyBQ0E...\n\n修正方法:\n1. .env.production のVITE_FIREBASE_API_KEYをPROD用に変更\n2. npm run build:prod でビルド\n3. npm run deploy:prod でデプロイ`;
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error('STG/PROD環境混在エラー');
    }
    console.log('✅ 環境チェックOK: PROD環境として正しく動作しています');
  }
})();

// Firebase初期化
const app = initializeApp(firebaseConfig);

// 各サービスのインスタンスをエクスポート
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const functions = getFunctions(app);
export { firebaseConfig };
