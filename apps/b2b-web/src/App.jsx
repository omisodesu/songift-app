import React from 'react';
import { BrowserRouter, Link } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// ---------------------------
// ヘッダーコンポーネント（認証コンテキスト使用）
// ---------------------------
function AppHeader() {
  const { user, membership, logout, isSuperAdmin, supportSession, currentOrgId } = useAuth();

  if (!user || !membership?.role) return null;

  const handleLogout = async () => {
    await logout();
    alert("ログアウトしました");
  };

  // 管理画面リンクの遷移先をロール別に決定
  const getAdminLink = () => {
    if (isSuperAdmin() && !supportSession) return '/admin/super';
    if (currentOrgId) return `/admin/org/${currentOrgId}`;
    if (membership.orgIds?.length === 1) return `/admin/org/${membership.orgIds[0]}`;
    return '/admin/org-select';
  };

  return (
    <header className="p-4 bg-white shadow-sm flex justify-between items-center fixed top-0 w-full z-10">
      {/* サポートモードバナー */}
      {supportSession && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center py-1 text-sm font-bold">
          [サポートモード] {supportSession.orgName}を操作中 — 理由: {supportSession.reason}
        </div>
      )}

      <div className={`flex items-center gap-6 ${supportSession ? 'mt-6' : ''}`}>
        <Link to="/" className="font-bold text-blue-600 text-xl">バースデーソングメーカー</Link>
        <Link to={getAdminLink()} className="text-sm font-bold text-gray-600 hover:text-blue-500 bg-gray-100 px-3 py-1 rounded">
          管理者画面へ
        </Link>
        <Link to="/order" className="text-sm font-bold text-gray-600 hover:text-blue-500 bg-amber-100 px-3 py-1 rounded">
          新規オーダー
        </Link>
      </div>
      <div className={`flex items-center gap-4 ${supportSession ? 'mt-6' : ''}`}>
        {membership.role && (
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
            {membership.role === 'super_admin' ? 'Super Admin' :
             membership.role === 'org_admin' ? 'Org Admin' : 'Member'}
          </span>
        )}
        <span className="text-sm text-gray-600">{user.displayName}さん</span>
        <button onClick={handleLogout} className="text-sm text-red-500 underline">ログアウト</button>
      </div>
    </header>
  );
}

// ---------------------------
// メインアプリコンポーネント
// ---------------------------
function AppContent() {
  const { user, membership, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <>
      <AppHeader />
      <AppRoutes user={user} membership={membership} />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
