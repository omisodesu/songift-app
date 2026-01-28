import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { httpsCallable } from "firebase/functions";
import { functions } from '../lib/firebase';
import { track } from '../lib/analytics';
import FeedbackForm from '../components/feedback/FeedbackForm';
import InquiryModal from '../components/feedback/InquiryModal';
import { useFeedbackExposure } from '../hooks/useFeedbackExposure';
import { FEEDBACK_CHANNELS } from '../lib/feedbackApi';

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

  // 2曲選択用の状態
  const [previewSignedUrls, setPreviewSignedUrls] = useState([]);
  const [selectLoading, setSelectLoading] = useState(false);

  // 問い合わせモーダル
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

  // プレビュー計測用ref（重複送信防止）
  const previewAudioRef = useRef(null);
  const previewPlayTracked = useRef(false);
  const previewCompleteTracked = useRef(false);
  const previewPauseTracked = useRef(false);
  const lastTimeRef = useRef(0);

  // プレビュー再生開始ハンドラ
  const handlePreviewPlay = useCallback(() => {
    if (!previewPlayTracked.current) {
      track('preview_play', {
        content_type: 'audio',
        page: 'order_confirm',
      });
      previewPlayTracked.current = true;
    }
  }, []);

  // プレビュー再生時間更新ハンドラ（15秒到達チェック）
  const handlePreviewTimeUpdate = useCallback((e) => {
    const currentTime = e.target.currentTime;
    lastTimeRef.current = currentTime;

    // 15秒以上に到達したら preview_complete を送信
    if (currentTime >= 15 && !previewCompleteTracked.current) {
      track('preview_complete', {
        content_type: 'audio',
        page: 'order_confirm',
        listen_seconds: 15,
      });
      previewCompleteTracked.current = true;
    }
  }, []);

  // プレビュー一時停止ハンドラ（15秒未満で停止した場合）
  const handlePreviewPause = useCallback(() => {
    const currentTime = lastTimeRef.current;
    // 15秒未満で停止し、まだpauseイベントを送っていない場合
    if (currentTime < 15 && !previewPauseTracked.current && previewPlayTracked.current) {
      track('preview_pause', {
        content_type: 'audio',
        page: 'order_confirm',
        listen_seconds: Math.floor(currentTime),
      });
      previewPauseTracked.current = true;
    }
  }, []);

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

  // Phase1: プレビュー音声の署名URL取得（1曲選択後）
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

  // 2曲のプレビュー署名URL取得（previews_ready状態時）
  useEffect(() => {
    if (order?.status === "previews_ready" && order.generatedSongs && order.generatedSongs.length > 0) {
      const fetchUrls = async () => {
        const urls = await Promise.all(
          order.generatedSongs.map(async (song, index) => {
            try {
              const getPreviewUrl = httpsCallable(functions, "getPreviewSignedUrlBySongIndex");
              const result = await getPreviewUrl({ orderId, token, songIndex: index });
              return result.data.signedUrl;
            } catch (err) {
              console.error(`Failed to get preview URL for song ${index}:`, err);
              return null;
            }
          })
        );
        setPreviewSignedUrls(urls);
      };
      fetchUrls();
    }
  }, [order, orderId, token]);

  // 曲選択ハンドラ
  const handleSelectSong = async (songIndex) => {
    if (!window.confirm('この曲を選択しますか？選択後は変更できません。')) return;

    setSelectLoading(true);
    try {
      const selectSong = httpsCallable(functions, "selectSong");
      await selectSong({ orderId, token, selectedSongIndex: songIndex });
      alert('曲を選択しました！');
      window.location.reload();
    } catch (error) {
      console.error('Selection error:', error);
      alert('選択に失敗しました: ' + error.message);
    } finally {
      setSelectLoading(false);
    }
  };

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

  // フィードバック表示制御
  const { shouldShow: shouldShowFeedback, markShown: markFeedbackShown } = useFeedbackExposure(
    FEEDBACK_CHANNELS.ORDER_CONFIRM,
    orderId
  );

  // フィードバックプロンプト表示トラッキング
  useEffect(() => {
    if (isPaid && shouldShowFeedback) {
      markFeedbackShown();
    }
  }, [isPaid, shouldShowFeedback, markFeedbackShown]);

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
      case 'video_generating':
        return { text: '動画生成中', color: 'bg-blue-100 text-blue-800', progress: 95 };
      case 'song_selected':
        return { text: '楽曲選定完了', color: 'bg-blue-100 text-blue-800', progress: 90 };
      case 'previews_ready':
        return { text: 'プレビュー完成', color: 'bg-purple-100 text-purple-800', progress: 85 };
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

        {/* 2曲選択UI（previews_ready状態時） */}
        {order.status === "previews_ready" && order.generatedSongs && order.generatedSongs.length > 0 && (
          <div className="mb-8 p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
            <h3 className="font-bold text-purple-800 mb-4 text-lg">
              🎵 2曲からお好みの曲を選んでください
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              どちらの曲がお好みですか？選択した曲で動画を作成します。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {order.generatedSongs.map((song, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-purple-300 transition-all"
                >
                  <p className="font-bold text-gray-700 mb-2">曲 {index + 1}</p>
                  {previewSignedUrls[index] ? (
                    <audio
                      controls
                      src={previewSignedUrls[index]}
                      className="w-full mb-3"
                    />
                  ) : (
                    <div className="w-full h-12 bg-gray-100 rounded flex items-center justify-center mb-3">
                      <span className="text-gray-400 text-sm">読み込み中...</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleSelectSong(index)}
                    disabled={selectLoading || !previewSignedUrls[index]}
                    className="w-full py-2 rounded-lg font-bold transition-colors bg-purple-500 text-white hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {selectLoading ? '処理中...' : 'この曲を選ぶ'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase1: プレビュー音声セクション（曲選択後） */}
        {order.status === "song_selected" && order.previewAudioPath && previewSignedUrl && (
          <div className="mb-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h3 className="font-bold text-blue-800 mb-4 text-lg">🎵 選択した曲（15秒プレビュー）</h3>
            <audio
              ref={previewAudioRef}
              controls
              src={previewSignedUrl}
              className="w-full"
              onPlay={handlePreviewPlay}
              onTimeUpdate={handlePreviewTimeUpdate}
              onPause={handlePreviewPause}
            />
            <p className="text-xs text-gray-500 mt-2">※ 冒頭15秒のプレビューです</p>
          </div>
        )}

        {/* 動画生成中の表示 */}
        {order.status === "video_generating" && (
          <div className="mb-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h3 className="font-bold text-blue-800 mb-4 text-lg">🎬 動画を生成中...</h3>
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600">完成までしばらくお待ちください（数分かかります）</span>
            </div>
            <p className="text-sm text-gray-500 text-center">完成したらメールでお届けします。</p>
          </div>
        )}

        {/* 支払いボタン（曲選択後・未払い時のみ表示） */}
        {!isPaid && order.status === "song_selected" && (
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

        {/* フィードバックフォーム（支払い済みかつ未回答の場合） */}
        {isPaid && shouldShowFeedback && (
          <div className="mb-8">
            <FeedbackForm
              channel={FEEDBACK_CHANNELS.ORDER_CONFIRM}
              orderId={orderId}
              variant="full"
            />
          </div>
        )}

        {/* 問い合わせボタン */}
        <div className="mb-8 text-center">
          <button
            onClick={() => setIsInquiryModalOpen(true)}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            お問い合わせ・ご相談
          </button>
        </div>

        <div className="text-center">
          <Link to="/" className="text-blue-500 underline">トップページへ戻る</Link>
        </div>
      </div>

      {/* 問い合わせモーダル */}
      <InquiryModal
        orderId={orderId}
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
      />
    </div>
  );
};

export default OrderConfirmPage;
