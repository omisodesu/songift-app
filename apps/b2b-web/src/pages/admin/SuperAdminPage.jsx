import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import AdminPage from './AdminPage';

/**
 * Super Admin ダッシュボード
 * - 全org一覧 + org管理
 * - 全orders横断ビュー
 * - サポートモード開始
 */
const SuperAdminPage = () => {
  const navigate = useNavigate();
  const { user, startSupport, endSupport, supportSession } = useAuth();

  const [organizations, setOrganizations] = useState([]);
  const [orgOrderCounts, setOrgOrderCounts] = useState({});
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [activeTab, setActiveTab] = useState('orgs'); // 'orgs' | 'all-orders'

  // org作成フォーム
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // メンバー招待フォーム
  const [inviteOrgId, setInviteOrgId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('org_member');
  const [inviting, setInviting] = useState(false);

  // サポートモード開始フォーム
  const [supportTargetOrgId, setSupportTargetOrgId] = useState(null);
  const [supportReason, setSupportReason] = useState('');
  const [startingSupport, setStartingSupport] = useState(false);

  // organizations購読
  useEffect(() => {
    const q = query(collection(db, 'organizations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrganizations(orgs);
      setLoadingOrgs(false);
    });
    return () => unsubscribe();
  }, []);

  // 各orgの注文数を取得
  useEffect(() => {
    if (organizations.length === 0) return;

    const fetchCounts = async () => {
      const counts = {};
      for (const org of organizations) {
        const q = query(
          collection(db, 'orders'),
          where('orgId', '==', org.id)
        );
        const snapshot = await getDocs(q);
        counts[org.id] = snapshot.size;
      }
      setOrgOrderCounts(counts);
    };

    fetchCounts();
  }, [organizations]);

  // org作成
  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreatingOrg(true);
    try {
      const createOrganization = httpsCallable(functions, 'createOrganization');
      const result = await createOrganization({ name: newOrgName.trim() });
      alert(`組織「${newOrgName.trim()}」を作成しました (ID: ${result.data.orgId})`);
      setNewOrgName('');
      setShowCreateOrg(false);
    } catch (error) {
      alert(`組織の作成に失敗しました: ${error.message}`);
    } finally {
      setCreatingOrg(false);
    }
  };

  // メンバー招待
  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !inviteOrgId) return;
    setInviting(true);
    try {
      const inviteMember = httpsCallable(functions, 'inviteMember');
      await inviteMember({ email: inviteEmail.trim(), orgId: inviteOrgId, role: inviteRole });
      alert(`${inviteEmail.trim()} を招待しました`);
      setInviteEmail('');
      setInviteOrgId(null);
    } catch (error) {
      alert(`招待に失敗しました: ${error.message}`);
    } finally {
      setInviting(false);
    }
  };

  // サポートモード開始
  const handleStartSupport = async () => {
    if (!supportTargetOrgId || !supportReason.trim()) return;
    setStartingSupport(true);
    try {
      await startSupport(supportTargetOrgId, supportReason.trim());
      navigate(`/admin/org/${supportTargetOrgId}`);
    } catch (error) {
      alert(`サポートモードの開始に失敗しました: ${error.message}`);
    } finally {
      setStartingSupport(false);
    }
  };

  // サポートモード終了
  const handleEndSupport = async () => {
    try {
      await endSupport();
    } catch (error) {
      alert(`サポートモードの終了に失敗しました: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* サポートモードバナー */}
      {supportSession && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold">
            [サポートモード] {supportSession.orgName}を操作中 — 理由: {supportSession.reason}
          </span>
          <button
            onClick={handleEndSupport}
            className="text-xs bg-white text-red-600 px-3 py-1 rounded font-bold hover:bg-red-50"
          >
            セッション終了
          </button>
        </div>
      )}

      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Super Admin ダッシュボード</h1>

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('orgs')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
              activeTab === 'orgs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            組織管理
          </button>
          <button
            onClick={() => setActiveTab('all-orders')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
              activeTab === 'all-orders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            全注文一覧
          </button>
        </div>

        {/* 組織管理タブ */}
        {activeTab === 'orgs' && (
          <div>
            {/* org作成ボタン */}
            <div className="mb-6">
              {!showCreateOrg ? (
                <button
                  onClick={() => setShowCreateOrg(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700"
                >
                  + 新規組織作成
                </button>
              ) : (
                <div className="bg-white border rounded-lg p-4 max-w-md">
                  <h3 className="font-bold mb-3">新規組織作成</h3>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="組織名"
                    className="border rounded px-3 py-2 w-full mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateOrg}
                      disabled={creatingOrg || !newOrgName.trim()}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingOrg ? '作成中...' : '作成'}
                    </button>
                    <button
                      onClick={() => { setShowCreateOrg(false); setNewOrgName(''); }}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* org一覧 */}
            {loadingOrgs ? (
              <p className="text-gray-500">組織情報を読み込み中...</p>
            ) : organizations.length === 0 ? (
              <p className="text-gray-500">組織がまだありません。</p>
            ) : (
              <div className="grid gap-4">
                {organizations.map((org) => (
                  <div key={org.id} className="bg-white border rounded-lg p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{org.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">ID: {org.id}</p>
                        <div className="flex gap-3 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {org.status === 'active' ? '有効' : '停止中'}
                          </span>
                          <span className="text-xs text-gray-500">
                            注文数: {orgOrderCounts[org.id] ?? '...'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {/* メンバー招待ボタン */}
                        <button
                          onClick={() => setInviteOrgId(inviteOrgId === org.id ? null : org.id)}
                          className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200"
                        >
                          メンバー招待
                        </button>
                        {/* サポートモードボタン */}
                        <button
                          onClick={() => setSupportTargetOrgId(supportTargetOrgId === org.id ? null : org.id)}
                          className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded hover:bg-amber-200"
                        >
                          サポートモード
                        </button>
                        {/* org管理画面へ */}
                        <button
                          onClick={() => navigate(`/admin/org/${org.id}`)}
                          className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-200"
                        >
                          管理画面
                        </button>
                      </div>
                    </div>

                    {/* メンバー招待フォーム */}
                    {inviteOrgId === org.id && (
                      <div className="mt-4 bg-gray-50 rounded p-4">
                        <h4 className="text-sm font-bold mb-2">メンバー招待 — {org.name}</h4>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">メールアドレス</label>
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="user@example.com"
                              className="border rounded px-3 py-1.5 w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">ロール</label>
                            <select
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value)}
                              className="border rounded px-3 py-1.5 text-sm"
                            >
                              <option value="org_member">メンバー</option>
                              <option value="org_admin">管理者</option>
                            </select>
                          </div>
                          <button
                            onClick={handleInviteMember}
                            disabled={inviting || !inviteEmail.trim()}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                          >
                            {inviting ? '招待中...' : '招待'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* サポートモード開始フォーム */}
                    {supportTargetOrgId === org.id && (
                      <div className="mt-4 bg-amber-50 rounded p-4">
                        <h4 className="text-sm font-bold mb-2">サポートモード開始 — {org.name}</h4>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">理由（5文字以上）</label>
                            <input
                              type="text"
                              value={supportReason}
                              onChange={(e) => setSupportReason(e.target.value)}
                              placeholder="例: 注文の確認依頼対応"
                              className="border rounded px-3 py-1.5 w-full text-sm"
                            />
                          </div>
                          <button
                            onClick={handleStartSupport}
                            disabled={startingSupport || supportReason.trim().length < 5}
                            className="bg-amber-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
                          >
                            {startingSupport ? '開始中...' : '開始'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 全注文一覧タブ */}
        {activeTab === 'all-orders' && (
          <AdminPage user={user} orgId={null} />
        )}
      </div>
    </div>
  );
};

export default SuperAdminPage;
