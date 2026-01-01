const {onRequest, onCall} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const axios = require("axios");
const crypto = require("crypto");
const {Storage} = require("@google-cloud/storage");
const {GoogleAuth} = require("google-auth-library");

admin.initializeApp();
const storage = new Storage();

/**
 * レート制限チェック（Firestoreベース）
 */
async function checkRateLimit(ip, maxRequests, windowMs) {
  const rateLimitRef = admin.firestore().collection("rate_limits").doc(ip);
  const doc = await rateLimitRef.get();

  const now = Date.now();

  if (doc.exists) {
    const {count, lastAccess} = doc.data();

    // 制限時間内かチェック
    if (now - lastAccess < windowMs) {
      if (count >= maxRequests) {
        return {allowed: false, remaining: 0};
      }
      // カウント増加
      await rateLimitRef.update({
        count: count + 1,
        lastAccess: now,
      });
      return {allowed: true, remaining: maxRequests - count - 1};
    } else {
      // 時間窓リセット
      await rateLimitRef.set({
        count: 1,
        lastAccess: now,
      });
      return {allowed: true, remaining: maxRequests - 1};
    }
  } else {
    // 初回アクセス
    await rateLimitRef.set({
      count: 1,
      lastAccess: now,
    });
    return {allowed: true, remaining: maxRequests - 1};
  }
}

/**
 * 環境に応じてフロントエンドのベースURLを解決
 * @param {string} appEnv - APP_ENV 環境変数の値
 * @return {string} フロントエンドのベースURL
 */
function resolveFrontendBaseUrl(appEnv) {
  const isProduction = appEnv === "prod";
  return isProduction
    ? "https://birthday-song-app.web.app"
    : "https://birthday-song-app-stg.web.app";
}

/**
 * 環境に応じてメール送信先とsubjectを解決
 * @param {string} appEnv - APP_ENV 環境変数の値
 * @param {string} stgOverrideTo - STG_EMAIL_OVERRIDE_TO 環境変数の値
 * @param {string} originalTo - 元の送信先メールアドレス
 * @param {string} originalSubject - 元の件名
 * @return {{to: string, subject: string, shouldSkip: boolean}} 解決された送信先と件名
 */
function resolveEmailDestination(appEnv, stgOverrideTo, originalTo, originalSubject) {
  const isProduction = appEnv === "prod";

  if (isProduction) {
    return {
      to: originalTo,
      subject: originalSubject,
      shouldSkip: false,
    };
  }

  // stg環境
  if (!stgOverrideTo || stgOverrideTo.trim() === "") {
    console.warn(`[STG] STG_EMAIL_OVERRIDE_TO is not set. Email will be skipped for safety. Original recipient: ${originalTo}`);
    return {
      to: originalTo,
      subject: originalSubject,
      shouldSkip: true,
    };
  }

  return {
    to: stgOverrideTo.trim(),
    subject: `[STG] ${originalSubject}`,
    shouldSkip: false,
  };
}

/**
 * 注文作成 + トークン生成 + メール送信
 *
 * リクエストボディ:
 * {
 *   plan: "simple" | "pro",
 *   formData: { targetName, targetColor, ... },
 *   email: "user@example.com"
 * }
 */
