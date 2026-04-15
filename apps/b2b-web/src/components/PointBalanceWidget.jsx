import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

/**
 * 残曲ウィジェット（ヘッダー表示用）
 */
const PointBalanceWidget = ({ orgId }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        const getBillingSummary = httpsCallable(functions, 'getOrgBillingSummary');
        const result = await getBillingSummary({ orgId });
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

  const { availableSongs, reservedSongs, contract } = summary;
  const isLow = availableSongs <= 3 && availableSongs > 0;
  const isEmpty = availableSongs <= 0;

  // 契約期限の表示
  let endDateStr = null;
  if (contract?.endsAt) {
    const d = contract.endsAt.toDate
      ? contract.endsAt.toDate()
      : new Date(contract.endsAt._seconds ? contract.endsAt._seconds * 1000 : contract.endsAt);
    endDateStr = d.toLocaleDateString('ja-JP');
  }

  return (
    <div className={`flex items-center gap-3 text-sm px-3 py-1 rounded ${
      isEmpty ? 'bg-red-100 text-red-700' :
      isLow ? 'bg-yellow-100 text-yellow-700' :
      'bg-blue-50 text-blue-700'
    }`}>
      <span className="font-bold">
        残り{availableSongs}曲
      </span>
      {reservedSongs > 0 && (
        <span className="text-xs">
          (生成中: {reservedSongs}曲)
        </span>
      )}
      {endDateStr && (
        <span className="text-xs text-gray-500">
          期限: {endDateStr}
        </span>
      )}
      {isEmpty && (
        <span className="text-xs font-bold text-red-600 animate-pulse">
          残曲なし
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
