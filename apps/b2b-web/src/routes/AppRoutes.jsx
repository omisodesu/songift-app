import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// 遅延読み込み
const OrderPage = lazy(() => import('../pages/OrderPage'));
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage'));
const AdminPage = lazy(() => import('../pages/admin/AdminPage'));
const SuperAdminPage = lazy(() => import('../pages/admin/SuperAdminPage'));
const OrgAdminPage = lazy(() => import('../pages/admin/OrgAdminPage'));
const OrgSelectPage = lazy(() => import('../pages/admin/OrgSelectPage'));

// ローディング表示
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

/**
 * 認証済みユーザーのみアクセス可能なルートガード
 */
const ProtectedRoute = ({ children }) => {
  const { user, membership, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user || !membership?.role) return <Navigate to="/admin/login" />;

  return <div className="pt-16">{children}</div>;
};

/**
 * super_adminのみアクセス可能なルートガード
 */
const SuperAdminRoute = ({ children }) => {
  const { user, membership, loading, isSuperAdmin } = useAuth();

  if (loading) return <Loading />;
  if (!user || !membership?.role) return <Navigate to="/admin/login" />;
  if (!isSuperAdmin()) return <Navigate to="/admin" />;

  return <div className="pt-16">{children}</div>;
};

/**
 * ログイン後のリダイレクト先を決定
 */
const AdminRedirect = () => {
  const { user, membership, loading, isSuperAdmin } = useAuth();

  if (loading) return <Loading />;
  if (!user || !membership?.role) return <Navigate to="/admin/login" />;

  if (isSuperAdmin()) return <Navigate to="/admin/super" />;
  if (membership.orgIds?.length === 1) return <Navigate to={`/admin/org/${membership.orgIds[0]}`} />;
  if (membership.orgIds?.length > 1) return <Navigate to="/admin/org-select" />;

  // orgIdsが空の場合
  return <Navigate to="/admin/login" />;
};

/**
 * ルートのリダイレクト（/ → 適切な画面）
 */
const RootRedirect = () => {
  const { user, membership, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user || !membership?.role) return <Navigate to="/admin/login" />;

  return <Navigate to="/admin" />;
};

/**
 * アプリケーションのルート定義
 */
const AppRoutes = () => {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* ルート → ロール別リダイレクト */}
        <Route path="/" element={<RootRedirect />} />

        {/* 注文ページ（認証必須） */}
        <Route path="/order" element={
          <ProtectedRoute><OrderPage /></ProtectedRoute>
        } />

        {/* ログインページ */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* /admin → ロール別リダイレクト（後方互換） */}
        <Route path="/admin" element={<AdminRedirect />} />

        {/* super admin全社ダッシュボード */}
        <Route path="/admin/super" element={
          <SuperAdminRoute><SuperAdminPage /></SuperAdminRoute>
        } />

        {/* 複数org所属時の選択ページ */}
        <Route path="/admin/org-select" element={
          <ProtectedRoute><OrgSelectPage /></ProtectedRoute>
        } />

        {/* org別管理画面 */}
        <Route path="/admin/org/:orgId" element={
          <ProtectedRoute><OrgAdminPage /></ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
