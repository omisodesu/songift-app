import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, orderBy, doc, updateDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from '../../lib/firebase';
import { FEEDBACK_CHANNELS, DISSATISFACTION_REASONS, BARRIER_REASONS, REORDER_INTENTS, PRICE_PERCEPTIONS } from '../../lib/feedbackApi';

// 6. 管理者ダッシュボード
const AdminPage = ({ user }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // タブ管理
  const [activeTab, setActiveTab] = useState('orders');

  // フィードバック一覧
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  // 編集機能用の状態管理
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editedLyrics, setEditedLyrics] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');

  // 管理者向け署名URL管理
  const [adminSignedUrls, setAdminSignedUrls] = useState({});

  // APIの設定 (修正: sunoapi.orgのBase URL)
  const SUNO_BASE_URL = "https://api.sunoapi.org/api/v1";
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const SUNO_API_KEY = import.meta.env.VITE_SUNO_API_KEY;

  // 認証チェック
  useEffect(() => {
    const adminEmailsStr = import.meta.env.VITE_ADMIN_EMAIL || '';
    const adminEmails = adminEmailsStr.split(',').map(e => e.trim());

    if (!user || !adminEmails.includes(user.email)) {
      alert('管理者権限が必要です');
      navigate('/admin/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || "日時不明"
      }));
      setOrders(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // フィードバック一覧の取得
  useEffect(() => {
    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || "日時不明"
      }));
      setFeedbacks(data);
      setFeedbackLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

    let systemPrompt = "";

    if (order.plan === 'simple') {
      // ---------------------------
      // 簡単モード (Simple) のプロンプト
      // ---------------------------
      systemPrompt = `
        あなたはプロの作詞作曲家兼Suno AIプロンプトエンジニアです。
        以下のフォーム回答を元に、定義されたルールに従って「歌詞」と「Suno AI用プロンプト」を作成してください。

        【フォーム回答】
        Q1. お誕生日の主役のお名前：${order.targetName}
        Q2. その人を色で表すと：${order.targetColor}
        Q3. その人といると、どんな気持ち：${Array.isArray(order.targetFeeling) ? order.targetFeeling.join(", ") : order.targetFeeling}
        Q4. 魔法の言葉を一つ贈るなら：${order.magicWord}
        Q5. その人の新しい一年に、どんな魔法をかけたい：${order.magicSpell}

        【歌詞創作ルール（重要）】
        Q4とQ5の選択肢をそのまま使わず、その「意味・感情・メッセージ」を理解して、自然で詩的な日本語の歌詞に創作してください。毎回異なる表現にしてください。

        ■ Verse（8〜15文字程度、1〜2行）
        Q4のメッセージの本質的な意味を、歌いやすく自然な日本語で表現してください。
        (創作方針例)
        - いつもありがとう → 感謝・支えへの気持ち
        - 出会えて本当によかった → 出会いへの感謝・奇跡
        - 夢を応援してるよ → 応援・サポート
        - 最高の一年になりますように → 祝福・幸せへの願い
        - あなたは特別な存在 → 唯一無二の存在感
        - これからもよろしくね → 友情・関係継続
        - ずっと友達でいてね → 永続的な友情

        ■ Pre-Chorus（10〜18文字程度、1〜2行）
        Q5の魔法に対応する、前向きで温かいオリジナルフレーズにしてください。
        (創作方針例)
        - キラキラ輝く魔法 → 夢・希望・輝き
        - 勇気が湧く魔法 → 勇気・挑戦・成長
        - 愛に包まれる魔法 → 愛情・温かさ・優しさ
        - 笑顔が溢れる魔法 → 笑顔・楽しさ・喜び
        - 希望の魔法 → 希望・出会い・新しい世界

        【変換ルール】
        ■ Q2（色）→ ジャンル・BPM・楽器の変換
        - 情熱の赤 → Rock, 140 bpm, electric guitar, drums
        - 元気な黄色 → J-pop, 100 bpm, piano, acoustic guitar
        - 優しい青 → R&B, 75 bpm, piano, saxophone
        - 癒しの緑 → Jazz, 90 bpm, piano, saxophone
        - 個性的な紫 → J-pop, 100 bpm, synthesizer, electric guitar
        - 純粋な白 → J-pop, 100 bpm, piano, strings

        ■ Q3（気持ち）→ ボーカル性別の決定
        - 「元気が出る」「笑える」「刺激的」が含まれる → male
        - 「安心する」「幸せ」が含まれる → female
        - その他・複数選択 → female

        ■ Q5（魔法）→ 追加タグ
        - キラキラ輝く魔法 → #bright #dreamy
        - 勇気が湧く魔法 → #powerful #uplifting
        - 愛に包まれる魔法 → #warm #emotional
        - 笑顔が溢れる魔法 → #cheerful #fun
        - 希望の魔法 → #hopeful #inspiring

        【出力フォーマット (JSON)】
        必ず以下のJSON形式のみを出力してください。Markdown記法は不要です。
        {
          "lyrics": "[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\n[Verse]\\n(Q4から創作した自然な歌詞)\\n[Pre-Chorus]\\n(Q5から創作した自然な歌詞)\\n[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}",
          "sunoPrompt": "happy birthday | (Q2から変換したジャンル) | (Q2から変換したBPM) | key: C | (Q2から変換した楽器), clap | Japanese (Q3から決定したvocal) vocal | #birthday #upbeat #groovy (Q5から変換した追加タグ)"
        }
      `;
    } else {
      // ---------------------------
      // プロモード (Pro) のプロンプト
      // ---------------------------
      systemPrompt = `
        あなたはプロの作詞作曲家兼Suno AIプロンプトエンジニアです。
        以下のフォーム回答を元に、定義されたルールに従って「歌詞」と「Suno AI用プロンプト」を作成してください。

        【フォーム回答】
        質問1（ジャンル）：${order.proGenre}
        質問2（楽器）：${Array.isArray(order.proInstruments) ? order.proInstruments.join(", ") : order.proInstruments}
        質問3（性別）：${order.proGender}
        質問4（名前）：${order.targetName}
        質問5-1（メッセージ1）：${order.proMessage1}
        質問5-2（メッセージ2）：${order.proMessage2}

        【抽出・変換ルール】
        ■ 質問1（ジャンル）→ ジャンル名とBPMを抽出
        - J-pop（明るいポップス）→ ジャンル：J-pop / BPM：100 bpm
        - R&B（おしゃれでスムーズ）→ ジャンル：R&B / BPM：75 bpm
        - Rock（パワフルで熱い）→ ジャンル：Rock / BPM：140 bpm
        - Jazz（大人っぽく洗練）→ ジャンル：Jazz / BPM：90 bpm
        - Acoustic（温かみのある生音）→ ジャンル：Acoustic / BPM：90 bpm
        - EDM（ノリノリでダンサブル）→ ジャンル：EDM / BPM：128 bpm
        - Bossa Nova（リラックスした雰囲気）→ ジャンル：Bossa Nova / BPM：80 bpm

        ■ 質問2（楽器）→ 英語部分を小文字で抽出
        例）Piano（ピアノ）→ piano, Guitar（ギター）→ guitar, Saxophone（サックス）→ saxophone, etc.

        ■ 質問3（性別）→ 英語部分を小文字で抽出
        - 男性（Male）→ male
        - 女性（Female）→ female

        ■ 質問4（名前）→ そのまま使用

        ■ 質問5-1、5-2（メッセージ）の変換ルール
        - 歌詞部分：漢字をひらがなに変換（例：「素敵な一年」→「すてきないちねん」）

        【出力フォーマット (JSON)】
        必ず以下のJSON形式のみを出力してください。Markdown記法は不要です。
        {
          "lyrics": "[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\n[Verse]\\n(質問5-1の回答をひらがな変換したもの)\\n[Pre-Chorus]\\n(質問5-2の回答をひらがな変換したもの)\\n[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}",
          "sunoPrompt": "happy birthday | (質問1から抽出したジャンル名) | (質問1から抽出したBPM) | key: C | (質問2から抽出した楽器名小文字), clap | Japanese (質問3から抽出したvocal小文字) vocal | #birthday #upbeat #groovy"
        }
      `;
    }

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

  // プレビュー案内メール再送（固定テンプレート使用）
  const handleResendPreviewEmail = async (order) => {
    if (!confirm("プレビュー案内メールを再送します。よろしいですか？")) return;

    try {
      await updateDoc(doc(db, "orders", order.id), {previewEmailStatus: "sending"});

      const functionsUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;
      const response = await fetch(`${functionsUrl}/sendPreviewEmail`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          orderId: order.id,
        }),
      });

      if (!response.ok) throw new Error('メール送信に失敗しました');

      alert(`✅ プレビュー案内メールを再送しました！\n\n送信先: ${order.userEmail}`);
      window.location.reload();
    } catch (error) {
      console.error("Preview email send error:", error);
      await updateDoc(doc(db, "orders", order.id), {
        previewEmailStatus: "error",
        previewEmailError: error.message
      });
      alert("メール送信エラー: " + error.message);
    }
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

  // Phase1: 動画アセット生成
  const handleGenerateVideos = async (order) => {
    if (!order.selectedSongUrl) {
      alert("先に楽曲を選定してください");
      return;
    }

    if (!confirm(`${order.targetName}様の動画アセットを生成しますか？\n\n- プレビュー音声（15秒）\n- フル動画（縦型1080x1920）\n\n※ 2-3分かかります`)) {
      return;
    }

    try {
      // ステータスを processing に更新
      await updateDoc(doc(db, "orders", order.id), {
        videoGenerationStatus: "processing",
      });

      // Callable Function 呼び出し
      const generateVideoAssets = httpsCallable(functions, "generateVideoAssets");
      await generateVideoAssets({ orderId: order.id });

      alert("✅ 動画アセット生成が完了しました！");
    } catch (error) {
      console.error("動画生成エラー:", error);
      alert("❌ 動画生成に失敗しました。\n\nエラー: " + error.message);
    }
  };

  // Phase1: 手動Paywall - 支払い済みにする
  const handleMarkAsPaid = async (order) => {
    if (!confirm(`${order.targetName}様を「支払い済み」にしますか？\n\nMP4動画をメールでお送りします。`)) {
      return;
    }

    try {
      await updateDoc(doc(db, "orders", order.id), {
        isPaid: true,
        paidAt: new Date(),
      });

      alert("✅ 支払い済みに変更しました。\n\n※ 顧客ページの支払いボタンからMP4メールを自動送信できます。");
    } catch (error) {
      console.error("Paywall更新エラー:", error);
      alert("❌ 更新に失敗しました。\n\nエラー: " + error.message);
    }
  };

  // 返金処理
  const handleRefund = async (order) => {
    if (!window.confirm(`${order.targetName}様の注文を返金しますか？isPaid=falseに戻り、返金通知メールが送信されます。`)) {
      return;
    }

    try {
      const functionsUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;
      const response = await fetch(`${functionsUrl}/processRefund`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
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

  // 管理者向けプレビュー音声の署名URL取得
  const handleGetAdminPreviewUrl = async (orderId) => {
    try {
      const getAdminPreviewSignedUrl = httpsCallable(functions, "getAdminPreviewSignedUrl");
      const result = await getAdminPreviewSignedUrl({ orderId });

      setAdminSignedUrls(prev => ({
        ...prev,
        [`preview_${orderId}`]: result.data.signedUrl
      }));
    } catch (error) {
      console.error("プレビューURL取得エラー:", error);
      alert("❌ プレビューURL取得に失敗しました。\n\nエラー: " + error.message);
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


  // ヘルパー関数: ラベル取得
  const getChannelLabel = (channel) => {
    const channelLabels = {
      [FEEDBACK_CHANNELS.ORDER_CONFIRM]: '注文確認画面',
      [FEEDBACK_CHANNELS.PREVIEW_EMAIL]: 'プレビューメール',
      [FEEDBACK_CHANNELS.DELIVERY_EMAIL]: '納品メール',
      [FEEDBACK_CHANNELS.FOLLOWUP_EMAIL]: 'フォローアップ',
      [FEEDBACK_CHANNELS.INQUIRY_FORM]: 'お問い合わせ',
    };
    return channelLabels[channel] || channel;
  };

  const getReorderIntentLabel = (value) => {
    const item = REORDER_INTENTS.find(r => r.value === value);
    return item?.label || value;
  };

  const getPricePerceptionLabel = (value) => {
    const item = PRICE_PERCEPTIONS.find(p => p.value === value);
    return item?.label || value;
  };

  const getDissatisfactionLabel = (value) => {
    const item = DISSATISFACTION_REASONS.find(d => d.value === value);
    return item?.label || value;
  };

  const getBarrierLabel = (value) => {
    const item = BARRIER_REASONS.find(b => b.value === value);
    return item?.label || value;
  };

  // 星評価表示
  const renderStars = (rating) => {
    return (
      <span className="text-yellow-500">
        {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </span>
    );
  };

  if (loading) return <div className="p-10 text-center">データを読み込んでいます...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">管理者ダッシュボード</h1>

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            注文一覧 ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'feedback'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            フィードバック ({feedbacks.length})
          </button>
        </div>

        {/* フィードバック一覧 */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {feedbackLoading ? (
              <div className="text-center py-10">フィードバックを読み込んでいます...</div>
            ) : feedbacks.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
                フィードバックはまだありません
              </div>
            ) : (
              feedbacks.map((fb) => (
                <div key={fb.id} className="bg-white rounded-xl shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-blue-600">{fb.rating}</span>
                      {renderStars(fb.rating)}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        fb.rating >= 4 ? 'bg-green-100 text-green-800' :
                        fb.rating >= 3 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {fb.rating >= 4 ? '高評価' : fb.rating >= 3 ? '普通' : '低評価'}
                      </span>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{fb.createdAt}</p>
                      <p className="text-xs">{getChannelLabel(fb.channel)}</p>
                    </div>
                  </div>

                  {/* コメント */}
                  {fb.comment && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <p className="text-gray-800 whitespace-pre-wrap">{fb.comment}</p>
                    </div>
                  )}

                  {/* 詳細情報 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {fb.orderId && (
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-xs text-gray-500">注文ID</p>
                        <p className="font-medium text-blue-800 truncate">{fb.orderId}</p>
                      </div>
                    )}
                    {fb.reorderIntent && (
                      <div className="bg-green-50 p-2 rounded">
                        <p className="text-xs text-gray-500">再購入意向</p>
                        <p className="font-medium text-green-800">{getReorderIntentLabel(fb.reorderIntent)}</p>
                      </div>
                    )}
                    {fb.pricePerception && (
                      <div className="bg-yellow-50 p-2 rounded">
                        <p className="text-xs text-gray-500">価格感</p>
                        <p className="font-medium text-yellow-800">{getPricePerceptionLabel(fb.pricePerception)}</p>
                      </div>
                    )}
                    {fb.barrierReason && (
                      <div className="bg-orange-50 p-2 rounded">
                        <p className="text-xs text-gray-500">購入障壁</p>
                        <p className="font-medium text-orange-800">{getBarrierLabel(fb.barrierReason)}</p>
                      </div>
                    )}
                    {fb.dissatisfactionReason && (
                      <div className="bg-red-50 p-2 rounded">
                        <p className="text-xs text-gray-500">不満理由</p>
                        <p className="font-medium text-red-800">{getDissatisfactionLabel(fb.dissatisfactionReason)}</p>
                      </div>
                    )}
                    {fb.refundRequested && (
                      <div className="bg-red-100 p-2 rounded">
                        <p className="text-xs text-gray-500">返金リクエスト</p>
                        <p className="font-medium text-red-800">あり</p>
                      </div>
                    )}
                    {fb.variant && (
                      <div className="bg-purple-50 p-2 rounded">
                        <p className="text-xs text-gray-500">A/Bバリアント</p>
                        <p className="font-medium text-purple-800">{fb.variant}</p>
                      </div>
                    )}
                  </div>

                  {/* visitorId (縮小表示) */}
                  <div className="mt-3 text-xs text-gray-400">
                    Visitor: {fb.visitorId?.slice(0, 8)}...
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 注文一覧 */}
        {activeTab === 'orders' && (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow p-6">
              {/* ヘッダー情報 */}
              <div className="flex justify-between items-start border-b pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.plan === 'pro' ? 'bg-indigo-100 text-indigo-800' : 'bg-pink-100 text-pink-800'}`}>
                      {order.plan === 'simple' ? '魔法診断' : 'プロ'}
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
                      <p>🎨 色: {order.targetColor}</p>
                      <p>💖 気持ち: {Array.isArray(order.targetFeeling) ? order.targetFeeling.join(", ") : order.targetFeeling}</p>
                      <p>💌 言葉: {order.magicWord}</p>
                      <p>✨ 魔法: {order.magicSpell}</p>
                    </div>
                  ) : (
                    <div className="mt-2 text-gray-700">
                      <h3 className="text-xl font-bold mb-1">{order.targetName} 様</h3>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold text-gray-700 mb-2">1. Geminiプロンプト</h4>
                  {order.generatedLyrics ? (
                    <div className="text-xs">
                      <p className="font-bold mb-1">歌詞:</p>
                      <textarea
                        readOnly={editingOrderId !== order.id}
                        className={`w-full h-40 border mb-2 p-2 text-sm ${editingOrderId === order.id ? 'bg-white' : 'bg-gray-100'}`}
                        value={editingOrderId === order.id ? editedLyrics : order.generatedLyrics}
                        onChange={(e) => setEditedLyrics(e.target.value)}
                      />
                      <p className="font-bold mb-1">スタイル:</p>
                      <textarea
                        readOnly={editingOrderId !== order.id}
                        className={`w-full h-24 border mb-2 p-2 text-sm ${editingOrderId === order.id ? 'bg-white' : 'bg-gray-100'}`}
                        value={editingOrderId === order.id ? editedPrompt : order.generatedPrompt}
                        onChange={(e) => setEditedPrompt(e.target.value)}
                      />
                      {editingOrderId === order.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSave(order.id)}
                            className="flex-1 bg-green-600 text-white py-2 rounded shadow hover:bg-green-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="flex-1 bg-gray-500 text-white py-2 rounded shadow hover:bg-gray-600"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditStart(order)}
                          className="w-full bg-blue-600 text-white py-2 rounded shadow hover:bg-blue-700"
                        >
                          編集
                        </button>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => handleGeneratePrompt(order)} className="bg-purple-600 text-white w-full py-2 rounded shadow hover:bg-purple-700">
                      Gemini生成 ✨
                    </button>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold text-gray-700 mb-2">2. 楽曲生成 & 選定</h4>

                  {/* 生成中 */}
                  {order.status === 'generating_song' ? (
                    <div className="text-center py-4 text-orange-600 font-bold animate-pulse">
                      生成中... 自動更新されます
                    </div>
                  ) : order.status === 'song_failed' ? (
                    /* 生成失敗 */
                    <div className="bg-red-50 border border-red-300 p-3 rounded mb-2">
                      <p className="text-red-700 font-bold mb-1">⚠️ 生成失敗</p>
                      <p className="text-xs text-red-600 mb-2">
                        {order.sunoErrorMessage || 'Suno API returned an error'}
                      </p>
                      {order.sunoErrorCode && (
                        <p className="text-xs text-gray-600">Error Code: {order.sunoErrorCode}</p>
                      )}
                      <button
                        onClick={() => handleGenerateSong(order)}
                        className="bg-orange-500 text-white w-full py-2 rounded shadow hover:bg-orange-600 mt-2"
                      >
                        再生成 🔄
                      </button>
                    </div>
                  ) : order.status === 'song_timeout' ? (
                    /* タイムアウト */
                    <div className="bg-yellow-50 border border-yellow-300 p-3 rounded mb-2">
                      <p className="text-yellow-700 font-bold mb-1">⏱️ タイムアウト</p>
                      <p className="text-xs text-yellow-600 mb-2">
                        生成に4分以上かかりました。再度お試しください。
                      </p>
                      <button
                        onClick={() => handleGenerateSong(order)}
                        className="bg-orange-500 text-white w-full py-2 rounded shadow hover:bg-orange-600 mt-2"
                      >
                        再生成 🔄
                      </button>
                    </div>
                  ) : (
                    /* 通常の生成ボタン */
                    <button
                      onClick={() => handleGenerateSong(order)}
                      disabled={!order.generatedPrompt || order.status === 'generating_song'}
                      className="bg-orange-500 text-white w-full py-2 rounded shadow hover:bg-orange-600 disabled:bg-gray-300 mb-2"
                    >
                      {order.sunoTaskId ? 'Sunoで再生成 🔄' : 'Sunoで生成開始 🎵'}
                    </button>
                  )}

                  {/* 生成済み楽曲リスト */}
                  {order.generatedSongs && order.generatedSongs.length > 0 && (
                    <div className="space-y-3 mt-2">
                      {order.generatedSongs.map((song, idx) => (
                        <div key={idx} className={`p-2 border rounded ${order.selectedSongUrl === song.audio_url ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                          <p className="text-xs font-bold mb-1">候補 {idx + 1}</p>
                          <audio controls src={song.audio_url} className="w-full h-8 mb-2" />
                          {order.selectedSongUrl !== song.audio_url && (
                            <button
                              onClick={() => handleSelectSong(order, song.audio_url)}
                              className="bg-blue-500 text-white text-xs px-2 py-1 rounded w-full"
                            >
                              この曲を採用 👍
                            </button>
                          )}
                          {order.selectedSongUrl === song.audio_url && (
                            <p className="text-center text-green-700 text-xs font-bold">採用済み ✅</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                  <h4 className="font-bold text-gray-700 mb-2">3. 動画生成 🎬</h4>

                  {/* 生成状態表示 */}
                  {order.videoGenerationStatus === "processing" && (
                    <div className="text-center py-4 text-blue-600 font-bold animate-pulse mb-2">
                      生成中... 2-3分お待ちください
                    </div>
                  )}

                  {order.videoGenerationStatus === "failed" && (
                    <div className="text-center py-2 text-red-600 text-sm mb-2">
                      ❌ 生成失敗: {order.videoGenerationError}
                    </div>
                  )}

                  {order.videoGenerationStatus === "completed" && (
                    <div className="text-center py-2 text-green-600 text-sm font-bold mb-2">
                      ✅ 生成完了
                    </div>
                  )}

                  {/* 生成ボタン */}
                  <button
                    onClick={() => handleGenerateVideos(order)}
                    disabled={!order.selectedSongUrl || order.videoGenerationStatus === "processing"}
                    className="bg-purple-600 text-white w-full py-2 rounded shadow hover:bg-purple-700 disabled:bg-gray-300 mb-3"
                  >
                    {order.videoGenerationStatus === "completed" ? "動画を再生成 🔄" : "動画を生成 🎬"}
                  </button>

                  {/* プレビュー音声確認 */}
                  {order.previewAudioPath && (
                    <div className="mt-3 bg-white p-3 rounded border">
                      <p className="text-xs font-bold text-gray-700 mb-2">プレビュー音声（15秒）</p>
                      <button
                        onClick={() => handleGetAdminPreviewUrl(order.id)}
                        className="bg-blue-500 text-white text-xs px-3 py-1 rounded hover:bg-blue-600 mb-2 w-full"
                      >
                        署名URL取得して再生 🔊
                      </button>
                      {adminSignedUrls[`preview_${order.id}`] && (
                        <div>
                          <audio controls src={adminSignedUrls[`preview_${order.id}`]} className="w-full mb-1" />
                          <p className="text-xs text-gray-500">※ URL有効期限: 20分</p>
                        </div>
                      )}
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
                          <p className="text-xs text-gray-500">※ URL有効期限: 20分</p>
                          {order.fullVideoAudioDurationSec && order.fullVideoDurationSec && (
                            <p className="text-xs text-gray-600 mt-2">
                              Audio: {order.fullVideoAudioDurationSec.toFixed(1)}s / Video: {order.fullVideoDurationSec.toFixed(1)}s
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-semibold mb-3">4. メール管理</h4>

                  {/* プレビュー案内メール */}
                  <div className="mb-4 p-3 bg-blue-50 rounded">
                    <p className="font-medium mb-2 text-sm">📧 プレビュー案内メール</p>
                    {order.previewEmailStatus === 'sent' ? (
                      <div>
                        <p className="text-xs text-green-600 mb-2">
                          ✅ 送信済み
                          {order.previewEmailSentAt && (
                            <span className="text-gray-500 ml-1">
                              ({order.previewEmailSentAt.toDate ? order.previewEmailSentAt.toDate().toLocaleString('ja-JP') : new Date(order.previewEmailSentAt).toLocaleString('ja-JP')})
                            </span>
                          )}
                        </p>
                        <button
                          onClick={() => handleResendPreviewEmail(order)}
                          className="text-sm bg-blue-500 text-white px-3 py-2 rounded w-full"
                        >
                          再送する 📨
                        </button>
                      </div>
                    ) : order.previewAudioPath ? (
                      <p className="text-xs text-yellow-600">
                        ⏳ 動画生成完了時に自動送信されます
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        ※ 動画生成後に自動送信されます
                      </p>
                    )}
                  </div>

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
        )}
      </div>
    </div>
  );
};

export default AdminPage;
