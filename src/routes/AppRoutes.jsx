import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * アプリケーションのルート定義
 * ページコンポーネントは現在App.jsxで定義されているため、propsで受け取る
 */
const AppRoutes = ({
  user,
  isAdmin,
  TopPage,
  OrderPage,
  OrderConfirmPage,
  AdminLoginPage,
  AdminPage,
}) => {
  return (
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
  );
};

export default AppRoutes;
