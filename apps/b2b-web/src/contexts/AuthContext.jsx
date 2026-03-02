import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../lib/firebase';

const AuthContext = createContext(null);

/**
 * 認証・認可コンテキストプロバイダー
 *
 * Custom Claimsベースのマルチテナント認可を管理する。
 * - user: Firebase Auth ユーザー
 * - membership: { role, orgIds, organizations } | null
 * - currentOrgId: 現在選択中のorg
 * - supportSession: サポートモード情報
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [supportSession, setSupportSession] = useState(null);

  // メンバーシップ取得
  const fetchMembership = useCallback(async () => {
    if (!auth.currentUser) {
      setMembership(null);
      return null;
    }

    try {
      const getMyMembership = httpsCallable(functions, 'getMyMembership');
      const result = await getMyMembership();
      setMembership(result.data);
      return result.data;
    } catch (error) {
      console.error('[AuthContext] Failed to fetch membership:', error);
      setMembership(null);
      return null;
    }
  }, []);

  // Auth状態監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await fetchMembership();
      } else {
        setMembership(null);
        setCurrentOrgId(null);
        setSupportSession(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchMembership]);

  // ログアウト
  const logout = useCallback(async () => {
    // サポートモード中ならセッション終了
    if (supportSession) {
      try {
        const endSupportSessionFn = httpsCallable(functions, 'endSupportSession');
        await endSupportSessionFn({ sessionId: supportSession.sessionId });
      } catch (e) {
        console.error('[AuthContext] Failed to end support session on logout:', e);
      }
    }

    setSupportSession(null);
    setCurrentOrgId(null);
    setMembership(null);
    await signOut(auth);
  }, [supportSession]);

  // ヘルパー関数
  const isSuperAdmin = useCallback(() => {
    return membership?.role === 'super_admin';
  }, [membership]);

  const isOrgAdmin = useCallback(() => {
    return membership?.role === 'org_admin';
  }, [membership]);

  const hasOrgAccess = useCallback((orgId) => {
    if (!membership) return false;
    if (membership.role === 'super_admin') return true;
    return membership.orgIds?.includes(orgId) || false;
  }, [membership]);

  const hasMembership = useCallback(() => {
    return membership?.role != null;
  }, [membership]);

  // サポートモード開始
  const startSupport = useCallback(async (targetOrgId, reason) => {
    const startSupportSessionFn = httpsCallable(functions, 'startSupportSession');
    const result = await startSupportSessionFn({ targetOrgId, reason });
    const orgName = membership?.organizations?.find(o => o.id === targetOrgId)?.name || targetOrgId;
    setSupportSession({
      sessionId: result.data.sessionId,
      targetOrgId,
      orgName,
      reason,
    });
    setCurrentOrgId(targetOrgId);
    return result.data.sessionId;
  }, [membership]);

  // サポートモード終了
  const endSupport = useCallback(async () => {
    if (!supportSession) return;
    const endSupportSessionFn = httpsCallable(functions, 'endSupportSession');
    await endSupportSessionFn({ sessionId: supportSession.sessionId });
    setSupportSession(null);
    setCurrentOrgId(null);
  }, [supportSession]);

  // IDトークン取得（API呼び出し用）
  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  // Custom Claims強制リフレッシュ
  const refreshClaims = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.getIdToken(true);
    await fetchMembership();
  }, [fetchMembership]);

  const value = {
    user,
    membership,
    loading,
    currentOrgId,
    setCurrentOrgId,
    supportSession,
    logout,
    isSuperAdmin,
    isOrgAdmin,
    hasOrgAccess,
    hasMembership,
    startSupport,
    endSupport,
    getIdToken,
    refreshClaims,
    fetchMembership,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 認証コンテキストフック
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
