import React, { useState, useEffect } from 'react';
import { BrowserRouter, Link } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
// Firebase関連
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from './lib/firebase';

// ---------------------------
// メインアプリコンポーネント
// ---------------------------
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    alert("ログアウトしました");
  };

  // 管理者判定ヘルパー
  const isAdmin = (user) => {
    if (!user) return false;
    const adminEmailsStr = import.meta.env.VITE_ADMIN_EMAIL || '';
    const adminEmails = adminEmailsStr.split(',').map(e => e.trim());
    return adminEmails.includes(user.email);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <BrowserRouter>
      {/* ヘッダーは管理者のみ表示 */}
      {user && isAdmin(user) && (
        <header className="p-4 bg-white shadow-sm flex justify-between items-center fixed top-0 w-full z-10">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bold text-blue-600 text-xl">バースデーソングメーカー</Link>
            <Link to="/admin" className="text-sm font-bold text-gray-600 hover:text-blue-500 bg-gray-100 px-3 py-1 rounded">
              管理者画面へ
            </Link>
            <Link to="/order" className="text-sm font-bold text-gray-600 hover:text-blue-500 bg-amber-100 px-3 py-1 rounded">
              新規オーダー
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.displayName}さん</span>
            <button onClick={handleLogout} className="text-sm text-red-500 underline">ログアウト</button>
          </div>
        </header>
      )}

      <AppRoutes
        user={user}
        isAdmin={isAdmin}
      />
    </BrowserRouter>
  );
}

export default App;