exports.createOrder = onRequest({
  cors: true,
  secrets: ["SENDGRID_API_KEY", "SLACK_WEBHOOK_URL", "APP_ENV", "STG_EMAIL_OVERRIDE_TO"],
}, async (req, res) => {
  // CORSヘッダー設定
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {plan, formData, email} = req.body;

    // パラメータ検証
    if (!plan || !formData || !email) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["plan", "formData", "email"],
      });
      return;
    }

    // メールアドレスのフォーマット検証
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: "有効なメールアドレスを入力してください",
      });
      return;
    }

    // レート制限チェック（1分間に3回まで）
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const rateLimit = await checkRateLimit(ip, 3, 60000);

    if (!rateLimit.allowed) {
      res.status(429).json({
        error: "リクエストが多すぎます。しばらくしてから再試行してください。",
      });
      return;
    }

    console.log(`Creating order for: ${email}, plan: ${plan}`);

    // トークン生成（32バイト = 64文字のhex）
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // トークン有効期限（30日後）
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Firestoreに注文を保存
    const orderRef = await admin.firestore().collection("orders").add({
      userId: null, // 一般ユーザーはnull
      userEmail: email,
      plan: plan,
      ...formData,
      status: "waiting",
      tokenHash: tokenHash,
      tokenCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      tokenExpiresAt: tokenExpiresAt,
      tokenAccessCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const orderId = orderRef.id;
    console.log(`Order created: ${orderId}`);

    // 環境変数取得（メール送信とURL生成で共通使用）
    const appEnv = process.env.APP_ENV || "prod";
    const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";

    // 専用URL生成（環境に応じてドメイン切替）
    const frontendBaseUrl = resolveFrontendBaseUrl(appEnv);
    const orderUrl = `${frontendBaseUrl}/o/${orderId}?t=${token}`;
    console.log(`Order URL generated: ${orderUrl} (env: ${appEnv})`);

    // メール本文作成
    const emailBody = `${email}様のバースデーソング作成を承りました。

以下のURLから進捗状況を確認できます：
${orderUrl}

※このURLは30日間有効です。
※完成次第、こちらのメールアドレスにお知らせします。

---
Songift - 世界に一つのバースデーソング`;

    // SendGrid でメール送信
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY is not configured");
    }

    sgMail.setApiKey(sendgridApiKey.trim());

    // 環境に応じてメール送信先を解決
    const originalSubject = `【Songift】ご注文を受け付けました - ${email}様`;
    const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, email, originalSubject);

    if (emailDestination.shouldSkip) {
      // STG環境でメール送信先が未設定の場合はスキップ
      console.log(`[STG] Email sending skipped (no override address configured)`);
    } else {
      const msg = {
        to: emailDestination.to,
        from: {
          email: "fukui@gadandan.co.jp",
          name: "Songift",
        },
        subject: emailDestination.subject,
        text: emailBody,
        html: emailBody.replace(/\n/g, "<br>"),
      };

      await sgMail.send(msg);
      console.log(`Confirmation email sent to: ${emailDestination.to} (original: ${email}, env: ${appEnv})`);
    }

    // Slack通知送信（PROD環境のみ）
    if (appEnv === "prod") {
      const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (slackWebhookUrl) {
        const slackMessage = plan === "simple"
          ? `🎉 *新しい注文が入りました！*\n\n*注文ID:* ${orderId}\n*プラン:* 魔法診断（簡単モード）\n*お名前:* ${formData.targetName}\n*色:* ${formData.targetColor}\n*気持ち:* ${Array.isArray(formData.targetFeeling) ? formData.targetFeeling.join(", ") : formData.targetFeeling}\n*魔法の言葉:* ${formData.magicWord}\n*魔法:* ${formData.magicSpell}\n*メール:* ${email}`
          : `🎉 *新しい注文が入りました！*\n\n*注文ID:* ${orderId}\n*プラン:* プロモード\n*お名前:* ${formData.targetName}\n*ジャンル:* ${formData.proGenre}\n*楽器:* ${Array.isArray(formData.proInstruments) ? formData.proInstruments.join(", ") : formData.proInstruments}\n*性別:* ${formData.proGender}\n*メッセージ1:* ${formData.proMessage1}\n*メッセージ2:* ${formData.proMessage2}\n*メール:* ${email}`;

        await axios.post(slackWebhookUrl, {
          text: slackMessage,
        });

        console.log("Slack notification sent");
      }
    } else {
      console.log(`[${appEnv.toUpperCase()}] Slack notification skipped in createOrder (non-production environment)`);
    }

    // レスポンスメッセージを環境に応じて調整
    let responseMessage = "注文を受け付けました。メールをご確認ください。";
    if (appEnv !== "prod") {
      if (emailDestination.shouldSkip) {
        responseMessage = "注文を受け付けました（STG環境: メール送信はスキップされました）。";
      } else {
        responseMessage = `注文を受け付けました（STG環境: テスト用メールアドレスに送信されました）。`;
      }
    }

    res.status(200).json({
      success: true,
      orderId: orderId,
      message: responseMessage,
    });
  } catch (error) {
    console.error("Error creating order:", error);

    res.status(500).json({
      error: "注文の作成に失敗しました",
      message: error.message,
    });
  }
});

/**
 * Slack通知送信
 *
 * リクエストボディ:
 * {
 *   plan: "simple" | "pro",
 *   formData: { targetName, ... },
 *   userEmail: "user@example.com"
 * }
 */
