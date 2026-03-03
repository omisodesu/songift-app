import { useParams, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminPage from './AdminPage';

/**
 * Org別管理画面
 * URLパラメータ :orgId でAdminPageをorgスコープで表示する
 */
const OrgAdminPage = () => {
  const { orgId } = useParams();
  const { user, hasOrgAccess, setCurrentOrgId } = useAuth();

  // currentOrgIdをURL同期
  useEffect(() => {
    if (orgId) {
      setCurrentOrgId(orgId);
    }
  }, [orgId, setCurrentOrgId]);

  // orgアクセス権チェック
  if (!hasOrgAccess(orgId)) {
    return <Navigate to="/admin" />;
  }

  return <AdminPage user={user} orgId={orgId} />;
};

export default OrgAdminPage;
