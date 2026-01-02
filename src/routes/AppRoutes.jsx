import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// 遅延読み込み
const TopPage = lazy(() => import('../pages/TopPage'));
const OrderPage = lazy(() => import('../pages/OrderPage'));
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
  OrderConfirmPage, // OrderConfirmPageはApp.jsxに残る（functionsを使用するため）
}) => {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* 一般ユーザー向けルート */}
        <Route path="/" element={<TopPage />} />
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