exports.sendSlackNotification = onRequest({
  cors: true,
  secrets: ["SLACK_WEBHOOK_URL", "APP_ENV"],
}, async (req, res) => {
  // CORSヘッダー設定
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    // 環境判定（STG環境ではSlack通知をスキップ - パラメータ検証より先に実施）
    const appEnv = process.env.APP_ENV || "prod";
    if (appEnv !== "prod") {
      console.log(`[${appEnv.toUpperCase()}] Slack notification skipped (non-production environment)`);
      res.status(200).json({
        success: true,
        message: "Slack通知はSTG環境のためスキップされました",
      });
      return;
    }

    const {plan, formData, userEmail} = req.body;

    // パラメータ検証
    if (!plan || !formData || !userEmail) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["plan", "formData", "userEmail"],
      });
      return;
    }

    console.log(`Processing Slack notification for plan: ${plan}`);

    // Slack Webhook URL取得
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      throw new Error("SLACK_WEBHOOK_URL is not configured");
    }

    // Slackメッセージ作成
    const slackMessage = plan === "simple"
      ? `🎉 *新しい注文が入りました！*\n\n*プラン:* 魔法診断（簡単モード）\n*お名前:* ${formData.targetName}\n*色:* ${formData.targetColor}\n*気持ち:* ${Array.isArray(formData.targetFeeling) ? formData.targetFeeling.join(", ") : formData.targetFeeling}\n*魔法の言葉:* ${formData.magicWord}\n*魔法:* ${formData.magicSpell}\n*ユーザー:* ${userEmail}`
      : `🎉 *新しい注文が入りました！*\n\n*プラン:* プロモード\n*お名前:* ${formData.targetName}\n*ジャンル:* ${formData.proGenre}\n*楽器:* ${Array.isArray(formData.proInstruments) ? formData.proInstruments.join(", ") : formData.proInstruments}\n*性別:* ${formData.proGender}\n*メッセージ1:* ${formData.proMessage1}\n*メッセージ2:* ${formData.proMessage2}\n*ユーザー:* ${userEmail}`;

    // Slackに送信
    await axios.post(slackWebhookUrl, {
      text: slackMessage,
    });

    console.log(`Slack notification sent successfully`);

    res.status(200).json({
      success: true,
      message: "Slack通知送信完了",
    });
  } catch (error) {
    console.error("Error sending Slack notification:", error);

    res.status(500).json({
      error: "Slack通知送信に失敗しました",
      message: error.message,
    });
  }
});

/**
 * MP3添付バースデーソング納品メール送信
 *
 * リクエストボディ:
 * {
 *   orderId: "注文ID",
 *   recipientEmail: "送信先メールアドレス",
 *   recipientName: "送信先名前",
 *   mp3Url: "MP3ファイルのURL",
 *   emailBody: "メール本文"
 * }
 */
exports.sendBirthdaySongEmail = onRequest({
  cors: true,
  secrets: ["SENDGRID_API_KEY", "APP_ENV", "STG_EMAIL_OVERRIDE_TO"],
}, async (req, res) => {
  // CORSヘッダー設定
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {orderId, recipientEmail, recipientName, mp4Url, emailBody} = req.body;

    // パラメータ検証
    if (!orderId || !recipientEmail || !recipientName || !mp4Url || !emailBody) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["orderId", "recipientEmail", "recipientName", "mp4Url", "emailBody"],
      });
      return;
    }

    console.log(`Processing email for order ${orderId}`);

    // MP4ファイルをダウンロード
    console.log(`Downloading MP4 from: ${mp4Url}`);
    const mp4Response = await axios.get(mp4Url, {
      responseType: "arraybuffer",
      timeout: 120000, // 120秒（MP4ファイルは大きいため）
    });

    const mp4Buffer = Buffer.from(mp4Response.data);
    const mp4Base64 = mp4Buffer.toString("base64");

    // サイズチェック
    const fileSizeMB = mp4Buffer.length / (1024 * 1024);
    console.log(`MP4 downloaded, size: ${fileSizeMB.toFixed(2)}MB`);
    if (fileSizeMB > 25) {
      console.warn(`⚠️ MP4 file size is large: ${fileSizeMB.toFixed(2)}MB (SendGrid limit: 30MB)`);
    }

    // SendGrid設定
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY is not configured");
    }

    sgMail.setApiKey(sendgridApiKey.trim());

    // 環境に応じてメール送信先を解決
    const appEnv = process.env.APP_ENV || "prod";
    const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";
    const originalSubject = `【Songift】世界に一つのバースデーソングをお届けします - ${recipientName}様`;
    const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, recipientEmail, originalSubject);

    if (emailDestination.shouldSkip) {
      // STG環境でメール送信先が未設定の場合はスキップ
      console.log(`[STG] Email sending skipped (no override address configured). Original recipient: ${recipientEmail}`);
    } else {
      // メール送信
      const msg = {
        to: emailDestination.to,
        from: {
          email: "fukui@gadandan.co.jp",
          name: "Songift",
        },
        subject: emailDestination.subject,
        text: emailBody,
        html: emailBody.replace(/\n/g, "<br>"),
        attachments: [
          {
            content: mp4Base64,
            filename: `birthday_song_${recipientName}.mp4`,
            type: "video/mp4",
            disposition: "attachment",
          },
        ],
      };

      await sgMail.send(msg);

      console.log(`Email sent successfully to ${emailDestination.to} (original: ${recipientEmail}, env: ${appEnv})`);
    }

    // Firestoreのステータス更新
    await admin.firestore().collection("orders").doc(orderId).update({
      deliveryStatus: "sent",
      deliverySentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // レスポンスメッセージを環境に応じて調整
    let responseMessage = "メール送信完了";
    if (appEnv !== "prod") {
      if (emailDestination.shouldSkip) {
        responseMessage = "メール送信完了（STG環境: 送信はスキップされました）";
      } else {
        responseMessage = "メール送信完了（STG環境: テスト用メールアドレスに送信されました）";
      }
    }

    res.status(200).json({
      success: true,
      message: responseMessage,
      orderId: orderId,
    });
  } catch (error) {
    console.error("Error sending email:", error);

    // エラーログをFirestoreに保存
    if (req.body.orderId) {
      try {
        await admin.firestore().collection("orders").doc(req.body.orderId).update({
          deliveryStatus: "error",
          deliveryError: error.message,
          deliveryErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        console.error("Failed to update error status:", updateError);
      }
    }

    res.status(500).json({
      error: "メール送信に失敗しました",
      message: error.message,
    });
  }
});

/**
 * プレビュー案内メール送信
 */
exports.sendPreviewEmail = onRequest({
  cors: true,
  secrets: ["SENDGRID_API_KEY", "APP_ENV", "STG_EMAIL_OVERRIDE_TO"],
}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {orderId, recipientEmail, recipientName, emailBody} = req.body;

    if (!orderId || !recipientEmail || !recipientName || !emailBody) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["orderId", "recipientEmail", "recipientName", "emailBody"],
      });
      return;
    }

    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) throw new Error("SENDGRID_API_KEY is not configured");
    sgMail.setApiKey(sendgridApiKey.trim());

    const appEnv = process.env.APP_ENV || "prod";
    const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";
    const originalSubject = `【Songift】バースデーソングのプレビューが完成しました - ${recipientName}様`;
    const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, recipientEmail, originalSubject);

    if (!emailDestination.shouldSkip) {
      const msg = {
        to: emailDestination.to,
        from: {email: "fukui@gadandan.co.jp", name: "Songift"},
        subject: emailDestination.subject,
        text: emailBody,
        html: emailBody.replace(/\n/g, "<br>"),
      };
      await sgMail.send(msg);
      console.log(`[sendPreviewEmail] Email sent to ${emailDestination.to}`);
    }

    await admin.firestore().collection("orders").doc(orderId).update({
      previewEmailStatus: "sent",
      previewEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({success: true, message: "プレビュー案内メールを送信しました"});
  } catch (error) {
    console.error("[sendPreviewEmail] Error:", error);
    if (req.body.orderId) {
      await admin.firestore().collection("orders").doc(req.body.orderId).update({
        previewEmailStatus: "error",
        previewEmailError: error.message,
      });
    }
    res.status(500).json({error: "メール送信に失敗しました", message: error.message});
  }
});

