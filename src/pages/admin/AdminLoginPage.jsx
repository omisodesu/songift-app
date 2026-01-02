import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

// 5. 管理者ログインページ
const AdminLoginPage = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      console.log('[Auth] Attempting Google sign in with popup...');
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log('[Auth] Sign in successful:', user.email);

      // 管理者チェック
      const adminEmailsStr = import.meta.env.VITE_ADMIN_EMAIL || '';
      const adminEmails = adminEmailsStr.split(',').map(e => e.trim());

      if (!adminEmails.includes(user.email)) {
        console.warn('[Auth] User is not an admin:', user.email);
        await signOut(auth);
        alert('管理者権限がありません');
        return;
      }

      console.log('[Auth] Admin verified, navigating to /admin');
      navigate('/admin');
    } catch (error) {
      // 詳細なエラー情報をログ出力
      console.error('[Auth] Login error occurred:', {
        code: error?.code,
        message: error?.message,
        email: error?.customData?.email,
        fullError: error
      });

      // ユーザーにも詳細を表示
      const code = error?.code || '(no code)';
      const message = error?.message || String(error);
      const email = error?.customData?.email ? `\nemail: ${error.customData.email}` : '';

      alert(`ログインに失敗しました。${email}\n\nエラーコード: ${code}\n\n詳細: ${message}\n\nFirebase設定を確認してください:\n- projectId: ${import.meta.env.VITE_FIREBASE_PROJECT_ID}\n- authDomain: ${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center bg-gray-50">
      <h2 className="text-2xl font-bold mb-6">管理者ログイン</h2>
      <button
        onClick={handleGoogleLogin}
        className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded shadow hover:bg-gray-100 transition"
      >
        <span className="text-blue-500 mr-2">G</span> Googleでログイン
      </button>
      <Link to="/" className="text-blue-500 text-sm underline mt-6 block">
        トップページへ
      </Link>
    </div>
  );
};

export default AdminLoginPage;
