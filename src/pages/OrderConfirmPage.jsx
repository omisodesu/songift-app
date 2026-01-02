import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { httpsCallable } from "firebase/functions";
import { functions } from '../lib/firebase';

// 3. 注文確認ページ（トークン認証）
const OrderConfirmPage = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Phase1: 署名URL管理
  const [previewSignedUrl, setPreviewSignedUrl] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId || !token) {
        setError('無効なURLです');
        setLoading(false);
        return;
      }

      try {
        const functionUrl = `${import.meta.env.VITE_FUNCTIONS_BASE_URL}/getOrderByToken`;

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, token })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "注文情報の取得に失敗しました");
        }

        setOrder(result.order);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, token]);

  // Phase1: プレビュー音声の署名URL取得
  useEffect(() => {
    if (order && order.previewAudioPath) {
      const fetchPreviewSignedUrl = async () => {
        try {
          const getPreviewSignedUrl = httpsCallable(functions, "getPreviewSignedUrl");
          const result = await getPreviewSignedUrl({ orderId, token });
          setPreviewSignedUrl(result.data.signedUrl);
        } catch (err) {
          console.error("Preview signed URL error:", err);
        }
      };
      fetchPreviewSignedUrl();
    }
  }, [order, orderId, token]);

  // 支払い処理ハンドラ
  const handlePayment = async () => {
    if (!window.confirm('¥500の支払いを完了しますか？')) return;

    setPaymentLoading(true);
    try {
      const functionsUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;
      const response = await fetch(`${functionsUrl}/processPayment`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({orderId: order.id}),
      });

      if (!response.ok) throw new Error('支払い処理に失敗しました');

      alert('支払いが完了しました！MP4動画をメールでお送りします。');
      window.location.reload(); // ページをリロードして支払い完了状態を表示
    } catch (error) {
      console.error('Payment error:', error);
      alert('支払い処理に失敗しました。管理者にお問い合わせください。');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Phase1: 支払い状態チェック
  const isPaid = order?.isPaid || false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">エラー</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link to="/" className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">
            トップページへ
          </Link>
        </div>
      </div>
    );
  }


  const getStatusDisplay = (status) => {
    switch (status) {
      case 'completed':
        return { text: '完成', color: 'bg-green-100 text-green-800', progress: 100 };
      case 'song_selected':
        return { text: '楽曲選定完了', color: 'bg-blue-100 text-blue-800', progress: 90 };
      case 'song_generated':
        return { text: '楽曲確認中', color: 'bg-blue-100 text-blue-800', progress: 80 };
      case 'generating_song':
        return { text: '楽曲生成中', color: 'bg-yellow-100 text-yellow-800', progress: 60 };
      case 'song_failed':
        return { text: '生成失敗', color: 'bg-red-100 text-red-800', progress: 50 };
      case 'song_timeout':
        return { text: 'タイムアウト', color: 'bg-yellow-100 text-yellow-800', progress: 50 };
      case 'processing':
        return { text: '制作中', color: 'bg-yellow-100 text-yellow-800', progress: 40 };
      default:
        return { text: '受付完了', color: 'bg-gray-100 text-gray-800', progress: 20 };
    }
  };

  const statusInfo = getStatusDisplay(order.status);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow">
        <h2 className="text-3xl font-bold text-center mb-6 text-blue-600">
          {order.targetName}様のバースデーソング
        </h2>

        {/* ステータス表示 */}
        <div className="mb-8 p-6 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">ステータス</span>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>

          {/* プログレスバー */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${statusInfo.progress}%` }}
            ></div>
          </div>

          <p className="text-sm text-gray-600 mt-2">
            {order.status === 'completed'
              ? '楽曲が完成しました！下記から聴けます。'
              : order.status === 'processing' || order.status === 'generating_song'
              ? '現在、制作中です。完成までお待ちください。'
              : '注文を受け付けました。制作開始までしばらくお待ちください。'}
          </p>
        </div>

        {/* 注文詳細 */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="font-bold text-gray-800 mb-4">注文内容</h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-600">プラン</dt>
              <dd className="font-bold">{order.plan === 'simple' ? '魔法診断モード' : 'プロモード'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">お名前</dt>
              <dd className="font-bold">{order.targetName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">注文日</dt>
              <dd>{order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleString('ja-JP') : '不明'}</dd>
            </div>
          </dl>
        </div>

        {/* 楽曲プレイヤー（完成時のみ） */}
        {order.status === 'completed' && order.selectedSongUrl && (
          <div className="mb-8 p-6 bg-green-50 rounded-lg border-2 border-green-200">
            <h3 className="font-bold text-green-800 mb-4 text-xl">🎉 完成しました！</h3>
            <audio controls src={order.selectedSongUrl} className="w-full mb-4" />
            <a
              href={order.selectedSongUrl}
              download={`birthday_song_${order.targetName}.mp3`}
              className="block w-full text-center bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold"
            >
              ダウンロード
            </a>
          </div>
        )}

        {/* Phase1: プレビュー音声セクション */}
        {order.previewAudioPath && previewSignedUrl && (
          <div className="mb-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h3 className="font-bold text-blue-800 mb-4 text-lg">🎵 15秒プレビュー（無料）</h3>
            <audio controls src={previewSignedUrl} className="w-full" />
            <p className="text-xs text-gray-500 mt-2">※ 冒頭15秒のプレビューです</p>
          </div>
        )}

        {/* 支払いボタン（未払い時のみ表示） */}
        {!isPaid && order.previewAudioPath && (
          <div className="mb-8 p-6 bg-yellow-50 rounded-lg border-2 border-yellow-300">
            <h3 className="font-bold text-yellow-800 mb-4 text-lg">💳 お支払い</h3>
            <p className="text-sm text-gray-700 mb-4">
              フル動画（MP4）をメールでお届けします。
            </p>
            <button
              onClick={handlePayment}
              disabled={paymentLoading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
            >
              {paymentLoading ? '処理中...' : '¥500を支払う'}
            </button>
          </div>
        )}

        {/* 支払い完了メッセージ（支払い済みの場合） */}
        {isPaid && (
          <div className="mb-8 p-6 bg-green-50 rounded-lg border-2 border-green-200">
            <h3 className="font-bold text-green-800 mb-4 text-lg">✅ お支払い完了</h3>
            <p className="text-sm text-gray-700">
              フル動画（MP4）をメールでお送りしました。<br />
              メールをご確認ください。
            </p>
          </div>
        )}

        <div className="text-center">
          <Link to="/" className="text-blue-500 underline">トップページへ戻る</Link>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmPage;