/**
 * トークン認証で注文情報を取得
 *
 * リクエストボディ:
 * {
 *   orderId: "注文ID",
 *   token: "64文字のhex文字列"
 * }
 */
exports.getOrderByToken = onRequest({
  cors: true,
}, async (req, res) => {
  // CORSヘッダー設定
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {orderId, token} = req.body;

    // パラメータ検証
    if (!orderId || !token) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["orderId", "token"],
      });
      return;
    }

    // レート制限チェック（1分間に10回まで）
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const rateLimitKey = `${orderId}_${ip}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 10, 60000);

    if (!rateLimit.allowed) {
      res.status(429).json({
        error: "アクセスが多すぎます。しばらくしてから再試行してください。",
      });
      return;
    }

    // トークンハッシュ計算
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Firestoreから注文を取得
    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      res.status(404).json({
        error: "注文が見つかりません",
      });
      return;
    }

    const order = orderDoc.data();

    // トークンハッシュ照合
    if (order.tokenHash !== tokenHash) {
      res.status(403).json({
        error: "無効なトークンです",
      });
      return;
    }

    // 有効期限チェック
    if (order.tokenExpiresAt && order.tokenExpiresAt.toDate() < new Date()) {
      res.status(403).json({
        error: "トークンの有効期限が切れています",
      });
      return;
    }

    // アクセスカウント更新（オプション）
    await orderDoc.ref.update({
      tokenAccessCount: admin.firestore.FieldValue.increment(1),
      lastTokenAccessAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 必要最小限のデータを返す（管理情報は除外）
    const safeOrder = {
      id: orderId,
      plan: order.plan,
      targetName: order.targetName,
      status: order.status,
      createdAt: order.createdAt,
      // 完成時のみ曲URLを含める
      selectedSongUrl: order.status === "completed" ? order.selectedSongUrl : null,
      generatedLyrics: order.status === "completed" || order.status === "song_generated" || order.status === "song_selected" ? order.generatedLyrics : null,
      // Phase1: 動画生成関連フィールド
      videoGenerationStatus: order.videoGenerationStatus || null,
      previewAudioPath: order.previewAudioPath || null,
      fullVideoPath: order.fullVideoPath || null,
      // Phase1: Paywall関連フィールド
      paymentStatus: order.paymentStatus || "unpaid",
      paidAt: order.paidAt || null,
      accessExpiresAt: order.accessExpiresAt || null,
    };

    res.status(200).json({
      success: true,
      order: safeOrder,
    });
  } catch (error) {
    console.error("Error getting order by token:", error);

    res.status(500).json({
      error: "注文情報の取得に失敗しました",
      message: error.message,
    });
  }
});

// ============================================
// Phase1: Video Generation & Signed URL Functions
// ============================================

/**
 * generateVideoAssets - 動画アセット生成（Callable Function）
 *
 * 管理画面から呼び出し。Suno音声をStorageに保存してから、
 * Cloud Runでプレビュー音声とフル動画を生成。
 *
 * 入力: { orderId: string }
 * 出力: { success: boolean, message: string }
 */
exports.generateVideoAssets = onCall({
  timeoutSeconds: 540, // 9分
  memory: "1GiB",
  secrets: ["VIDEO_GENERATOR_URL"],
}, async (request) => {
  const {orderId} = request.data;

  if (!orderId) {
    throw new Error("orderId is required");
  }

  console.log(`[generateVideoAssets] Starting for order: ${orderId}`);

  try {
    // 1. Firestore から order データ取得
    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const order = orderDoc.data();

    if (!order.selectedSongUrl) {
      throw new Error("selectedSongUrl is not set. Please select a song first.");
    }

    // 2. Suno音声URLをStorageにダウンロード保存
    const sourceAudioPath = `audios/${orderId}/source.mp3`;
    const bucketName = `${process.env.GCLOUD_PROJECT}.firebasestorage.app`;
    const bucket = storage.bucket(bucketName);

    console.log(`[generateVideoAssets] Downloading Suno audio from: ${order.selectedSongUrl}`);

    const audioResponse = await axios.get(order.selectedSongUrl, {
      responseType: "arraybuffer",
      timeout: 60000, // 60秒タイムアウト
    });

    const audioBuffer = Buffer.from(audioResponse.data);

    await bucket.file(sourceAudioPath).save(audioBuffer, {
      metadata: {
        contentType: "audio/mpeg",
      },
    });

    console.log(`[generateVideoAssets] Saved source audio to: ${sourceAudioPath}`);

    // Firestore更新: sourceAudioPath保存
    await orderDoc.ref.update({
      sourceAudioPath: sourceAudioPath,
      videoGenerationStatus: "processing",
    });

    // 3. Cloud Run 認証設定（ID トークン）
    const videoGeneratorUrl = process.env.VIDEO_GENERATOR_URL;
    if (!videoGeneratorUrl) {
      throw new Error("VIDEO_GENERATOR_URL is not configured");
    }

    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(videoGeneratorUrl);

    // 4. Cloud Run /generate-preview-audio 呼び出し
    const previewAudioPath = `audios/${orderId}/preview.mp3`;

    console.log(`[generateVideoAssets] Calling Cloud Run: /generate-preview-audio`);

    const previewResponse = await client.request({
      url: `${videoGeneratorUrl}/generate-preview-audio`,
      method: "POST",
      data: {
        sourceAudioPath: sourceAudioPath,
        outputPath: previewAudioPath,
      },
      timeout: 300000, // 5分タイムアウト
    });

    if (!previewResponse.data.success) {
      throw new Error(`Preview audio generation failed: ${previewResponse.data.error}`);
    }

    console.log(`[generateVideoAssets] Preview audio generated: ${previewAudioPath}`);

    // Firestore更新: previewAudioPath保存
    await orderDoc.ref.update({
      previewAudioPath: previewAudioPath,
    });

    // 5. Cloud Run /generate-full-video 呼び出し
    const fullVideoPath = `videos/${orderId}/full.mp4`;

    console.log(`[generateVideoAssets] Calling Cloud Run: /generate-full-video`);

    const videoResponse = await client.request({
      url: `${videoGeneratorUrl}/generate-full-video`,
      method: "POST",
      data: {
        sourceAudioPath: sourceAudioPath,
        outputPath: fullVideoPath,
        backgroundImagePath: "default",
      },
      timeout: 480000, // 8分タイムアウト
    });

    if (!videoResponse.data.success) {
      throw new Error(`Full video generation failed: ${videoResponse.data.error}`);
    }

    console.log(`[generateVideoAssets] Full video generated: ${fullVideoPath}`);

    // duration情報を取得
    const audioDurationSec = videoResponse.data.audioDurationSeconds || null;
    const videoDurationSec = videoResponse.data.videoDurationSeconds || null;

    // 6. Firestore更新: 完了
    await orderDoc.ref.update({
      fullVideoPath: fullVideoPath,
      fullVideoAudioDurationSec: audioDurationSec,
      fullVideoDurationSec: videoDurationSec,
      videoGenerationStatus: "completed",
      videoGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[generateVideoAssets] Completed for order: ${orderId}`);

    return {
      success: true,
      message: "動画アセット生成が完了しました",
    };
  } catch (error) {
    console.error(`[generateVideoAssets] Error for order ${orderId}:`, error);

    // Firestore更新: エラー
    await admin.firestore().collection("orders").doc(orderId).update({
      videoGenerationStatus: "failed",
      videoGenerationError: error.message,
    });

    throw new Error(`動画アセット生成に失敗しました: ${error.message}`);
  }
});

