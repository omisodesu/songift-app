import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const TYPE_LABELS = {
  grant: { label: '付与', color: 'text-green-600', sign: '+' },
  purchase: { label: '購入', color: 'text-green-600', sign: '+' },
  reserve: { label: '予約', color: 'text-orange-600', sign: '-' },
  consume: { label: '消費', color: 'text-red-600', sign: '-' },
  release: { label: '返還', color: 'text-blue-600', sign: '+' },
  expire: { label: '失効', color: 'text-gray-500', sign: '-' },
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

      const listFn = httpsCallable(functions, 'listPointTransactions');
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
      const getSummary = httpsCallable(functions, 'getPointSummary');
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">ポイント利用履歴</h1>

        {/* 残高サマリー */}
        {summary && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">利用可能</p>
              <p className="text-2xl font-bold text-blue-600">{summary.available.toLocaleString()}pt</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">残り生成可能</p>
              <p className="text-2xl font-bold text-green-600">{summary.remainingSongs}曲</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">予約中</p>
              <p className="text-lg font-bold text-orange-600">{(summary.pointBalance?.reserved || 0).toLocaleString()}pt</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">累計使用</p>
              <p className="text-lg font-bold text-gray-600">{(summary.pointBalance?.usedTotal || 0).toLocaleString()}pt</p>
            </div>
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
                  <th className="text-right px-4 py-3 text-gray-600">ポイント</th>
                  <th className="text-right px-4 py-3 text-gray-600 hidden md:table-cell">Free</th>
                  <th className="text-right px-4 py-3 text-gray-600 hidden md:table-cell">Paid</th>
                  <th className="text-left px-4 py-3 text-gray-600 hidden md:table-cell">備考</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const typeInfo = TYPE_LABELS[txn.type] || { label: txn.type, color: 'text-gray-600', sign: '' };
                  const dateStr = txn.createdAt
                    ? new Date(txn.createdAt).toLocaleString('ja-JP')
                    : '-';
                  return (
                    <tr key={txn.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs">{dateStr}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${typeInfo.color}`}>{typeInfo.label}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${typeInfo.color}`}>
                        {typeInfo.sign}{txn.amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 hidden md:table-cell">
                        {txn.amountFree || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 hidden md:table-cell">
                        {txn.amountPaid || 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell truncate max-w-[200px]">
                        {txn.description || txn.orderId || '-'}
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
