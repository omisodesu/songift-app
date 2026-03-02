import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, functions } from '../../lib/firebase';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      console.log('[Auth] Attempting Google sign in with popup...');
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log('[Auth] Sign in successful:', user.email);

      // Custom Claims強制リフレッシュ
      await user.getIdToken(true);

      // メンバーシップ確認
      const getMyMembership = httpsCallable(functions, 'getMyMembership');
      const membershipResult = await getMyMembership();
      const membership = membershipResult.data;

      console.log('[Auth] Membership:', JSON.stringify(membership));

      if (!membership.role) {
        console.warn('[Auth] User has no membership:', user.email);
        await signOut(auth);
        alert('管理者権限がありません。管理者に招待を依頼してください。');
        setLoading(false);
        return;
      }

      // ロール別にリダイレクト
      if (membership.role === 'super_admin') {
        console.log('[Auth] Super admin, navigating to /admin/super');
        navigate('/admin/super');
      } else if (membership.orgIds?.length === 1) {
        console.log(`[Auth] Single org member, navigating to /admin/org/${membership.orgIds[0]}`);
        navigate(`/admin/org/${membership.orgIds[0]}`);
      } else if (membership.orgIds?.length > 1) {
        console.log('[Auth] Multi-org member, navigating to /admin/org-select');
        navigate('/admin/org-select');
      } else {
        console.warn('[Auth] Member has no orgs:', user.email);
        await signOut(auth);
        alert('所属する組織がありません。管理者に連絡してください。');
      }
    } catch (error) {
      console.error('[Auth] Login error occurred:', {
        code: error?.code,
        message: error?.message,
        email: error?.customData?.email,
        fullError: error,
      });

      const code = error?.code || '(no code)';
      const message = error?.message || String(error);
      const email = error?.customData?.email ? `\nemail: ${error.customData.email}` : '';

      alert(`ログインに失敗しました。${email}\n\nエラーコード: ${code}\n\n詳細: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center bg-gray-50">
      <h2 className="text-2xl font-bold mb-6">管理者ログイン</h2>
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded shadow hover:bg-gray-100 transition disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></span>
            ログイン中...
          </span>
        ) : (
          <>
            <span className="text-blue-500 mr-2">G</span> Googleでログイン
          </>
        )}
      </button>
      <Link to="/" className="text-blue-500 text-sm underline mt-6 block">
        トップページへ
      </Link>
    </div>
  );
};

export default AdminLoginPage;