/**
 * getPreviewSignedUrl - プレビュー音声の署名URL取得（Callable Function）
 *
 * 顧客画面から呼び出し。未課金でも発行可能。
 *
 * 入力: { orderId: string, token: string }
 * 出力: { signedUrl: string }
 */
exports.getPreviewSignedUrl = onCall({
  cors: true,
}, async (request) => {
  const {orderId, token} = request.data;

  if (!orderId || !token) {
    throw new Error("orderId and token are required");
  }

  console.log(`[getPreviewSignedUrl] Request for order: ${orderId}`);

  try {
    // 1. token 検証（getOrderByToken と同じロジック）
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      throw new Error("注文が見つかりません");
    }

    const order = orderDoc.data();

    if (order.tokenHash !== tokenHash) {
      throw new Error("無効なトークンです");
    }

    if (order.tokenExpiresAt && order.tokenExpiresAt.toDate() < new Date()) {
      throw new Error("トークンの有効期限が切れています");
    }

    // 2. previewAudioPath が存在するか確認
    if (!order.previewAudioPath) {
      throw new Error("プレビュー音声がまだ生成されていません");
    }

    // 3. 署名URL発行（有効時間: 20分）
    const bucketName = `${process.env.GCLOUD_PROJECT}.firebasestorage.app`;
    const bucket = storage.bucket(bucketName);

    const [signedUrl] = await bucket.file(order.previewAudioPath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 20 * 60 * 1000, // 20分
    });

    console.log(`[getPreviewSignedUrl] Signed URL issued for: ${order.previewAudioPath}`);

    return {
      signedUrl: signedUrl,
    };
  } catch (error) {
    console.error(`[getPreviewSignedUrl] Error for order ${orderId}:`, error);
    throw new Error(error.message);
  }
});

