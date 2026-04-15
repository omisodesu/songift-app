import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import AdminPage from './AdminPage';

const PLAN_OPTIONS = [
  { value: 'light', label: 'ライト（22曲）', songs: 22 },
  { value: 'standard', label: 'スタンダード（66曲）', songs: 66 },
  { value: 'premium', label: 'プレミアム（110曲）', songs: 110 },
];

const PLAN_LABELS = {
  light: 'ライト',
  standard: 'スタンダード',
  premium: 'プレミアム',
};

/**
 * Super Admin ダッシュボード
 * - 全org一覧 + org管理
 * - 全orders横断ビュー
 * - サポートモード開始
 * - 請求管理（プラン購入・追加購入・補助付与・請求設定）
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

  // 請求管理
  const [billingOrgId, setBillingOrgId] = useState(null);
  const [billingTab, setBillingTab] = useState('actions'); // 'actions' | 'settings'
  const [billingLoading, setBillingLoading] = useState(false);

  // プラン購入フォーム
  const [planType, setPlanType] = useState('light');
  const [planNote, setPlanNote] = useState('');

  // 追加購入フォーム
  const [addonQuantity, setAddonQuantity] = useState('');
  const [addonNote, setAddonNote] = useState('');

  // 補助付与フォーム
  const [grantQuantity, setGrantQuantity] = useState('');
  const [grantReason, setGrantReason] = useState('');

  // 請求設定フォーム
  const [billingSettings, setBillingSettings] = useState(null);

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

  // 請求管理の開閉
  const toggleBilling = async (orgId) => {
    if (billingOrgId === orgId) {
      setBillingOrgId(null);
      setBillingSettings(null);
      return;
    }
    setBillingOrgId(orgId);
    setBillingTab('actions');
    // 請求設定を取得
    try {
      const getSummary = httpsCallable(functions, 'getOrgBillingSummary');
      const result = await getSummary({ orgId });
      setBillingSettings(result.data.billingSettings);
    } catch (e) {
      console.error('Failed to fetch billing settings:', e);
      setBillingSettings(null);
    }
  };

  // プラン購入登録
  const handleRecordBasePlan = async (orgId, orgName) => {
    const plan = PLAN_OPTIONS.find(p => p.value === planType);
    if (!confirm(`${orgName} に ${plan.label} を登録しますか？\n残曲は ${plan.songs}曲 にリセットされ、契約期限は本日から1年間に設定されます。`)) return;
    setBillingLoading(true);
    try {
      const fn = httpsCallable(functions, 'recordBasePlanPurchase');
      await fn({ orgId, planType, note: planNote.trim() || null });
      alert(`${plan.label} を登録しました`);
      setPlanNote('');
    } catch (error) {
      alert(`登録に失敗しました: ${error.message}`);
    } finally {
      setBillingLoading(false);
    }
  };

  // 追加購入登録
  const handleRecordAddon = async (orgId, orgName) => {
    const qty = parseInt(addonQuantity, 10);
    if (!qty || qty <= 0) return alert('正の整数を入力してください');
    if (!confirm(`${orgName} に ${qty}曲 の追加購入を登録しますか？`)) return;
    setBillingLoading(true);
    try {
      const fn = httpsCallable(functions, 'recordAddonPurchase');
      await fn({ orgId, quantity: qty, note: addonNote.trim() || null });
      alert(`${qty}曲の追加購入を登録しました`);
      setAddonQuantity('');
      setAddonNote('');
    } catch (error) {
      alert(`登録に失敗しました: ${error.message}`);
    } finally {
      setBillingLoading(false);
    }
  };

  // 補助付与
  const handleGrantSupport = async (orgId, orgName) => {
    const qty = parseInt(grantQuantity, 10);
    if (!qty || qty <= 0) return alert('正の整数を入力してください');
    if (!grantReason.trim()) return alert('理由を入力してください');
    if (!confirm(`${orgName} に ${qty}曲 を補助付与しますか？\n理由: ${grantReason.trim()}`)) return;
    setBillingLoading(true);
    try {
      const fn = httpsCallable(functions, 'grantSupportSongs');
      await fn({ orgId, quantity: qty, reason: grantReason.trim() });
      alert(`${qty}曲を補助付与しました`);
      setGrantQuantity('');
      setGrantReason('');
    } catch (error) {
      alert(`付与に失敗しました: ${error.message}`);
    } finally {
      setBillingLoading(false);
    }
  };

  // 請求設定保存
  const handleSaveBillingSettings = async (orgId, orgName) => {
    if (!billingSettings) return;
    if (!confirm(`${orgName} の請求設定を保存しますか？`)) return;
    setBillingLoading(true);
    try {
      const fn = httpsCallable(functions, 'updateOrgBillingSettings');
      await fn({ orgId, billingSettings });
      alert('請求設定を保存しました');
    } catch (error) {
      alert(`保存に失敗しました: ${error.message}`);
    } finally {
      setBillingLoading(false);
    }
  };

  // 請求設定の部分更新ヘルパー
  const updateBS = (path, value) => {
    setBillingSettings(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
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
                        <div className="flex gap-3 mt-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {org.status === 'active' ? '有効' : '停止中'}
                          </span>
                          <span className="text-xs text-gray-500">
                            注文数: {orgOrderCounts[org.id] ?? '...'}
                          </span>
                          <span className="text-xs text-blue-600 font-bold">
                            残曲: {org.songBalance?.availableSongs ?? 0}曲
                            {org.contract?.currentPlan && ` / ${PLAN_LABELS[org.contract.currentPlan] || org.contract.currentPlan}`}
                          </span>
                          {org.songBalance?.reservedSongs > 0 && (
                            <span className="text-xs text-orange-600">生成中: {org.songBalance.reservedSongs}曲</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {/* メンバー招待ボタン */}
                        <button
                          onClick={() => setInviteOrgId(inviteOrgId === org.id ? null : org.id)}
                          className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200"
                        >
                          メンバー招待
                        </button>
                        {/* 請求管理ボタン */}
                        <button
                          onClick={() => toggleBilling(org.id)}
                          className={`text-xs px-3 py-1.5 rounded ${
                            billingOrgId === org.id ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          請求管理
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

                    {/* 請求管理パネル */}
                    {billingOrgId === org.id && (
                      <div className="mt-4 bg-green-50 rounded p-4">
                        <h4 className="text-sm font-bold mb-3">請求管理 — {org.name}</h4>

                        {/* タブ: アクション / 設定 */}
                        <div className="flex gap-2 mb-4 border-b border-green-200">
                          <button
                            onClick={() => setBillingTab('actions')}
                            className={`px-3 py-1 text-xs font-bold border-b-2 ${
                              billingTab === 'actions' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'
                            }`}
                          >
                            購入・付与
                          </button>
                          <button
                            onClick={() => setBillingTab('settings')}
                            className={`px-3 py-1 text-xs font-bold border-b-2 ${
                              billingTab === 'settings' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'
                            }`}
                          >
                            請求設定
                          </button>
                        </div>

                        {/* アクションタブ */}
                        {billingTab === 'actions' && (
                          <div className="space-y-4">
                            {/* プラン購入登録 */}
                            <div className="bg-white rounded p-3 border">
                              <h5 className="text-xs font-bold text-gray-700 mb-2">基本プラン購入登録</h5>
                              <div className="flex gap-2 items-end flex-wrap">
                                <div>
                                  <label className="text-xs text-gray-500">プラン</label>
                                  <select
                                    value={planType}
                                    onChange={(e) => setPlanType(e.target.value)}
                                    className="border rounded px-3 py-1.5 text-sm block"
                                  >
                                    {PLAN_OPTIONS.map(p => (
                                      <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                  <label className="text-xs text-gray-500">備考（任意）</label>
                                  <input
                                    type="text"
                                    value={planNote}
                                    onChange={(e) => setPlanNote(e.target.value)}
                                    placeholder="備考"
                                    className="border rounded px-3 py-1.5 w-full text-sm"
                                  />
                                </div>
                                <button
                                  onClick={() => handleRecordBasePlan(org.id, org.name)}
                                  disabled={billingLoading}
                                  className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                                >
                                  {billingLoading ? '処理中...' : '登録'}
                                </button>
                              </div>
                            </div>

                            {/* 追加購入登録 */}
                            <div className="bg-white rounded p-3 border">
                              <h5 className="text-xs font-bold text-gray-700 mb-2">追加曲購入登録</h5>
                              <div className="flex gap-2 items-end flex-wrap">
                                <div className="w-24">
                                  <label className="text-xs text-gray-500">曲数</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={addonQuantity}
                                    onChange={(e) => setAddonQuantity(e.target.value)}
                                    placeholder="例: 10"
                                    className="border rounded px-3 py-1.5 w-full text-sm"
                                  />
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                  <label className="text-xs text-gray-500">備考（任意）</label>
                                  <input
                                    type="text"
                                    value={addonNote}
                                    onChange={(e) => setAddonNote(e.target.value)}
                                    placeholder="備考"
                                    className="border rounded px-3 py-1.5 w-full text-sm"
                                  />
                                </div>
                                <button
                                  onClick={() => handleRecordAddon(org.id, org.name)}
                                  disabled={billingLoading || !addonQuantity}
                                  className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                                >
                                  {billingLoading ? '処理中...' : '登録'}
                                </button>
                              </div>
                            </div>

                            {/* 補助付与 */}
                            <div className="bg-white rounded p-3 border">
                              <h5 className="text-xs font-bold text-gray-700 mb-2">補助曲付与</h5>
                              <div className="flex gap-2 items-end flex-wrap">
                                <div className="w-24">
                                  <label className="text-xs text-gray-500">曲数</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={grantQuantity}
                                    onChange={(e) => setGrantQuantity(e.target.value)}
                                    placeholder="例: 5"
                                    className="border rounded px-3 py-1.5 w-full text-sm"
                                  />
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                  <label className="text-xs text-gray-500">理由（必須）</label>
                                  <input
                                    type="text"
                                    value={grantReason}
                                    onChange={(e) => setGrantReason(e.target.value)}
                                    placeholder="例: 生成エラーの補填"
                                    className="border rounded px-3 py-1.5 w-full text-sm"
                                  />
                                </div>
                                <button
                                  onClick={() => handleGrantSupport(org.id, org.name)}
                                  disabled={billingLoading || !grantQuantity || !grantReason.trim()}
                                  className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                                >
                                  {billingLoading ? '処理中...' : '付与'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 設定タブ */}
                        {billingTab === 'settings' && billingSettings && (
                          <div className="space-y-4">
                            {/* 価格設定 */}
                            <div className="bg-white rounded p-3 border">
                              <h5 className="text-xs font-bold text-gray-700 mb-2">プラン価格（税別・円）</h5>
                              <div className="grid grid-cols-3 gap-2">
                                {['light', 'standard', 'premium'].map(plan => (
                                  <div key={plan}>
                                    <label className="text-xs text-gray-500">{PLAN_LABELS[plan]}</label>
                                    <input
                                      type="number"
                                      value={billingSettings.basePlanPrices?.[plan] ?? ''}
                                      onChange={(e) => updateBS(`basePlanPrices.${plan}`, parseInt(e.target.value, 10) || 0)}
                                      className="border rounded px-2 py-1 w-full text-sm"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2">
                                <label className="text-xs text-gray-500">追加1曲単価</label>
                                <input
                                  type="number"
                                  value={billingSettings.addonSongPriceYen ?? ''}
                                  onChange={(e) => updateBS('addonSongPriceYen', parseInt(e.target.value, 10) || 0)}
                                  className="border rounded px-2 py-1 w-32 text-sm"
                                />
                              </div>
                            </div>

                            {/* 販売チャネル */}
                            <div className="bg-white rounded p-3 border">
                              <h5 className="text-xs font-bold text-gray-700 mb-2">販売チャネル</h5>
                              <div className="flex gap-4 items-end">
                                <div>
                                  <select
                                    value={billingSettings.salesChannel || 'direct'}
                                    onChange={(e) => updateBS('salesChannel', e.target.value)}
                                    className="border rounded px-3 py-1.5 text-sm"
                                  >
                                    <option value="direct">直販</option>
                                    <option value="agency">代理店</option>
                                  </select>
                                </div>
                                {billingSettings.salesChannel === 'agency' && (
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-500">代理店名</label>
                                    <input
                                      type="text"
                                      value={billingSettings.agencyName || ''}
                                      onChange={(e) => updateBS('agencyName', e.target.value || null)}
                                      placeholder="代理店名"
                                      className="border rounded px-3 py-1.5 w-full text-sm"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 代理店還元率 */}
                            <div className="bg-white rounded p-3 border">
                              <h5 className="text-xs font-bold text-gray-700 mb-2">代理店還元率（%）</h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {['light', 'standard', 'premium'].map(plan => (
                                  <div key={plan}>
                                    <label className="text-xs text-gray-500">{PLAN_LABELS[plan]}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={billingSettings.agentPayoutRate?.basePlans?.[plan] ?? 0}
                                      onChange={(e) => updateBS(`agentPayoutRate.basePlans.${plan}`, parseFloat(e.target.value) || 0)}
                                      className="border rounded px-2 py-1 w-full text-sm"
                                    />
                                  </div>
                                ))}
                                <div>
                                  <label className="text-xs text-gray-500">追加購入</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={billingSettings.agentPayoutRate?.addonSong ?? 0}
                                    onChange={(e) => updateBS('agentPayoutRate.addonSong', parseFloat(e.target.value) || 0)}
                                    className="border rounded px-2 py-1 w-full text-sm"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 保存ボタン */}
                            <button
                              onClick={() => handleSaveBillingSettings(org.id, org.name)}
                              disabled={billingLoading}
                              className="bg-green-600 text-white px-6 py-2 rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                            >
                              {billingLoading ? '保存中...' : '設定を保存'}
                            </button>
                          </div>
                        )}
                        {billingTab === 'settings' && !billingSettings && (
                          <p className="text-sm text-gray-500">設定を読み込み中...</p>
                        )}
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
