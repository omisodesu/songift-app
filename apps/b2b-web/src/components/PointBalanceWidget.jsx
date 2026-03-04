import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * ポイント残高ウィジェット（ヘッダー表示用）
 */
const PointBalanceWidget = ({ orgId }) => {
  const { isSuperAdmin } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        const getPointSummary = httpsCallable(functions, 'getPointSummary');
        const result = await getPointSummary({ orgId });
        setSummary(result.data);
      } catch (e) {
        console.error('[PointBalanceWidget] Failed to fetch:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [orgId]);

  if (loading || !summary) return null;

  const { available, remainingSongs, contractEndDate } = summary;
  const isLow = available <= 1000 && available > 0;
  const isEmpty = available <= 0;

  // 契約期限の表示
  let endDateStr = null;
  if (contractEndDate) {
    const d = contractEndDate.toDate ? contractEndDate.toDate() : new Date(contractEndDate._seconds ? contractEndDate._seconds * 1000 : contractEndDate);
    endDateStr = d.toLocaleDateString('ja-JP');
  }

  return (
    <div className={`flex items-center gap-3 text-sm px-3 py-1 rounded ${
      isEmpty ? 'bg-red-100 text-red-700' :
      isLow ? 'bg-yellow-100 text-yellow-700' :
      'bg-blue-50 text-blue-700'
    }`}>
      <span className="font-bold">
        残高: {available.toLocaleString()}pt
      </span>
      <span className="text-xs">
        (残り{remainingSongs}曲)
      </span>
      {endDateStr && (
        <span className="text-xs text-gray-500">
          期限: {endDateStr}
        </span>
      )}
      {isEmpty && (
        <span className="text-xs font-bold text-red-600 animate-pulse">
          ポイント不足
        </span>
      )}
      {isLow && !isEmpty && (
        <span className="text-xs font-bold text-yellow-600">
          残りわずか
        </span>
      )}
    </div>
  );
};

export default PointBalanceWidget;