/**
 * getFullSignedUrl - フル動画の署名URL取得（Callable Function）
 *
 * 顧客画面から呼び出し。paid + 期限内のときだけ発行。
 *
 * 入力: { orderId: string, token: string }
 * 出力: { signedUrl: string, remainingDays: number } | { error: string, message: string }
 */
exports.getFullSignedUrl = onCall({
  cors: true,
}, async (request) => {
  const {orderId, token} = request.data;

  if (!orderId || !token) {
    throw new Error("orderId and token are required");
  }

  console.log(`[getFullSignedUrl] Request for order: ${orderId}`);

  try {
    // 1. token 検証
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      throw new Error("注文が見つかりません");
    }

    const order = orderDoc.data();

    if (order.tokenHash !== tokenHash) {
      throw new Error("無効なトークンです");
    }

    if (order.tokenExpiresAt && order.tokenExpiresAt.toDate() < new Date()) {
      throw new Error("トークンの有効期限が切れています");
    }

    // 2. paymentStatus === "paid" チェック
    if (order.paymentStatus !== "paid") {
      throw new Error("unpaid:フル動画は課金後にご利用いただけます");
    }

    // 3. accessExpiresAt > now チェック
    const now = new Date();
    const accessExpiresAt = order.accessExpiresAt ? order.accessExpiresAt.toDate() : null;

    if (!accessExpiresAt || accessExpiresAt < now) {
      throw new Error("expired:アクセス期限が切れています");
    }

    // 4. fullVideoPath が存在するか確認
    if (!order.fullVideoPath) {
      throw new Error("フル動画がまだ生成されていません");
    }

    // 5. 署名URL発行（有効時間: 20分）
    const bucketName = `${process.env.GCLOUD_PROJECT}.firebasestorage.app`;
    const bucket = storage.bucket(bucketName);

    // iPhone Safari でもダウンロード扱いにするため、responseDisposition を指定
    const filename = `birthday_song_full_${orderId}.mp4`;
    const [signedUrl] = await bucket.file(order.fullVideoPath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 20 * 60 * 1000, // 20分
      responseDisposition: `attachment; filename="${filename}"`,
      responseType: "video/mp4",
    });

    // 6. 残り日数計算
    const remainingMs = accessExpiresAt.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

    console.log(`[getFullSignedUrl] Signed URL issued for: ${order.fullVideoPath}, remaining days: ${remainingDays}`);

    return {
      signedUrl: signedUrl,
      remainingDays: remainingDays,
    };
  } catch (error) {
    console.error(`[getFullSignedUrl] Error for order ${orderId}:`, error);

    // エラーメッセージに "unpaid:" や "expired:" が含まれている場合はそのまま投げる
    if (error.message.startsWith("unpaid:") || error.message.startsWith("expired:")) {
      throw new Error(error.message);
    }

    throw new Error(error.message);
  }
});

