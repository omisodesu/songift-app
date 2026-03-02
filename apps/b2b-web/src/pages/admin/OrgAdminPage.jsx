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
  const { user, hasOrgAccess, setCurrentOrgId, supportSession } = useAuth();

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

  return (
    <>
      {/* サポートモードバナー（ヘッダーとは別に、コンテンツ上部にも表示） */}
      {supportSession && supportSession.targetOrgId === orgId && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-center">
          <span className="text-red-700 text-sm font-medium">
            サポートモードで操作中です（理由: {supportSession.reason}）
          </span>
        </div>
      )}
      <AdminPage user={user} orgId={orgId} />
    </>
  );
};

export default OrgAdminPage;
