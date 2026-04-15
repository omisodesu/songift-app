import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const TYPE_LABELS = {
  base_plan_purchase: { label: 'プラン購入', color: 'text-green-600', sign: '+' },
  addon_purchase:     { label: '追加購入',   color: 'text-green-600', sign: '+' },
  support_grant:      { label: '補助付与',   color: 'text-green-600', sign: '+' },
  reserve:            { label: '予約',       color: 'text-orange-600', sign: '-' },
  consume:            { label: '消費',       color: 'text-red-600',   sign: '-' },
  release:            { label: '返還',       color: 'text-blue-600',  sign: '+' },
  expire:             { label: '失効',       color: 'text-gray-500',  sign: '-' },
};

const PLAN_LABELS = {
  light: 'ライト',
  standard: 'スタンダード',
  premium: 'プレミアム',
};

const PointHistoryPage = ({ orgId }) => {
  const { currentOrgId, membership } = useAuth();
  const effectiveOrgId = orgId || currentOrgId || (membership?.orgIds?.length === 1 ? membership.orgIds[0] : null);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [summary, setSummary] = useState(null);

  const fetchTransactions = useCallback(async (cursor = null, append = false) => {
    if (!effectiveOrgId) return;

    try {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const listFn = httpsCallable(functions, 'listOrgBillingTransactions');
      const params = { orgId: effectiveOrgId, pageSize: 20 };
      if (filterType) params.type = filterType;
      if (cursor) params.cursor = cursor;

      const result = await listFn(params);

      if (append) {
        setTransactions(prev => [...prev, ...result.data.transactions]);
      } else {
        setTransactions(result.data.transactions);
      }
      setNextCursor(result.data.nextCursor);
    } catch (e) {
      console.error('[PointHistoryPage] Failed to fetch:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [effectiveOrgId, filterType]);

  const fetchSummary = useCallback(async () => {
    if (!effectiveOrgId) return;
    try {
      const getSummary = httpsCallable(functions, 'getOrgBillingSummary');
      const result = await getSummary({ orgId: effectiveOrgId });
      setSummary(result.data);
    } catch (e) {
      console.error('[PointHistoryPage] Failed to fetch summary:', e);
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, [fetchTransactions, fetchSummary]);

  if (!effectiveOrgId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        組織が選択されていません
      </div>
    );
  }

  // 契約期間表示
  const formatDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = dateVal.toDate
      ? dateVal.toDate()
      : new Date(dateVal._seconds ? dateVal._seconds * 1000 : dateVal);
    return d.toLocaleDateString('ja-JP');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">残曲・請求履歴</h1>

        {/* 残高サマリー */}
        {summary && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">利用可能</p>
                <p className="text-2xl font-bold text-blue-600">{summary.availableSongs}曲</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">生成中</p>
                <p className="text-lg font-bold text-orange-600">{summary.reservedSongs}曲</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">累計消費</p>
                <p className="text-lg font-bold text-gray-600">{summary.usedSongsTotal}曲</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">累計失効</p>
                <p className="text-lg font-bold text-gray-400">{summary.expiredSongsTotal || 0}曲</p>
              </div>
            </div>
            {summary.contract?.currentPlan && (
              <div className="border-t pt-3 flex gap-6 text-sm text-gray-600">
                <span>契約プラン: <span className="font-bold">{PLAN_LABELS[summary.contract.currentPlan] || summary.contract.currentPlan}</span></span>
                <span>開始: {formatDate(summary.contract.startedAt)}</span>
                <span>終了: {formatDate(summary.contract.endsAt)}</span>
                <span>プラン曲数: {summary.contract.includedSongs}曲</span>
              </div>
            )}
          </div>
        )}

        {/* フィルタ */}
        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterType('')}
            className={`px-3 py-1 rounded text-sm ${!filterType ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            すべて
          </button>
          {Object.entries(TYPE_LABELS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`px-3 py-1 rounded text-sm ${filterType === key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 取引一覧 */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">取引履歴がありません</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600">日時</th>
                  <th className="text-left px-4 py-3 text-gray-600">種別</th>
                  <th className="text-right px-4 py-3 text-gray-600">曲数</th>
                  <th className="text-right px-4 py-3 text-gray-600 hidden md:table-cell">金額(税別)</th>
                  <th className="text-left px-4 py-3 text-gray-600 hidden md:table-cell">備考</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const typeInfo = TYPE_LABELS[txn.type] || { label: txn.type, color: 'text-gray-600', sign: '' };
                  const dateStr = txn.createdAt
                    ? new Date(txn.createdAt).toLocaleString('ja-JP')
                    : '-';
                  const description = txn.note || txn.reason || txn.description ||
                    (txn.planType ? `${PLAN_LABELS[txn.planType] || txn.planType}プラン` : '') ||
                    txn.orderId || '-';
                  return (
                    <tr key={txn.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs">{dateStr}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${typeInfo.color}`}>{typeInfo.label}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${typeInfo.color}`}>
                        {typeInfo.sign}{txn.quantity || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 hidden md:table-cell">
                        {txn.amountYen != null ? `${txn.amountYen.toLocaleString()}円` : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell truncate max-w-[200px]">
                        {description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {nextCursor && (
              <div className="text-center py-4 border-t">
                <button
                  onClick={() => fetchTransactions(nextCursor, true)}
                  disabled={loadingMore}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  {loadingMore ? '読み込み中...' : 'もっと見る'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PointHistoryPage;