/**
 * getAdminPreviewSignedUrl - 管理者向けプレビュー音声の署名URL取得（Callable Function）
 *
 * 管理画面から呼び出し。token/paid/accessExpiresAtチェックなし。
 *
 * 入力: { orderId: string }
 * 出力: { signedUrl: string, expiresInSeconds: number }
 */
exports.getAdminPreviewSignedUrl = onCall({
  cors: true,
}, async (request) => {
  const {orderId} = request.data;

  if (!orderId) {
    throw new Error("orderId is required");
  }

  console.log(`[getAdminPreviewSignedUrl] Request for order: ${orderId}`);

  try {
    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      throw new Error("注文が見つかりません");
    }

    const order = orderDoc.data();

    // previewAudioPath が存在するか確認
    if (!order.previewAudioPath) {
      throw new Error("プレビュー音声がまだ生成されていません");
    }

    // 署名URL発行（有効時間: 20分）
    const bucketName = `${process.env.GCLOUD_PROJECT}.firebasestorage.app`;
    const bucket = storage.bucket(bucketName);

    const [signedUrl] = await bucket.file(order.previewAudioPath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 20 * 60 * 1000, // 20分
    });

    console.log(`[getAdminPreviewSignedUrl] Signed URL issued for: ${order.previewAudioPath}`);

    return {
      signedUrl: signedUrl,
      expiresInSeconds: 1200,
    };
  } catch (error) {
    console.error(`[getAdminPreviewSignedUrl] Error for order ${orderId}:`, error);
    throw new Error(error.message);
  }
});

/**
 * getAdminFullSignedUrl - 管理者向けフル動画の署名URL取得（Callable Function）
 *
 * 管理画面から呼び出し。token/paid/accessExpiresAtチェックなし。
 *
 * 入力: { orderId: string }
 * 出力: { signedUrl: string, expiresInSeconds: number }
 */
exports.getAdminFullSignedUrl = onCall({
  cors: true,
}, async (request) => {
  const {orderId} = request.data;

  if (!orderId) {
    throw new Error("orderId is required");
  }

  console.log(`[getAdminFullSignedUrl] Request for order: ${orderId}`);

  try {
    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      throw new Error("注文が見つかりません");
    }

    const order = orderDoc.data();

    // fullVideoPath が存在するか確認
    if (!order.fullVideoPath) {
      throw new Error("フル動画がまだ生成されていません");
    }

    // 署名URL発行（有効時間: 20分）
    const bucketName = `${process.env.GCLOUD_PROJECT}.firebasestorage.app`;
    const bucket = storage.bucket(bucketName);

    const [signedUrl] = await bucket.file(order.fullVideoPath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 20 * 60 * 1000, // 20分
    });

    console.log(`[getAdminFullSignedUrl] Signed URL issued for: ${order.fullVideoPath}`);

    return {
      signedUrl: signedUrl,
      expiresInSeconds: 1200,
    };
  } catch (error) {
    console.error(`[getAdminFullSignedUrl] Error for order ${orderId}:`, error);
    throw new Error(error.message);
  }
});

/**
 * 支払い処理（顧客ページから呼び出される）
 * - isPaidをtrueに更新
 * - MP4動画をメール送信
 */
