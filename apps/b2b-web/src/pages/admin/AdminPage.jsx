import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, orderBy, where, doc, updateDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes } from "firebase/storage";
import { db, functions, storage } from '../../lib/firebase';
import { buildSimpleModePrompt } from '../../lib/prompts/simpleMode';
import { buildProModePrompt } from '../../lib/prompts/proMode';
import { QRCodeCanvas } from 'qrcode.react';

// 6. 管理者ダッシュボード
const AdminPage = ({ user, orgId = null }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState(orgId ? 'b2b' : 'all'); // 'all' | 'b2b' | 'b2c'

  // 編集機能用の状態管理
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editedLyrics, setEditedLyrics] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');

  // 管理者向け署名URL管理
  const [adminSignedUrls, setAdminSignedUrls] = useState({});
  // 永続URL管理（QRコード用）
  const [adminPermanentUrls, setAdminPermanentUrls] = useState({});

  // 写真アップロード管理
  const [orderPhotos, setOrderPhotos] = useState({});         // { orderId: File[] }
  const [photoPreviews, setPhotoPreviews] = useState({});      // { orderId: string[] }
  const [photoDisclaimer, setPhotoDisclaimer] = useState({});   // { orderId: boolean }

  // APIの設定 (修正: sunoapi.orgのBase URL)
  const SUNO_BASE_URL = "https://api.sunoapi.org/api/v1";
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const SUNO_API_KEY = import.meta.env.VITE_SUNO_API_KEY;

  // 認証チェック（AuthContextのProtectedRouteで保護されているため簡易チェック）
  useEffect(() => {
    if (!user) {
      navigate('/admin/login');
    }
  }, [user, navigate]);

  // Firestoreクエリ: orgId指定時はorgスコープ、nullなら全件（super_admin用）
  useEffect(() => {
    let q;
    if (orgId) {
      q = query(collection(db, "orders"), where("orgId", "==", orgId), orderBy("createdAt", "desc"));
    } else {
      q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || "日時不明"
      }));
      setOrders(data);
      setLoading(false);
    }, (error) => {
      console.error('[AdminPage] Firestore query error:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orgId]);


  // ポーリング処理 (useCallbackでラップ)
  const checkSunoStatus = useCallback(async (order) => {
    if (!SUNO_API_KEY) return;

    try {
      // タイムアウトチェック（4分 = 240秒）
      if (order.songGenerationStartedAt) {
        const startedAt = order.songGenerationStartedAt.toDate();
        const elapsedSeconds = (Date.now() - startedAt.getTime()) / 1000;

        if (elapsedSeconds > 240) {
          await updateDoc(doc(db, "orders", order.id), {
            status: "song_timeout",
            sunoStatus: "TIMEOUT",
            sunoErrorMessage: "Timed out waiting for Suno (4 minutes)",
            songLastPolledAt: serverTimestamp()
          });
          return;
        }
      }

      // 正しいエンドポイント: /api/v1/generate/record-info?taskId=...
      const response = await fetch(`${SUNO_BASE_URL}/generate/record-info?taskId=${order.sunoTaskId}`, {
        headers: {
          "Authorization": `Bearer ${SUNO_API_KEY}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) return;

      const result = await response.json();

      // 失敗判定
      const dataStatus = result.data?.status;
      const errorCode = result.data?.errorCode;
      const errorMessage = result.data?.errorMessage;

      if (
        dataStatus === "GENERATE_AUDIO_FAILED" ||
        dataStatus?.includes("FAILED") ||
        dataStatus?.includes("ERROR") ||
        errorCode != null ||
        errorMessage != null
      ) {
        await updateDoc(doc(db, "orders", order.id), {
          status: "song_failed",
          sunoStatus: dataStatus || "FAILED",
          sunoErrorCode: errorCode,
          sunoErrorMessage: errorMessage || "Generation failed",
          songFailedAt: serverTimestamp(),
          songLastPolledAt: serverTimestamp()
        });
        return;
      }

      // レスポンス構造: { code: 200, msg: "success", data: { taskId, status, response: { sunoData: [...] } } }
      if (result.code === 200 && dataStatus === "SUCCESS") {
        const sunoData = result.data.response?.sunoData || [];

        if (sunoData.length > 0) {
          // audioUrlフィールド名を統一（audio_url形式に変換）
          const songs = sunoData.map(song => ({
            id: song.id,
            audio_url: song.audioUrl || song.audio_url,
            stream_audio_url: song.streamAudioUrl,
            title: song.title,
            duration: song.duration
          }));

          await updateDoc(doc(db, "orders", order.id), {
            status: "song_generated",
            sunoStatus: "SUCCESS",
            generatedSongs: songs,
            songLastPolledAt: serverTimestamp()
          });
        }
      } else {
        // ステータス更新（PENDING等）
        await updateDoc(doc(db, "orders", order.id), {
          songLastPolledAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Suno polling error", error);
    }
  }, [SUNO_API_KEY, SUNO_BASE_URL]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      orders.forEach(async (order) => {
        if (order.status === "generating_song" && order.sunoTaskId) {
          await checkSunoStatus(order);
        }
      });
    }, 10000);
    return () => clearInterval(intervalId);
  }, [orders, checkSunoStatus]);

  // 編集機能の関数
  const handleEditStart = (order) => {
    setEditingOrderId(order.id);
    setEditedLyrics(order.generatedLyrics || '');
    setEditedPrompt(order.generatedPrompt || '');
  };

  const handleEditCancel = () => {
    setEditingOrderId(null);
    setEditedLyrics('');
    setEditedPrompt('');
  };

  const handleEditSave = async (orderId) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        generatedLyrics: editedLyrics,
        generatedPrompt: editedPrompt,
      });
      setEditingOrderId(null);
      setEditedLyrics('');
      setEditedPrompt('');
      alert("編集内容を保存しました！");
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました。");
    }
  };

  const handleGeneratePrompt = async (order) => {
    if (!GEMINI_API_KEY) {
      alert("APIキー設定エラー");
      return;
    }
    if (!confirm(`${order.targetName}様のプロンプトを生成しますか？`)) return;

    // プロンプトファイルから生成
    const systemPrompt = order.plan === 'pro'
      ? buildProModePrompt(order)
      : buildSimpleModePrompt(order);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "APIエラーが発生しました");
      }

      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (generatedText) {
        let cleanJsonText = generatedText.replace(/```json/g, "").replace(/```/g, "").trim();
        let parsedResult = null;

        try {
          parsedResult = JSON.parse(cleanJsonText);
        } catch (e) {
          console.error("JSON Parse Error:", e);
          alert("AIの応答が正しい形式ではありませんでした。\n" + cleanJsonText);
          return;
        }

        const orderRef = doc(db, "orders", order.id);
        await updateDoc(orderRef, {
          generatedLyrics: parsedResult.lyrics,
          generatedPrompt: parsedResult.sunoPrompt,
          status: "processing"
        });
        alert("生成完了！歌詞とプロンプトが作成されました。");
      } else {
        alert("生成に失敗しました。(AIが空の応答を返しました)");
      }
    } catch (error) {
      console.error(error);
      alert(`エラーが発生しました:\n${error.message}`);
    }
  };

  // 2. Suno楽曲生成 (最新API仕様に対応)
  const handleGenerateSong = async (order) => {
    if (!SUNO_API_KEY) return alert("エラー：Suno APIキーが設定されていません。サーバーを再起動しましたか？");
    if (!order.generatedLyrics || !order.generatedPrompt) return alert("先に歌詞とプロンプトを生成してください");
    if (!confirm("Suno APIで楽曲生成を開始しますか？（クレジットを消費します）")) return;

    try {
      // callbackUrlを環境に応じて切り替え（stg/prod判定）
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const isStg = projectId && projectId.includes("-stg");
      const callbackBaseUrl = isStg
        ? "https://birthday-song-app-stg.firebaseapp.com"
        : "https://birthday-song-app.firebaseapp.com";

      // 正しいエンドポイント: /api/v1/generate
      const response = await fetch(`${SUNO_BASE_URL}/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUNO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customMode: true,              // カスタムモード（歌詞指定）
          prompt: order.generatedLyrics, // 歌詞
          style: order.generatedPrompt,  // スタイル（旧tags）
          title: "Happy Birthday",       // タイトル
          instrumental: false,           // ボーカル有り
          model: "V5",                   // 最新モデル
          callBackUrl: `${callbackBaseUrl}/api/callback`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      // レスポンス構造: { code: 200, msg: "success", data: { taskId: "..." } }
      if (result.code === 200 && result.data?.taskId) {
        const taskId = result.data.taskId;

        await updateDoc(doc(db, "orders", order.id), {
          status: "generating_song",
          sunoTaskId: taskId,
          songGenerationStartedAt: serverTimestamp(),
          sunoStatus: "PENDING",
          sunoErrorCode: null,
          sunoErrorMessage: null,
          songLastPolledAt: serverTimestamp()
        });
        alert(`生成開始しました！(Task ID: ${taskId})\n完了まで自動で待機します...`);
      } else {
        console.error("API Response:", result);
        throw new Error(`予期しないレスポンス: ${result.msg || JSON.stringify(result)}`);
      }
    } catch (e) {
      console.error(e);
      alert(`Suno API呼び出しエラー: ${e.message}\n\n※「401」や「expired」の場合はAPIキーを再取得してください。`);
    }
  };

  const handleSelectSong = async (order, songUrl) => {
    if (!confirm("この曲を採用して納品候補にしますか？")) return;
    await updateDoc(doc(db, "orders", order.id), {
      selectedSongUrl: songUrl,
      status: "song_selected"
    });
  };

  // MP4納品メール送信（processPaymentで自動送信されるため、ここでは使わない）
  const handleSendDeliveryMP4 = async (order) => {
    if (!order.fullVideoPath) return alert("フル動画が生成されていません");
    if (!order.deliveryEmailBody) return alert("メール文面が生成されていません");
    if (!confirm("MP4ファイルを添付してメールを自動送信します。よろしいですか？")) return;

    try {
      // ステータスを送信中に更新
      await updateDoc(doc(db, "orders", order.id), {
        deliveryStatus: "sending"
      });

      // フル動画MP4の署名URL取得
      const getAdminFullSignedUrl = httpsCallable(functions, "getAdminFullSignedUrl");
      const urlResult = await getAdminFullSignedUrl({ orderId: order.id });
      const mp4Url = urlResult.data.signedUrl;

      // Cloud Functionを呼び出し
      const functionUrl = `${import.meta.env.VITE_FUNCTIONS_BASE_URL}/sendBirthdaySongEmail`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          recipientEmail: order.userEmail,
          recipientName: order.userEmail,
          mp4Url: mp4Url,
          emailBody: order.deliveryEmailBody,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "メール送信に失敗しました");
      }

      // 成功時のステータス更新
      await updateDoc(doc(db, "orders", order.id), {
        status: "completed",
        deliveryStatus: "sent",
      });

      alert("✅ メール送信が完了しました！\n\n送信先: " + order.userEmail);
    } catch (error) {
      console.error("メール送信エラー:", error);

      // エラー時のステータス更新
      await updateDoc(doc(db, "orders", order.id), {
        deliveryStatus: "error",
        deliveryError: error.message,
      });

      alert("❌ メール送信に失敗しました。\n\nエラー: " + error.message + "\n\nCloud Functionsのデプロイとシークレット設定を確認してください。");
    }
  };

  // 写真アップロード: バリデーション定数
  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  // 写真アップロード: ファイル選択ハンドラー
  const handlePhotoSelect = (orderId, files) => {
    const fileArray = Array.from(files);
    const existing = orderPhotos[orderId] || [];

    if (existing.length + fileArray.length > MAX_PHOTOS) {
      alert(`写真は最大${MAX_PHOTOS}枚までです`);
      return;
    }

    for (const file of fileArray) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`対応形式: JPEG, PNG, WebP\n${file.name} は対応していません`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`ファイルサイズは5MB以内にしてください\n${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
        return;
      }
    }

    const newPhotos = [...existing, ...fileArray];
    setOrderPhotos(prev => ({ ...prev, [orderId]: newPhotos }));
    setPhotoPreviews(prev => ({
      ...prev,
      [orderId]: newPhotos.map(f => URL.createObjectURL(f)),
    }));
  };

  // 写真アップロード: 削除ハンドラー
  const handlePhotoRemove = (orderId, index) => {
    const photos = [...(orderPhotos[orderId] || [])];
    photos.splice(index, 1);
    setOrderPhotos(prev => ({ ...prev, [orderId]: photos }));
    setPhotoPreviews(prev => ({
      ...prev,
      [orderId]: photos.map(f => URL.createObjectURL(f)),
    }));
  };

  // 写真アップロード: 順序変更ハンドラー
  const handlePhotoReorder = (orderId, fromIndex, toIndex) => {
    const photos = [...(orderPhotos[orderId] || [])];
    const [moved] = photos.splice(fromIndex, 1);
    photos.splice(toIndex, 0, moved);
    setOrderPhotos(prev => ({ ...prev, [orderId]: photos }));
    setPhotoPreviews(prev => ({
      ...prev,
      [orderId]: photos.map(f => URL.createObjectURL(f)),
    }));
  };

  // 写真アップロード: Storageへアップロード
  const uploadPhotosToStorage = async (orderId) => {
    const photos = orderPhotos[orderId] || [];
    if (photos.length === 0) return [];

    const paths = [];
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const ext = file.name.split('.').pop().toLowerCase();
      const storagePath = `photos/${orderId}/temp_${i}.${ext}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: { orderId, index: String(i), temporary: 'true' },
      });
      paths.push(storagePath);
    }
    return paths;
  };

  // Phase1: 動画アセット生成（写真スライドショー対応）
  const handleGenerateVideos = async (order) => {
    if (!order.selectedSongUrl) {
      alert("先に楽曲を選定してください");
      return;
    }

    const photos = orderPhotos[order.id] || [];
    if (photos.length === 0) {
      alert("写真を1枚以上アップロードしてください");
      return;
    }

    if (!photoDisclaimer[order.id]) {
      alert("写真の利用許諾にチェックを入れてください");
      return;
    }

    if (!confirm(`${order.targetName}様の動画アセットを生成しますか？\n\n- 写真${photos.length}枚のスライドショー\n- フル動画（縦型1080x1920）\n\n※ 2-3分かかります`)) {
      return;
    }

    try {
      // 1. 写真をStorageにアップロード
      const photoPaths = await uploadPhotosToStorage(order.id);

      // 2. Firestoreに写真パスを保存 + ステータス更新
      await updateDoc(doc(db, "orders", order.id), {
        photoPaths: photoPaths,
        photoCount: photoPaths.length,
        photoDisclaimerAccepted: true,
        photoDisclaimerAcceptedAt: serverTimestamp(),
        videoGenerationStatus: "processing",
      });

      // 3. Callable Function 呼び出し
      const generateVideoAssets = httpsCallable(functions, "generateVideoAssets");
      await generateVideoAssets({ orderId: order.id });

      alert("動画アセット生成が完了しました！");
    } catch (error) {
      console.error("動画生成エラー:", error);
      if (error.message?.includes("deadline") || error.code === "deadline-exceeded") {
        alert("処理に時間がかかっています。\n\nバックグラウンドで動画生成を継続中です。\nしばらくお待ちください（画面は自動更新されます）");
      } else {
        alert("動画生成に失敗しました。\n\nエラー: " + error.message);
      }
    }
  };

  // Phase1: 手動Paywall - 支払い済みにする + 納品メール送信
  const handleMarkAsPaid = async (order) => {
    if (!confirm(`${order.targetName}様を「支払い済み」にしますか？\n\nMP4動画を添付した納品メールを送信します。`)) {
      return;
    }

    try {
      const functionsUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;
      const idToken = user ? await user.getIdToken() : null;
      const headers = {'Content-Type': 'application/json'};
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      const response = await fetch(`${functionsUrl}/processPayment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId: order.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || '処理に失敗しました');
      }

      alert(`✅ ${result.message}`);
    } catch (error) {
      console.error("支払い処理エラー:", error);
      alert("❌ 処理に失敗しました。\n\nエラー: " + error.message);
    }
  };

  // 返金処理
  const handleRefund = async (order) => {
    if (!window.confirm(`${order.targetName}様の注文を返金しますか？isPaid=falseに戻り、返金通知メールが送信されます。`)) {
      return;
    }

    try {
      const functionsUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;
      const idToken = user ? await user.getIdToken() : null;
      const headers = {'Content-Type': 'application/json'};
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      const response = await fetch(`${functionsUrl}/processRefund`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: order.id,
          recipientEmail: order.userEmail,
          recipientName: order.userEmail,
        }),
      });

      if (!response.ok) throw new Error('返金処理に失敗しました');

      alert('✅ 返金処理が完了し、通知メールを送信しました。');
      window.location.reload(); // ページをリロードして最新状態を表示
    } catch (error) {
      console.error('Refund error:', error);
      alert('❌ 返金処理に失敗しました: ' + error.message);
    }
  };

  // 管理者向けフル動画の署名URL取得
  const handleGetAdminFullUrl = async (orderId) => {
    try {
      const getAdminFullSignedUrl = httpsCallable(functions, "getAdminFullSignedUrl");
      const result = await getAdminFullSignedUrl({ orderId });

      setAdminSignedUrls(prev => ({
        ...prev,
        [`full_${orderId}`]: result.data.signedUrl
      }));
    } catch (error) {
      console.error("フル動画URL取得エラー:", error);
      alert("❌ フル動画URL取得に失敗しました。\n\nエラー: " + error.message);
    }
  };


  // 管理者向けフル動画の永続URL取得（QRコード用）
  const handleGetAdminPermanentUrl = async (orderId) => {
    try {
      const getAdminFullPermanentUrl = httpsCallable(functions, "getAdminFullPermanentUrl");
      const result = await getAdminFullPermanentUrl({ orderId });

      setAdminPermanentUrls(prev => ({
        ...prev,
        [orderId]: result.data.permanentUrl
      }));
    } catch (error) {
      console.error("永続URL取得エラー:", error);
      alert("永続URL取得に失敗しました。\n\nエラー: " + error.message);
    }
  };

  // QRコード画像をPNGでダウンロード
  const handleDownloadQrCode = (orderId) => {
    const canvas = document.getElementById(`qr-canvas-${orderId}`);
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrcode_${orderId}.png`;
    a.click();
  };

  const b2bCount = orders.filter(o => o.plan === 'nursingHome').length;
  const b2cCount = orders.filter(o => o.plan !== 'nursingHome').length;
  const filteredOrders = orders.filter(order => {
    if (orderFilter === 'b2b') return order.plan === 'nursingHome';
    if (orderFilter === 'b2c') return order.plan !== 'nursingHome';
    return true;
  });

  if (loading) return <div className="p-10 text-center">データを読み込んでいます...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">バースデーソングメーカー 管理画面</h1>

        {/* フィルタボタン（SuperAdminのみ表示） */}
        {!orgId && (
          <div className="flex gap-2 mb-6">
            {[
              { key: 'all', label: `すべて (${orders.length})` },
              { key: 'b2b', label: `B2B 介護施設 (${b2bCount})` },
              { key: 'b2c', label: `B2C (${b2cCount})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setOrderFilter(tab.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  orderFilter === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* 注文一覧 */}
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow p-6">
              {/* ヘッダー情報 */}
              <div className="flex justify-between items-start border-b pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`rounded-full text-xs font-bold ${
                      order.plan === 'nursingHome' ? 'bg-green-100 text-green-800' :
                      order.plan === 'pro' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-pink-100 text-pink-800'
                    } ${orgId ? 'w-3 h-3 inline-block' : 'px-3 py-1'}`}>
                      {!orgId && (order.plan === 'nursingHome' ? '介護施設' : order.plan === 'simple' ? '魔法診断' : 'プロ')}
                    </span>
                    <span className="text-sm text-gray-500">{order.createdAt}</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* 表示項目の分岐 */}
                  {order.plan === 'simple' ? (
                    <div className="mt-2 text-gray-700">
                      <h3 className="text-xl font-bold mb-1">{order.targetName} 様</h3>
                      <p className="text-xs text-gray-500 mb-2 font-mono">{order.id}</p>
                      <p>🎨 色: {order.targetColor}</p>
                      <p>💖 気持ち: {Array.isArray(order.targetFeeling) ? order.targetFeeling.join(", ") : order.targetFeeling}</p>
                      <p>💌 言葉: {order.magicWord}</p>
                      <p>✨ 魔法: {order.magicSpell}</p>
                    </div>
                  ) : order.plan === 'nursingHome' ? (
                    <div className="mt-2 text-gray-700">
                      <h3 className="text-xl font-bold mb-1">{order.targetName} 様</h3>
                      <p className="text-xs text-gray-500 mb-2 font-mono">{order.id}</p>
                      <p><span className="font-bold">性別:</span> {order.nhGender}</p>
                      <p><span className="font-bold">ジャンル:</span> {order.nhGenre}</p>
                      <p><span className="font-bold">季節:</span> {order.nhSeason}</p>
                      <p><span className="font-bold">思い出:</span> {order.nhMemory}</p>
                      <p><span className="font-bold">人柄:</span> {order.nhPersonality}</p>
                    </div>
                  ) : (
                    <div className="mt-2 text-gray-700">
                      <h3 className="text-xl font-bold mb-1">{order.targetName} 様</h3>
                      <p className="text-xs text-gray-500 mb-2 font-mono">{order.id}</p>
                      <p className="font-bold">🎵 {order.proGenre}</p>
                      <p>🎤 {order.proGender} / 🎻 {Array.isArray(order.proInstruments) ? order.proInstruments.join(", ") : order.proInstruments}</p>
                      <div className="mt-2 text-sm bg-gray-50 p-2 rounded">
                        <p><span className="font-bold">A:</span> {order.proMessage1}</p>
                        <p><span className="font-bold">B:</span> {order.proMessage2}</p>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* 自動化ステータス表示 */}
              <div className="bg-gray-50 p-4 rounded border mb-4">
                <h4 className="font-bold text-gray-700 mb-2">🤖 自動処理状況</h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    order.automationStatus === 'running' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                    order.automationStatus === 'completed' ? 'bg-green-100 text-green-800' :
                    order.automationStatus === 'failed' ? 'bg-red-100 text-red-800' :
                    order.automationStatus === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.automationStatus === 'running' ? '処理中' :
                     order.automationStatus === 'completed' ? '完了' :
                     order.automationStatus === 'failed' ? 'エラー' :
                     order.automationStatus === 'paused' ? '一時停止' : '待機中'}
                  </span>
                  {order.currentStep && (
                    <span className="text-sm text-gray-600">
                      現在: {order.currentStep === 'prompt' ? 'プロンプト生成' :
                             order.currentStep === 'song' ? '楽曲生成' :
                             order.currentStep === 'preview' ? 'プレビュー生成' :
                             order.currentStep === 'email' ? 'メール送信' :
                             order.currentStep === 'video' ? '動画生成' : order.currentStep}
                    </span>
                  )}
                </div>
                {order.lastError && (
                  <div className="bg-red-50 p-3 rounded text-sm text-red-700 mb-2">
                    <p className="font-bold">エラー:</p>
                    <p className="text-xs">{order.lastError}</p>
                    {order.retryCount > 0 && (
                      <p className="text-xs mt-1">リトライ: {order.retryCount}/3</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold text-gray-700 mb-2">1. プロンプト（自動生成）</h4>
                  {order.generatedLyrics ? (
                    <div className="text-xs">
                      <p className="font-bold mb-1">歌詞:</p>
                      <textarea
                        readOnly
                        className="w-full h-80 border mb-2 p-2 text-sm bg-gray-100"
                        value={order.generatedLyrics}
                      />
                      <p className="text-green-600 text-xs mb-3">✅ 自動生成済み</p>

                      {/* 楽曲生成ボタン（プロンプト完了後、楽曲未生成の場合に表示） */}
                      {!order.generatedSongs && order.status !== 'generating_song' && (
                        <button
                          onClick={() => handleGenerateSong(order)}
                          className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 transition-colors font-bold"
                        >
                          🎵 楽曲を生成する
                        </button>
                      )}
                      {order.status === 'generating_song' && (
                        <div className="text-center py-2 text-purple-600 font-bold animate-pulse">
                          🎵 楽曲生成中...
                        </div>
                      )}
                      {order.generatedSongs && order.generatedSongs.length > 0 && (
                        <p className="text-green-600 text-xs">✅ 楽曲生成済み</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      {order.automationStatus === 'running' && order.currentStep === 'prompt' ? (
                        <span className="text-blue-600 animate-pulse">生成中...</span>
                      ) : (
                        <span>待機中</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold text-gray-700 mb-2">2. 楽曲</h4>

                  {/* 生成中 */}
                  {order.status === 'generating_song' ? (
                    <div className="text-center py-4 text-orange-600 font-bold animate-pulse">
                      生成中... 自動更新されます
                    </div>
                  ) : order.status === 'song_failed' || order.status === 'song_timeout' ? (
                    <div className="bg-red-50 border border-red-300 p-3 rounded mb-2">
                      <p className="text-red-700 font-bold mb-1">
                        {order.status === 'song_timeout' ? '⏱️ タイムアウト' : '⚠️ 生成失敗'}
                      </p>
                      <p className="text-xs text-red-600 mb-2">
                        {order.sunoErrorMessage || (order.status === 'song_timeout' ? '生成に4分以上かかりました' : 'エラーが発生しました')}
                      </p>
                      <p className="text-xs text-gray-600">再度楽曲生成ボタンを押してください</p>
                    </div>
                  ) : order.status === 'song_generated' || order.status === 'song_selected' ? (
                    <div className="text-green-600 text-sm mb-2">
                      ✅ 楽曲生成完了
                      {order.selectedSongUrl && ' ・選曲済み'}
                    </div>
                  ) : !order.generatedLyrics ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      <span>プロンプト生成待ち</span>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      <span>楽曲生成ボタンを押してください</span>
                    </div>
                  )}

                  {/* 生成済み楽曲リスト + 管理者選曲 */}
                  {order.generatedSongs && order.generatedSongs.length > 0 && (
                    <div className="space-y-3 mt-2">
                      {order.generatedSongs.map((song, idx) => (
                        <div key={idx} className={`p-2 border rounded ${order.selectedSongUrl === song.audio_url ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                          <p className="text-xs font-bold mb-1">
                            曲 {idx + 1}
                            {order.selectedSongUrl === song.audio_url && <span className="ml-2 text-green-700">（選択中）</span>}
                          </p>
                          <audio controls src={song.audio_url} className="w-full h-8 mb-2" />
                          {order.selectedSongUrl !== song.audio_url && (
                            <button
                              onClick={() => handleSelectSong(order, song.audio_url)}
                              className="w-full bg-green-500 text-white text-xs py-1 px-2 rounded hover:bg-green-600"
                            >
                              この曲を選択
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                  <h4 className="font-bold text-gray-700 mb-2">3. 動画生成</h4>

                  {/* 写真アップロードセクション */}
                  <div className="mb-3">
                    <p className="text-sm font-bold text-gray-700 mb-2">写真アップロード（1-5枚）</p>

                    {/* サムネイルプレビュー */}
                    {(photoPreviews[order.id] || []).length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {(photoPreviews[order.id] || []).map((preview, idx) => (
                          <div key={idx} className="relative w-16 h-28 rounded overflow-hidden border-2 border-gray-300">
                            <img src={preview} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => handlePhotoRemove(order.id, idx)}
                              className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 rounded-full leading-4 text-center"
                            >x</button>
                            <span className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white text-xs px-1">{idx + 1}</span>
                            {idx > 0 && (
                              <button
                                onClick={() => handlePhotoReorder(order.id, idx, idx - 1)}
                                className="absolute top-0 left-0 bg-blue-500 text-white text-xs w-4 h-4 rounded-full leading-4 text-center"
                              >&lt;</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ファイル選択 */}
                    {(orderPhotos[order.id] || []).length < MAX_PHOTOS && !order.fullVideoPath && (
                      <label className="block w-full text-center py-2 px-3 bg-gray-200 rounded cursor-pointer hover:bg-gray-300 text-sm text-gray-700 border-2 border-dashed border-gray-400">
                        写真を追加 (JPEG/PNG/WebP, 5MB以下)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => handlePhotoSelect(order.id, e.target.files)}
                        />
                      </label>
                    )}

                    {/* 免責チェックボックス */}
                    {(orderPhotos[order.id] || []).length > 0 && !order.fullVideoPath && (
                      <label className="flex items-start gap-2 mt-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={photoDisclaimer[order.id] || false}
                          onChange={(e) => setPhotoDisclaimer(prev => ({ ...prev, [order.id]: e.target.checked }))}
                          className="mt-0.5"
                        />
                        <span>アップロードする写真の利用権限を確認済みであり、肖像権・著作権について利用者が責任を負うことに同意します。</span>
                      </label>
                    )}
                  </div>

                  {/* 動画生成ボタン */}
                  {order.selectedSongUrl && !order.fullVideoPath && order.videoGenerationStatus !== "processing" && order.status !== 'video_generating' && (
                    <button
                      onClick={() => handleGenerateVideos(order)}
                      disabled={(orderPhotos[order.id] || []).length === 0 || !photoDisclaimer[order.id]}
                      className="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed mb-3"
                    >
                      動画を生成する（写真{(orderPhotos[order.id] || []).length}枚）
                    </button>
                  )}

                  {/* 動画生成状態 */}
                  {(order.videoGenerationStatus === "processing" || order.status === 'video_generating') && (
                    <div className="text-center py-4 text-blue-600 font-bold animate-pulse mb-2">
                      動画生成中... 自動更新されます
                    </div>
                  )}

                  {order.videoGenerationStatus === "completed" && (
                    <div className="text-center py-2 text-green-600 text-sm font-bold mb-2">
                      生成完了{order.photoCount ? `（写真${order.photoCount}枚）` : ''}
                    </div>
                  )}

                  {!order.selectedSongUrl && !order.fullVideoPath && (
                    <div className="text-center py-2 text-gray-500 text-sm">
                      先に楽曲を選定してください
                    </div>
                  )}

                  {/* フル動画確認 */}
                  {order.fullVideoPath && (
                    <div className="mt-3 bg-white p-3 rounded border">
                      <p className="text-xs font-bold text-gray-700 mb-2">フル動画（1080x1920）</p>
                      <button
                        onClick={() => handleGetAdminFullUrl(order.id)}
                        className="bg-purple-500 text-white text-xs px-3 py-1 rounded hover:bg-purple-600 mb-2 w-full"
                      >
                        署名URL取得して再生 🎬
                      </button>
                      {adminSignedUrls[`full_${order.id}`] && (
                        <div>
                          <video controls src={adminSignedUrls[`full_${order.id}`]} className="w-full mb-1" style={{maxHeight: '300px'}} />
                          <a
                            href={adminSignedUrls[`full_${order.id}`]}
                            download={`birthday_song_full_${order.id}.mp4`}
                            className="text-xs text-blue-600 underline block mb-1"
                          >
                            ダウンロード 📥
                          </a>
                          <p className="text-xs text-gray-500">※ URL有効期限: 3日</p>
                          {order.fullVideoAudioDurationSec && order.fullVideoDurationSec && (
                            <p className="text-xs text-gray-600 mt-2">
                              Audio: {order.fullVideoAudioDurationSec.toFixed(1)}s / Video: {order.fullVideoDurationSec.toFixed(1)}s
                            </p>
                          )}
                        </div>
                      )}
                      {/* QRコード・永続URL */}
                      <div className="mt-3 border-t pt-3">
                        <button
                          onClick={() => handleGetAdminPermanentUrl(order.id)}
                          className="bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600 mb-2 w-full"
                        >
                          QRコード取得
                        </button>
                        {adminPermanentUrls[order.id] && (
                          <div className="text-center">
                            <QRCodeCanvas
                              id={`qr-canvas-${order.id}`}
                              value={adminPermanentUrls[order.id]}
                              size={160}
                              level="M"
                              marginSize={2}
                            />
                            <div className="flex gap-2 mt-2">
                              <a
                                href={adminPermanentUrls[order.id]}
                                download={`birthday_song_full_${order.id}.mp4`}
                                className="flex-1 bg-blue-500 text-white text-xs px-3 py-2 rounded hover:bg-blue-600 text-center"
                              >
                                動画DL
                              </a>
                              <button
                                onClick={() => handleDownloadQrCode(order.id)}
                                className="flex-1 bg-gray-500 text-white text-xs px-3 py-2 rounded hover:bg-gray-600"
                              >
                                QR画像DL
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">※ このURLは期限なし</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-semibold mb-3">4. メール管理</h4>

                  {/* MP4納品メール */}
                  <div className="p-3 bg-green-50 rounded">
                    <p className="font-medium mb-2 text-sm">🎬 MP4納品メール</p>
                    {order.deliveryStatus === 'sent' ? (
                      <p className="text-xs text-green-600">
                        ✅ 送信済み
                        {order.deliverySentAt && (
                          <span className="text-gray-500 ml-1">
                            ({order.deliverySentAt.toDate ? order.deliverySentAt.toDate().toLocaleString('ja-JP') : new Date(order.deliverySentAt).toLocaleString('ja-JP')})
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        ※ 顧客の支払い後に自動送信されます
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Phase1: Paywall管理 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Paywall管理セクション */}
                <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                  <h4 className="font-semibold mb-3">5. 💰 Paywall（支払い管理）</h4>

                  <div className="mb-2">
                    <span className="font-medium">支払いステータス: </span>
                    {order.isPaid ? (
                      <span className="text-green-600 font-bold">✅ 支払い済み</span>
                    ) : (
                      <span className="text-red-600 font-bold">❌ 未払い</span>
                    )}
                  </div>

                  {order.isPaid && order.paidAt && (
                    <p className="text-xs text-gray-600 mb-3">
                      支払い日時: {order.paidAt.toDate ? order.paidAt.toDate().toLocaleString('ja-JP') : new Date(order.paidAt).toLocaleString('ja-JP')}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {!order.isPaid && (
                      <button
                        onClick={() => handleMarkAsPaid(order)}
                        className="text-sm bg-green-500 text-white px-3 py-2 rounded flex-1"
                      >
                        手動で支払い完了にする
                      </button>
                    )}

                    {order.isPaid && (
                      <button
                        onClick={() => handleRefund(order)}
                        className="text-sm bg-red-500 text-white px-3 py-2 rounded flex-1"
                      >
                        返金する
                      </button>
                    )}
                  </div>

                  {order.refundedAt && (
                    <p className="text-xs text-orange-600 mt-2">
                      ⚠️ 返金済み ({order.refundedAt.toDate ? order.refundedAt.toDate().toLocaleString('ja-JP') : new Date(order.refundedAt).toLocaleString('ja-JP')})
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
