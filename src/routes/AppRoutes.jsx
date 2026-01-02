import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// 遅延読み込み
const HomeAB = lazy(() => import('../pages/landing/HomeAB'));
const LandingA = lazy(() => import('../pages/landing/LandingA'));
const LandingB = lazy(() => import('../pages/landing/LandingB'));
const OrderPage = lazy(() => import('../pages/OrderPage'));
const OrderConfirmPage = lazy(() => import('../pages/OrderConfirmPage'));
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage'));
const AdminPage = lazy(() => import('../pages/admin/AdminPage'));

// ローディング表示
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

/**
 * アプリケーションのルート定義
 * ページコンポーネントはReact.lazyで遅延読み込み
 */
const AppRoutes = ({
  user,
  isAdmin,
}) => {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* 一般ユーザー向けルート */}
        <Route path="/" element={<HomeAB />} />
        <Route path="/lp/a" element={<LandingA />} />
        <Route path="/lp/b" element={<LandingB />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/o/:orderId" element={<OrderConfirmPage />} />

        {/* 管理者向けルート */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            user && isAdmin(user)
              ? <div className="pt-16"><AdminPage user={user} /></div>
              : <Navigate to="/admin/login" />
          }
        />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