exports.processPayment = onRequest({
  cors: true,
  secrets: ["SENDGRID_API_KEY", "APP_ENV", "STG_EMAIL_OVERRIDE_TO"],
}, async (req, res) => {
  // CORSヘッダー設定
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {orderId} = req.body;

    if (!orderId) {
      res.status(400).json({error: "orderIdが必要です"});
      return;
    }

    console.log(`[processPayment] Processing payment for order ${orderId}`);

    // 1. 注文情報取得
    const orderRef = admin.firestore().collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      res.status(404).json({error: "注文が見つかりません"});
      return;
    }

    const order = orderDoc.data();

    // 既に支払い済みの場合はスキップ
    if (order.isPaid) {
      console.log(`[processPayment] Order ${orderId} is already paid`);
      res.status(200).json({success: true, message: "既に支払い済みです"});
      return;
    }

    // フル動画が存在するか確認
    if (!order.fullVideoPath) {
      res.status(400).json({error: "フル動画がまだ生成されていません"});
      return;
    }

    // 2. Firestore更新: isPaid = true
    await orderRef.update({
      isPaid: true,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[processPayment] Order ${orderId} marked as paid`);

    // 3. フル動画MP4の署名URL取得
    const bucket = admin.storage().bucket();
    const fullVideoFile = bucket.file(order.fullVideoPath);

    const [fullVideoUrl] = await fullVideoFile.getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 60 * 1000, // 10分間有効
    });

    console.log(`[processPayment] Generated signed URL for full video`);

    // 4. MP4納品メール送信
    // まずメール本文を取得（管理画面で事前生成されている想定）
    const emailBody = order.deliveryEmailBody || `
${order.userEmail} 様

お支払いいただきありがとうございます。
世界に一つのバースデーソングをお届けします。

添付のMP4ファイルをダウンロードしてご覧ください。
縦型動画（1080x1920）なのでスマホでの再生に最適です。

Songift運営チーム
    `.trim();

    // SendGrid設定
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY is not configured");
    }

    sgMail.setApiKey(sendgridApiKey.trim());

    // MP4ダウンロード
    const mp4Response = await axios.get(fullVideoUrl, {
      responseType: "arraybuffer",
      timeout: 120000,
    });

    const mp4Buffer = Buffer.from(mp4Response.data);
    const mp4Base64 = mp4Buffer.toString("base64");

    const fileSizeMB = mp4Buffer.length / (1024 * 1024);
    console.log(`[processPayment] MP4 size: ${fileSizeMB.toFixed(2)}MB`);

    if (fileSizeMB > 25) {
      console.warn(`[processPayment] ⚠️ MP4 file size is large: ${fileSizeMB.toFixed(2)}MB`);
    }

    // 環境に応じてメール送信先を解決
    const appEnv = process.env.APP_ENV || "prod";
    const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";
    const originalSubject = `【Songift】世界に一つのバースデーソングをお届けします - ${order.userEmail}様`;
    const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, order.userEmail, originalSubject);

    if (!emailDestination.shouldSkip) {
      const msg = {
        to: emailDestination.to,
        from: {
          email: "fukui@gadandan.co.jp",
          name: "Songift",
        },
        subject: emailDestination.subject,
        text: emailBody,
        html: emailBody.replace(/\n/g, "<br>"),
        attachments: [
          {
            content: mp4Base64,
            filename: `birthday_song_${order.targetName}.mp4`,
            type: "video/mp4",
            disposition: "attachment",
          },
        ],
      };

      await sgMail.send(msg);
      console.log(`[processPayment] MP4 delivery email sent to ${emailDestination.to}`);
    }

    // 5. Firestoreに送信ステータス記録
    await orderRef.update({
      deliveryStatus: "sent",
      deliverySentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: "支払い処理が完了し、MP4動画をメールでお送りしました",
    });
  } catch (error) {
    console.error("[processPayment] Error:", error);

    res.status(500).json({
      error: "支払い処理に失敗しました",
      message: error.message,
    });
  }
});

/**
 * 返金処理（管理画面から呼び出される）
 * - isPaidをfalseに戻す
 * - 返金通知メールを送信
 */
exports.processRefund = onRequest({
  cors: true,
  secrets: ["SENDGRID_API_KEY", "APP_ENV", "STG_EMAIL_OVERRIDE_TO"],
}, async (req, res) => {
  // CORSヘッダー設定
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {orderId, recipientEmail, recipientName} = req.body;

    if (!orderId || !recipientEmail || !recipientName) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["orderId", "recipientEmail", "recipientName"],
      });
      return;
    }

    console.log(`[processRefund] Processing refund for order ${orderId}`);

    // 1. Firestore更新: isPaid = false
    const orderRef = admin.firestore().collection("orders").doc(orderId);
    await orderRef.update({
      isPaid: false,
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[processRefund] Order ${orderId} marked as refunded`);

    // 2. 返金通知メール送信
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY is not configured");
    }

    sgMail.setApiKey(sendgridApiKey.trim());

    const emailBody = `
${recipientName} 様

Songiftをご利用いただきありがとうございました。

ご注文いただいた内容について、返金処理を完了いたしました。
ご不明な点がございましたら、お気軽にお問い合わせください。

Songift運営チーム
    `.trim();

    // 環境に応じてメール送信先を解決
    const appEnv = process.env.APP_ENV || "prod";
    const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";
    const originalSubject = `【Songift】返金処理完了のお知らせ - ${recipientName}様`;
    const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, recipientEmail, originalSubject);

    if (!emailDestination.shouldSkip) {
      const msg = {
        to: emailDestination.to,
        from: {
          email: "fukui@gadandan.co.jp",
          name: "Songift",
        },
        subject: emailDestination.subject,
        text: emailBody,
        html: emailBody.replace(/\n/g, "<br>"),
      };

      await sgMail.send(msg);
      console.log(`[processRefund] Refund notification email sent to ${emailDestination.to}`);
    }

    // 3. Firestoreに送信ステータス記録
    await orderRef.update({
      refundEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: "返金処理が完了し、通知メールを送信しました",
    });
  } catch (error) {
    console.error("[processRefund] Error:", error);

    // エラーログをFirestoreに保存
    if (req.body.orderId) {
      try {
        await admin.firestore().collection("orders").doc(req.body.orderId).update({
          refundEmailError: error.message,
        });
      } catch (updateError) {
        console.error("[processRefund] Failed to update refund error:", updateError);
      }
    }

    res.status(500).json({
      error: "返金処理に失敗しました",
      message: error.message,
    });
  }
});

