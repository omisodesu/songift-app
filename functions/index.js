const {onRequest, onCall} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const axios = require("axios");
const crypto = require("crypto");
const {Storage} = require("@google-cloud/storage");
const {GoogleAuth} = require("google-auth-library");
const {COLLECTIONS} = require("@songift/shared");

admin.initializeApp();

// Firestore collection references
const db = admin.firestore();
const ordersCollection = () => db.collection(COLLECTIONS.ORDERS);
const automationQueueCollection = () => db.collection(COLLECTIONS.AUTOMATION_QUEUE);
const feedbackCollection = () => db.collection(COLLECTIONS.FEEDBACK);
const visitorsCollection = () => db.collection(COLLECTIONS.VISITORS);
const followupQueueCollection = () => db.collection(COLLECTIONS.FOLLOWUP_QUEUE);
const rateLimitsCollection = () => db.collection(COLLECTIONS.RATE_LIMITS);
const storage = new Storage();

/**
 * レート制限チェック（Firestoreベース）
 */
async function checkRateLimit(ip, maxRequests, windowMs) {
  const rateLimitRef = rateLimitsCollection().doc(ip);
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
      accessToken: token, // 生トークンも保存（プレビューメール等で使用）
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

    // フィードバックURL生成（注文受付メール用）
    const feedbackUrl = `${frontendBaseUrl}/feedback?ch=order_received&oid=${orderId}`;

    // メール本文作成
    const emailBody = `${email}様のバースデーソング作成を承りました。

以下のURLから進捗状況を確認できます：
${orderUrl}

※このURLは30日間有効です。
※完成次第、こちらのメールアドレスにお知らせします。

---

ご注文時の操作についてご意見をお聞かせください（30秒で完了）：
${feedbackUrl}

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
 * プレビュー案内メール送信（再送用）
 * 固定テンプレートを使用、orderIdのみ必要
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
    const {orderId} = req.body;

    if (!orderId) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["orderId"],
      });
      return;
    }

    // 注文データ取得
    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({error: "注文が見つかりません"});
      return;
    }
    const order = orderDoc.data();

    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) throw new Error("SENDGRID_API_KEY is not configured");
    sgMail.setApiKey(sendgridApiKey.trim());

    const appEnv = process.env.APP_ENV || "prod";
    const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";

    // 固定テンプレートでメール本文生成
    const planName = order.plan === "simple" ? "魔法診断" : "プロ";
    const frontendBaseUrl = resolveFrontendBaseUrl(appEnv);
    const previewUrl = `${frontendBaseUrl}/o/${orderId}?t=${order.accessToken}`;

    // フィードバックURL生成
    const feedbackUrl = `${frontendBaseUrl}/feedback?ch=preview_email&oid=${orderId}`;

    const emailBody = `${order.userEmail} 様

この度は、Songiftの「${planName}」プランをご利用いただき、誠にありがとうございます。

${order.targetName}様への世界に一つだけのバースデーソング（15秒プレビュー）が完成いたしました。

以下のURLからプレビューをご確認いただけます：
${previewUrl}

気に入っていただけましたら、ページ内の支払いボタンから¥500をお支払いください。
お支払い確認後、フル動画（MP4）をメールでお届けします。

---

ご感想をお聞かせください：
${feedbackUrl}

---
Songift運営チーム`;

    const originalSubject = `【Songift】バースデーソングのプレビューが完成しました - ${order.userEmail}様`;
    const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, order.userEmail, originalSubject);

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
      createdAt: order.createdAt ? { seconds: order.createdAt.seconds || order.createdAt._seconds } : null,
      // 完成時のみ曲URLを含める
      selectedSongUrl: order.status === "completed" ? order.selectedSongUrl : null,
      generatedLyrics: order.status === "completed" || order.status === "song_generated" || order.status === "song_selected" ? order.generatedLyrics : null,
      // Phase1: 動画生成関連フィールド
      videoGenerationStatus: order.videoGenerationStatus || null,
      previewAudioPath: order.previewAudioPath || null,
      fullVideoPath: order.fullVideoPath || null,
      // Phase1: Paywall関連フィールド
      isPaid: order.isPaid || false,
      paymentStatus: order.paymentStatus || "unpaid",
      paidAt: order.paidAt || null,
      accessExpiresAt: order.accessExpiresAt || null,
      // 2曲選択用: previews_ready時にgeneratedSongsを含める
      generatedSongs: order.status === "previews_ready" ? order.generatedSongs : null,
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
  secrets: ["VIDEO_GENERATOR_URL", "SENDGRID_API_KEY", "APP_ENV", "STG_EMAIL_OVERRIDE_TO"],
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
        backgroundImagePath: "default", // 互換用に残す
        backgroundTemplateId: order.backgroundTemplateId || "t1",
        lyricsText: order.generatedLyrics || "",
        // V2 lyrics alignment: Suno timestamped lyrics用
        sunoTaskId: order.sunoTaskId || null,
        selectedSongUrl: order.selectedSongUrl || null,
      },
      timeout: 480000, // 8分タイムアウト
    });

    if (!videoResponse.data.success) {
      throw new Error(`Full video generation failed: ${videoResponse.data.error}`);
    }

    console.log(`[generateVideoAssets] Full video generated: ${fullVideoPath}`);

    // duration情報とsubtitleModeを取得
    const audioDurationSec = videoResponse.data.audioDurationSeconds || null;
    const videoDurationSec = videoResponse.data.videoDurationSeconds || null;
    const subtitleMode = videoResponse.data.subtitleMode || null; // 'v2' | 'v1' | null

    // 6. Firestore更新: 完了
    await orderDoc.ref.update({
      fullVideoPath: fullVideoPath,
      fullVideoAudioDurationSec: audioDurationSec,
      fullVideoDurationSec: videoDurationSec,
      subtitleMode: subtitleMode,
      videoGenerationStatus: "completed",
      videoGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[generateVideoAssets] Full video completed: ${fullVideoPath}, subtitleMode: ${subtitleMode}`);

    // 7. プレビュー案内メールを自動送信（フル動画完成後に送信）
    const appEnv = process.env.APP_ENV || "prod";
    const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";
    const sendgridApiKey = process.env.SENDGRID_API_KEY;

    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey.trim());

      // 最新のorderデータを再取得
      const updatedOrder = (await orderDoc.ref.get()).data();
      const planName = updatedOrder.plan === "simple" ? "魔法診断" : "プロ";
      const frontendBaseUrl = resolveFrontendBaseUrl(appEnv);
      const previewUrl = `${frontendBaseUrl}/o/${orderId}?t=${updatedOrder.accessToken}`;

      // フィードバックURL生成
      const feedbackUrl = `${frontendBaseUrl}/feedback?ch=preview_email&oid=${orderId}`;

      const previewEmailBody = `${updatedOrder.userEmail} 様

この度は、Songiftの「${planName}」プランをご利用いただき、誠にありがとうございます。

${updatedOrder.targetName}様への世界に一つだけのバースデーソング（15秒プレビュー）が完成いたしました。

以下のURLからプレビューをご確認いただけます：
${previewUrl}

気に入っていただけましたら、ページ内の支払いボタンから¥500をお支払いください。
お支払い確認後、フル動画（MP4）をメールでお届けします。

---

ご感想をお聞かせください：
${feedbackUrl}

---
Songift運営チーム`;

      const originalSubject = `【Songift】バースデーソングのプレビューが完成しました - ${updatedOrder.userEmail}様`;
      const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, updatedOrder.userEmail, originalSubject);

      if (!emailDestination.shouldSkip) {
        const msg = {
          to: emailDestination.to,
          from: {email: "fukui@gadandan.co.jp", name: "Songift"},
          subject: emailDestination.subject,
          text: previewEmailBody,
          html: previewEmailBody.replace(/\n/g, "<br>"),
        };
        await sgMail.send(msg);
        console.log(`[generateVideoAssets] Preview email sent to ${emailDestination.to}`);
      }

      // プレビューメール送信ステータス更新
      await orderDoc.ref.update({
        previewEmailStatus: "sent",
        previewEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      console.warn("[generateVideoAssets] SENDGRID_API_KEY not configured, skipping preview email");
    }

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
 * - 動画生成ジョブをキューに追加
 * - 動画生成完了後にMP4メール送信（自動化システムで処理）
 */
exports.processPayment = onRequest({
  cors: true,
  secrets: ["APP_ENV"],
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

    // idempotent化: 支払い済み かつ 納品済み なら完全スキップ
    const alreadyPaid = !!order.isPaid;
    const alreadySent = order.deliveryStatus === "sent";

    console.log(`[processPayment] orderId=${orderId}, alreadyPaid=${alreadyPaid}, alreadySent=${alreadySent}, status=${order.status}`);

    if (alreadyPaid && alreadySent) {
      console.log(`[processPayment] Order ${orderId} already paid and delivered, skipping`);
      res.status(200).json({success: true, message: "既に支払い済み・納品済みです"});
      return;
    }

    // 曲が選択されているか確認
    if (order.status !== "song_selected" && order.status !== "video_generating" && order.status !== "completed") {
      res.status(400).json({error: "曲を選択してから支払いを行ってください"});
      return;
    }

    // 既に動画生成中または完了の場合はスキップ
    if (order.status === "video_generating") {
      res.status(200).json({success: true, message: "既に動画生成中です。完成までお待ちください。"});
      return;
    }

    if (order.status === "completed" && alreadyPaid) {
      res.status(200).json({success: true, message: "既に完了しています。"});
      return;
    }

    // 2. isPaid を更新
    if (!alreadyPaid) {
      await orderRef.update({
        isPaid: true,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[processPayment] Order ${orderId} marked as paid`);
    }

    // 3. 動画生成ジョブをキューに追加
    await admin.firestore().collection("automation_queue").add({
      orderId,
      step: "video",
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      scheduledAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. ステータス更新
    await orderRef.update({
      status: "video_generating",
      automationStatus: "running",
      currentStep: "video",
    });

    console.log(`[processPayment] Video generation job scheduled for order ${orderId}`);

    res.status(200).json({
      success: true,
      message: "支払いを受け付けました。動画を生成中です。完成したらメールでお届けします。",
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

// ============================================
// Feedback System Functions
// ============================================

/**
 * フィードバック送信
 *
 * リクエストボディ:
 * {
 *   visitorId: "UUID",
 *   orderId: "注文ID" (オプション),
 *   channel: "order_confirm" | "preview_email" | "delivery_email" | "followup_email" | "inquiry_form",
 *   rating: 1-5,
 *   comment: "コメント" (オプション),
 *   reorderIntent: "yes" | "no" | "undecided" (オプション),
 *   pricePerception: "cheap" | "fair" | "expensive" (オプション),
 *   barrierReason: "price" | "wrong_use" | "unclear" | "competitor" | "not_now" | "other" (オプション),
 *   refundRequested: boolean (オプション),
 *   dissatisfactionReason: "price" | "delivery" | "quality" | "unclear" | "other" (オプション),
 *   isPublic: boolean (オプション),
 *   variant: "A" | "B" (オプション)
 * }
 */
exports.submitFeedback = onRequest({
  cors: true,
}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {
      visitorId,
      orderId,
      channel,
      rating,
      comment,
      reorderIntent,
      pricePerception,
      barrierReason,
      refundRequested,
      dissatisfactionReason,
      isPublic,
      variant,
      // 新規フィールド
      inquiryType,
      orderingExperience,
      completionTimePerception,
      recipientType,
    } = req.body;

    // 必須パラメータ検証（一般問い合わせはratingなしでもOK）
    if (!visitorId || !channel) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["visitorId", "channel"],
      });
      return;
    }

    // チャネル検証
    const validChannels = ["order_received", "order_confirm", "preview_email", "delivery_email", "followup_email", "inquiry_form"];
    if (!validChannels.includes(channel)) {
      res.status(400).json({
        error: "無効なチャネルです",
        validChannels,
      });
      return;
    }

    // rating範囲チェック（ratingがある場合のみ）
    if (rating !== null && rating !== undefined && (rating < 1 || rating > 5)) {
      res.status(400).json({
        error: "ratingは1-5の範囲で指定してください",
      });
      return;
    }

    // 一般問い合わせ以外はratingが必須
    if (channel !== "inquiry_form" && !rating) {
      res.status(400).json({
        error: "ratingは必須です",
      });
      return;
    }

    // 重複チェック（同一visitorId + channel + 日付）
    const today = new Date().toISOString().split("T")[0];
    const existingFeedback = await admin.firestore()
        .collection("feedback")
        .where("visitorId", "==", visitorId)
        .where("channel", "==", channel)
        .where("submissionDate", "==", today)
        .limit(1)
        .get();

    if (!existingFeedback.empty) {
      res.status(409).json({
        error: "本日は既にこのチャネルでフィードバックを送信済みです",
        feedbackId: existingFeedback.docs[0].id,
      });
      return;
    }

    // フィードバック保存
    const feedbackData = {
      visitorId,
      orderId: orderId || null,
      channel,
      rating: rating || null,
      comment: comment || null,
      reorderIntent: reorderIntent || null,
      pricePerception: pricePerception || null,
      barrierReason: barrierReason || null,
      refundRequested: refundRequested || false,
      dissatisfactionReason: dissatisfactionReason || null,
      isPublic: isPublic || false,
      variant: variant || null,
      // 新規フィールド
      inquiryType: inquiryType || null,
      orderingExperience: orderingExperience || null,
      completionTimePerception: completionTimePerception || null,
      recipientType: recipientType || null,
      submissionDate: today,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const feedbackRef = await admin.firestore().collection("feedback").add(feedbackData);
    const feedbackId = feedbackRef.id;

    console.log(`[submitFeedback] Feedback created: ${feedbackId}, channel: ${channel}, rating: ${rating}`);

    // visitors コレクション更新
    const visitorRef = admin.firestore().collection("visitors").doc(visitorId);
    const visitorDoc = await visitorRef.get();

    const historyKey = `${channel}_${today}`;
    const historyEntry = {
      feedbackId,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (visitorDoc.exists) {
      await visitorRef.update({
        [`feedbackHistory.${historyKey}`]: historyEntry,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await visitorRef.set({
        feedbackHistory: {
          [historyKey]: historyEntry,
        },
        optedOutFollowup: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // orderId がある場合は orders コレクションも更新
    if (orderId) {
      const orderRef = admin.firestore().collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();

      if (orderDoc.exists) {
        await orderRef.update({
          hasFeedback: true,
          feedbackIds: admin.firestore.FieldValue.arrayUnion(feedbackId),
        });
      }
    }

    res.status(200).json({
      success: true,
      feedbackId,
      message: "フィードバックを送信しました",
    });
  } catch (error) {
    console.error("[submitFeedback] Error:", error);
    res.status(500).json({
      error: "フィードバックの送信に失敗しました",
      message: error.message,
    });
  }
});

/**
 * フィードバック送信済み状態をチェック
 *
 * リクエストボディ:
 * {
 *   visitorId: "UUID",
 *   channel: "order_confirm" | "preview_email" | ...,
 *   orderId: "注文ID" (オプション)
 * }
 */
exports.checkFeedbackStatus = onRequest({
  cors: true,
}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {visitorId, channel, orderId} = req.body;

    if (!visitorId || !channel) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["visitorId", "channel"],
      });
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    // 今日の同一チャネルでのフィードバックをチェック
    let query = admin.firestore()
        .collection("feedback")
        .where("visitorId", "==", visitorId)
        .where("channel", "==", channel)
        .where("submissionDate", "==", today);

    // orderIdが指定されている場合は追加条件
    if (orderId) {
      query = query.where("orderId", "==", orderId);
    }

    const feedbackSnapshot = await query.limit(1).get();

    if (!feedbackSnapshot.empty) {
      const feedback = feedbackSnapshot.docs[0];
      const data = feedback.data();

      res.status(200).json({
        hasSubmitted: true,
        feedbackId: feedback.id,
        submittedAt: data.createdAt?.toDate?.()?.toISOString() || null,
        rating: data.rating,
      });
    } else {
      res.status(200).json({
        hasSubmitted: false,
      });
    }
  } catch (error) {
    console.error("[checkFeedbackStatus] Error:", error);
    res.status(500).json({
      error: "ステータス確認に失敗しました",
      message: error.message,
    });
  }
});

/**
 * フォローアップメールオプトアウト処理
 *
 * リクエストボディ:
 * {
 *   visitorId: "UUID"
 * }
 */
exports.processFollowupOptOut = onRequest({
  cors: true,
}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {visitorId} = req.body;

    if (!visitorId) {
      res.status(400).json({
        error: "visitorIdが必要です",
      });
      return;
    }

    // visitors コレクション更新
    const visitorRef = admin.firestore().collection("visitors").doc(visitorId);
    const visitorDoc = await visitorRef.get();

    if (visitorDoc.exists) {
      await visitorRef.update({
        optedOutFollowup: true,
        optedOutAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await visitorRef.set({
        feedbackHistory: {},
        optedOutFollowup: true,
        optedOutAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // followup_queue のpending状態をキャンセル
    const queueSnapshot = await admin.firestore()
        .collection("followup_queue")
        .where("visitorId", "==", visitorId)
        .where("status", "==", "pending")
        .get();

    const batch = admin.firestore().batch();
    queueSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "opted_out",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (!queueSnapshot.empty) {
      await batch.commit();
      console.log(`[processFollowupOptOut] Cancelled ${queueSnapshot.size} pending followups for visitor ${visitorId}`);
    }

    console.log(`[processFollowupOptOut] Visitor ${visitorId} opted out of followup emails`);

    res.status(200).json({
      success: true,
      message: "フォローアップメールの配信を停止しました",
    });
  } catch (error) {
    console.error("[processFollowupOptOut] Error:", error);
    res.status(500).json({
      error: "オプトアウト処理に失敗しました",
      message: error.message,
    });
  }
});

// ============================================
// Follow-up Email System Functions
// ============================================

/**
 * フォローアップキューに追加
 * プレビュー視聴完了時に呼び出し
 *
 * リクエストボディ:
 * {
 *   orderId: "注文ID",
 *   visitorId: "訪問者ID" (オプション)
 * }
 */
exports.scheduleFollowup = onRequest({
  cors: true,
}, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  try {
    const {orderId, visitorId} = req.body;

    if (!orderId) {
      res.status(400).json({error: "orderIdが必要です"});
      return;
    }

    // 注文情報取得
    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({error: "注文が見つかりません"});
      return;
    }

    const order = orderDoc.data();

    // 既に支払い済みの場合はスキップ
    if (order.isPaid) {
      res.status(200).json({success: true, message: "既に支払い済みのためスキップしました"});
      return;
    }

    // 既存のキューをチェック
    const existingQueue = await admin.firestore()
        .collection("followup_queue")
        .where("orderId", "==", orderId)
        .limit(1)
        .get();

    if (!existingQueue.empty) {
      res.status(200).json({success: true, message: "既にキューに登録済みです"});
      return;
    }

    // 12-24時間後のランダムな時刻を計算
    const minHours = 12;
    const maxHours = 24;
    const randomHours = minHours + Math.random() * (maxHours - minHours);
    const nextFollowupAt = new Date(Date.now() + randomHours * 60 * 60 * 1000);

    // キューに追加
    await admin.firestore().collection("followup_queue").add({
      orderId,
      userEmail: order.userEmail,
      visitorId: visitorId || null,
      targetName: order.targetName,
      previewCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      followupCount: 0,
      nextFollowupAt: nextFollowupAt,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[scheduleFollowup] Added to queue: ${orderId}, next at: ${nextFollowupAt.toISOString()}`);

    res.status(200).json({
      success: true,
      message: "フォローアップキューに追加しました",
      nextFollowupAt: nextFollowupAt.toISOString(),
    });
  } catch (error) {
    console.error("[scheduleFollowup] Error:", error);
    res.status(500).json({
      error: "キュー追加に失敗しました",
      message: error.message,
    });
  }
});

/**
 * フォローアップメール送信（定期実行）
 * 1時間ごとに実行
 */
exports.sendFollowupEmails = onSchedule({
  schedule: "every 1 hours",
  timeZone: "Asia/Tokyo",
  secrets: ["SENDGRID_API_KEY", "APP_ENV", "STG_EMAIL_OVERRIDE_TO"],
}, async (event) => {
  console.log("[sendFollowupEmails] Starting scheduled job");

  try {
    const now = new Date();

    // 送信対象のキューを取得
    const pendingQueue = await admin.firestore()
        .collection("followup_queue")
        .where("status", "==", "pending")
        .where("nextFollowupAt", "<=", now)
        .get();

    console.log(`[sendFollowupEmails] Found ${pendingQueue.size} pending items`);

    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      console.error("[sendFollowupEmails] SENDGRID_API_KEY not configured");
      return;
    }
    sgMail.setApiKey(sendgridApiKey.trim());

    const appEnv = process.env.APP_ENV || "prod";
    const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";
    const frontendBaseUrl = resolveFrontendBaseUrl(appEnv);

    for (const doc of pendingQueue.docs) {
      const queueItem = doc.data();
      const {orderId, userEmail, targetName, followupCount, visitorId} = queueItem;

      try {
        // 最新の注文状態を確認
        const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();
        if (!orderDoc.exists) {
          await doc.ref.update({status: "cancelled", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
          continue;
        }

        const order = orderDoc.data();

        // 購入済みなら停止
        if (order.isPaid) {
          await doc.ref.update({status: "purchased", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
          console.log(`[sendFollowupEmails] Order ${orderId} already purchased, skipping`);
          continue;
        }

        // オプトアウト確認
        if (visitorId) {
          const visitorDoc = await admin.firestore().collection("visitors").doc(visitorId).get();
          if (visitorDoc.exists && visitorDoc.data().optedOutFollowup) {
            await doc.ref.update({status: "opted_out", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
            console.log(`[sendFollowupEmails] Visitor ${visitorId} opted out, skipping`);
            continue;
          }
        }

        // メール本文生成
        const previewUrl = `${frontendBaseUrl}/o/${orderId}?t=${order.accessToken}`;
        const feedbackUrl = `${frontendBaseUrl}/feedback?ch=followup_email&oid=${orderId}&type=barrier`;
        const optoutUrl = `${frontendBaseUrl}/feedback?optout=1&vid=${visitorId || ""}`;

        let emailBody;
        let subject;

        if (followupCount === 0) {
          // 1回目のフォローアップ
          subject = `【Songift】${targetName}様へのバースデーソング、いかがでしたか？`;
          emailBody = `${userEmail} 様

先日は${targetName}様へのバースデーソングのプレビューをご視聴いただき、ありがとうございました。

まだご購入手続きがお済みでない場合は、ぜひこの機会にご検討ください。

▼ プレビューを再確認
${previewUrl}

世界に一つだけのバースデーソングで、大切な方に特別なサプライズをお届けしませんか？

---

ご購入をお見送りになった場合、差し支えなければ理由をお聞かせください：
${feedbackUrl}

---

今後のメール配信を停止する場合：
${optoutUrl}

---
Songift運営チーム`;
        } else {
          // 2回目のフォローアップ（最終案内）
          subject = `【最終ご案内】${targetName}様へのバースデーソング`;
          emailBody = `${userEmail} 様

${targetName}様への世界に一つだけのバースデーソング、準備ができています。

特別な日に、特別な歌を。ぜひこの機会にご検討ください。

▼ プレビューを確認して購入
${previewUrl}

---

ご意見・ご要望があればお聞かせください：
${feedbackUrl}

---

今後のメール配信を停止する場合：
${optoutUrl}

---
Songift運営チーム`;
        }

        // メール送信
        const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, userEmail, subject);

        if (!emailDestination.shouldSkip) {
          const msg = {
            to: emailDestination.to,
            from: {email: "fukui@gadandan.co.jp", name: "Songift"},
            subject: emailDestination.subject,
            text: emailBody,
            html: emailBody.replace(/\n/g, "<br>"),
          };
          await sgMail.send(msg);
          console.log(`[sendFollowupEmails] Email sent to ${emailDestination.to} (followupCount: ${followupCount})`);
        }

        // キュー更新
        const newFollowupCount = followupCount + 1;

        if (newFollowupCount >= 2) {
          // 2回送信済みで終了
          await doc.ref.update({
            followupCount: newFollowupCount,
            status: "sent",
            lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          // 次回送信を48-72時間後に設定
          const minHours = 48;
          const maxHours = 72;
          const randomHours = minHours + Math.random() * (maxHours - minHours);
          const nextFollowupAt = new Date(Date.now() + randomHours * 60 * 60 * 1000);

          await doc.ref.update({
            followupCount: newFollowupCount,
            nextFollowupAt: nextFollowupAt,
            lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (itemError) {
        console.error(`[sendFollowupEmails] Error processing queue item ${doc.id}:`, itemError);
        // 個別エラーは記録して続行
        await doc.ref.update({
          lastError: itemError.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    console.log("[sendFollowupEmails] Completed scheduled job");
  } catch (error) {
    console.error("[sendFollowupEmails] Error:", error);
  }
});

// =====================================================
// 自動化システム - プロンプト生成ロジック
// =====================================================

/**
 * 色 → 音楽要素の変換（簡単モード用）
 */
const COLOR_TO_MUSIC = {
  "情熱の赤": {genre: "Rock", bpm: 140, instruments: "electric guitar, drums", key: "G"},
  "元気な黄色": {genre: "J-pop", bpm: 100, instruments: "piano, acoustic guitar", key: "G"},
  "優しい青": {genre: "R&B", bpm: 75, instruments: "piano, saxophone", key: "F"},
  "癒しの緑": {genre: "Jazz", bpm: 90, instruments: "piano, saxophone", key: "F"},
  "個性的な紫": {genre: "J-pop", bpm: 100, instruments: "synthesizer, electric guitar", key: "C"},
  "純粋な白": {genre: "J-pop", bpm: 100, instruments: "piano, strings", key: "C"},
};

/**
 * 気持ち → ボーカル性別の変換
 */
const FEELING_TO_VOCAL = {
  male: ["元気が出る", "笑える", "刺激的"],
  female: ["安心する", "幸せ"],
  default: "female",
};

/**
 * 魔法 → タグの変換
 */
const SPELL_TO_TAGS = {
  "キラキラ輝く魔法": "#bright #dreamy",
  "勇気が湧く魔法": "#powerful #uplifting",
  "愛に包まれる魔法": "#warm #emotional",
  "笑顔が溢れる魔法": "#cheerful #fun",
  "希望の魔法": "#hopeful #inspiring",
};

/**
 * ジャンル → BPMの変換（プロモード用）
 */
const GENRE_TO_BPM = {
  "J-pop（明るいポップス）": {genre: "J-pop", bpm: 100},
  "R&B（おしゃれでスムーズ）": {genre: "R&B", bpm: 75},
  "Rock（パワフルで熱い）": {genre: "Rock", bpm: 140},
  "Jazz（大人っぽく洗練）": {genre: "Jazz", bpm: 90},
  "Acoustic（温かみのある生音）": {genre: "Acoustic", bpm: 90},
  "EDM（ノリノリでダンサブル）": {genre: "EDM", bpm: 128},
  "Bossa Nova（リラックスした雰囲気）": {genre: "Bossa Nova", bpm: 80},
};

/**
 * 簡単モード用のGeminiプロンプトを生成
 */
function buildSimpleModePrompt(order) {
  const targetFeeling = Array.isArray(order.targetFeeling)
    ? order.targetFeeling.join(", ")
    : order.targetFeeling;

  const colorMappingText = Object.entries(COLOR_TO_MUSIC)
    .map(([color, music]) => `- ${color} → ${music.genre}, ${music.bpm} bpm, ${music.instruments} / Key: ${music.key}`)
    .join("\n        ");

  const feelingMappingText = `
        - 「${FEELING_TO_VOCAL.male.join("」「")}」が含まれる → male
        - 「${FEELING_TO_VOCAL.female.join("」「")}」が含まれる → female
        - その他・複数選択 → ${FEELING_TO_VOCAL.default}`;

  const spellMappingText = Object.entries(SPELL_TO_TAGS)
    .map(([spell, tags]) => `- ${spell} → ${tags}`)
    .join("\n        ");

  return `
あなたはプロの作詞作曲家兼Suno AIプロンプトエンジニアです。
以下のフォーム回答を元に、定義されたルールに従って「歌詞」と「Suno AI用プロンプト」を作成してください。

【フォーム回答】
Q1. お誕生日の主役のお名前：${order.targetName}
Q2. その人を色で表すと：${order.targetColor}
Q3. その人といると、どんな気持ち：${targetFeeling}
Q4. 魔法の言葉を一つ贈るなら：${order.magicWord}
Q5. その人の新しい一年に、どんな魔法をかけたい：${order.magicSpell}

【歌詞創作ルール（重要）】
Q4とQ5の選択肢をそのまま使わず、その「意味・感情・メッセージ」を理解して、自然で詩的な日本語の歌詞に創作してください。毎回異なる表現にしてください。

■ Verse（25〜30文字程度）
Q4のメッセージの本質的な意味を、歌いやすく自然な日本語で表現してください。

■ Pre-Chorus（25〜30文字程度）
Q5の魔法に対応する、前向きで温かいオリジナルフレーズにしてください。

【変換ルール】
■ Q2（色）→ ジャンル・BPM・楽器・キーの変換
        ${colorMappingText}

■ Q3（気持ち）→ ボーカル性別の決定${feelingMappingText}

■ Q5（魔法）→ 追加タグ
        ${spellMappingText}

【出力フォーマット (JSON)】
必ず以下のJSON形式のみを出力してください。Markdown記法は不要です。
{
  "lyrics": "[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\n[Verse]\\n(Q4から創作した自然な歌詞)\\n[Pre-Chorus]\\n(Q5から創作した自然な歌詞)\\n[Final Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}",
  "sunoPrompt": "happy birthday | (Q2から変換したジャンル) | (Q2から変換したBPM) | key: (Q2から変換したKey) | (Q2から変換した楽器), clap | Japanese (Q3から決定したvocal) vocal | #birthday #upbeat #groovy (Q5から変換した追加タグ)"
}
  `.trim();
}

/**
 * プロモード用のGeminiプロンプトを生成
 */
function buildProModePrompt(order) {
  const instruments = Array.isArray(order.proInstruments)
    ? order.proInstruments.join(", ")
    : order.proInstruments;

  const genreMappingText = Object.entries(GENRE_TO_BPM)
    .map(([label, data]) => `- ${label} → ジャンル：${data.genre} / BPM：${data.bpm} bpm`)
    .join("\n        ");

  return `
あなたはプロの作詞作曲家兼Suno AIプロンプトエンジニアです。
以下のフォーム回答を元に、定義されたルールに従って「歌詞」と「Suno AI用プロンプト」を作成してください。

【フォーム回答】
質問1（ジャンル）：${order.proGenre}
質問2（楽器）：${instruments}
質問3（性別）：${order.proGender}
質問4（名前）：${order.targetName}
質問5-1（メッセージ1）：${order.proMessage1}
質問5-2（メッセージ2）：${order.proMessage2}

【抽出・変換ルール】
■ 質問1（ジャンル）→ ジャンル名とBPMを抽出
        ${genreMappingText}

■ 質問2（楽器）→ 楽器名とキーを抽出

【キー決定ルール（優先順位）】
1. 「その他」が選択されている → Key: C（統一）
2. Guitar, Ukulele, Keyboard が含まれる → Key: G
3. Saxophone, Piano が含まれる → Key: F
4. Synthesizer のみ → Key: C
5. 上記該当なし → Key: C（デフォルト）

■ 質問3（性別）→ 英語部分を小文字で抽出
- 男性（Male）→ male
- 女性（Female）→ female

■ 質問4（名前）→ そのまま使用

■ 質問5-1、5-2（メッセージ）の変換ルール
- 歌詞部分：漢字をひらがなに変換

【出力フォーマット (JSON)】
必ず以下のJSON形式のみを出力してください。Markdown記法は不要です。
{
  "lyrics": "[Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\n[Verse]\\n(質問5-1の回答をひらがな変換したもの)\\n[Pre-Chorus]\\n(質問5-2の回答をひらがな変換したもの)\\n[Final Chorus]\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}\\nhappy birthday ${order.targetName}",
  "sunoPrompt": "happy birthday | (質問1から抽出したジャンル名) | (質問1から抽出したBPM) | key: (質問2から決定したKey) | (質問2から抽出した楽器名小文字), clap | Japanese (質問3から抽出したvocal小文字) vocal | #birthday #upbeat #groovy"
}
  `.trim();
}

// =====================================================
// 自動化システム - ヘルパー関数
// =====================================================

/**
 * 次のステップをキューに追加
 */
async function scheduleNextStep(orderId, step, delayMinutes = 0) {
  const scheduledAt = delayMinutes > 0
    ? new Date(Date.now() + delayMinutes * 60 * 1000)
    : new Date();

  await admin.firestore().collection("automation_queue").add({
    orderId,
    step,
    status: "pending",
    retryCount: 0,
    maxRetries: 3,
    scheduledAt: admin.firestore.Timestamp.fromDate(scheduledAt),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[scheduleNextStep] Scheduled ${step} for order ${orderId} at ${scheduledAt.toISOString()}`);
}

/**
 * 自動化エラー時のSlack通知
 */
async function notifyAutomationError(orderId, step, error, slackWebhookUrl) {
  if (!slackWebhookUrl) return;

  try {
    const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();
    const order = orderDoc.data();

    const message = {
      text: `🚨 *自動処理エラー*\n\n` +
            `*注文ID:* ${orderId}\n` +
            `*お名前:* ${order?.targetName || "不明"}\n` +
            `*ステップ:* ${step}\n` +
            `*エラー:* ${error.message}\n` +
            `*リトライ回数:* 3/3（上限到達）\n\n` +
            `管理画面で確認してください。`,
    };

    await axios.post(slackWebhookUrl, message);
    console.log(`[notifyAutomationError] Slack notification sent for order ${orderId}`);
  } catch (slackError) {
    console.error("[notifyAutomationError] Slack notification failed:", slackError);
  }
}

/**
 * リトライ処理（指数バックオフ）
 */
async function handleJobError(jobRef, jobData, error, slackWebhookUrl) {
  const newRetryCount = jobData.retryCount + 1;

  if (newRetryCount >= jobData.maxRetries) {
    // 上限到達
    await jobRef.update({
      status: "failed",
      errorMessage: error.message,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.firestore().collection("orders").doc(jobData.orderId).update({
      automationStatus: "failed",
      lastError: error.message,
      failedStep: jobData.step,
      retryCount: newRetryCount,
    });

    await notifyAutomationError(jobData.orderId, jobData.step, error, slackWebhookUrl);
  } else {
    // リトライ（指数バックオフ: 2, 4, 8分）
    const delayMinutes = Math.pow(2, newRetryCount);
    const nextSchedule = new Date(Date.now() + delayMinutes * 60 * 1000);

    await jobRef.update({
      status: "pending",
      retryCount: newRetryCount,
      scheduledAt: admin.firestore.Timestamp.fromDate(nextSchedule),
      lastError: error.message,
    });

    await admin.firestore().collection("orders").doc(jobData.orderId).update({
      retryCount: newRetryCount,
      lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: error.message,
    });

    console.log(`[handleJobError] Scheduled retry ${newRetryCount} for order ${jobData.orderId} at ${nextSchedule.toISOString()}`);
  }
}

// =====================================================
// 自動化システム - Firestore Trigger
// =====================================================

/**
 * 注文作成時に自動パイプラインを開始
 */
exports.onOrderCreated = onDocumentCreated({
  document: "orders/{orderId}",
  secrets: [],
}, async (event) => {
  const orderId = event.params.orderId;
  const order = event.data.data();

  console.log(`[onOrderCreated] New order created: ${orderId}`);

  // automation_queueにプロンプト生成ジョブを追加
  await scheduleNextStep(orderId, "prompt");

  // orderのステータス更新
  await event.data.ref.update({
    automationStatus: "running",
    currentStep: "prompt",
  });

  console.log(`[onOrderCreated] Automation started for order ${orderId}`);
});

// =====================================================
// 自動化システム - スケジューラー
// =====================================================

/**
 * 自動化キュー処理（1分ごと）
 */
exports.processAutomationQueue = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Asia/Tokyo",
  secrets: ["GEMINI_API_KEY", "SUNO_API_KEY", "VIDEO_GENERATOR_URL", "SENDGRID_API_KEY", "SLACK_WEBHOOK_URL", "APP_ENV", "STG_EMAIL_OVERRIDE_TO"],
}, async (event) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // pending状態でscheduledAtが現在以前のジョブを取得（最大5件）
  const jobsSnapshot = await db.collection("automation_queue")
    .where("status", "==", "pending")
    .where("scheduledAt", "<=", now)
    .orderBy("scheduledAt")
    .limit(5)
    .get();

  if (jobsSnapshot.empty) {
    return;
  }

  console.log(`[processAutomationQueue] Processing ${jobsSnapshot.size} jobs`);

  for (const jobDoc of jobsSnapshot.docs) {
    const jobData = jobDoc.data();
    const orderId = jobData.orderId;

    // 処理中にマーク
    await jobDoc.ref.update({
      status: "processing",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        throw new Error("Order not found");
      }

      const order = orderDoc.data();

      switch (jobData.step) {
        case "prompt":
          await processPromptStep(orderRef, order, orderId);
          break;
        case "song":
          await processSongStep(orderRef, order, orderId);
          break;
        case "preview":
          await processPreviewStep(orderRef, order, orderId);
          break;
        case "email":
          await processEmailStep(orderRef, order, orderId);
          break;
        case "video":
          await processVideoStep(orderRef, order, orderId);
          break;
        default:
          throw new Error(`Unknown step: ${jobData.step}`);
      }

      await jobDoc.ref.update({
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error(`[processAutomationQueue] Error processing job ${jobDoc.id}:`, error);
      await handleJobError(jobDoc.ref, jobData, error, process.env.SLACK_WEBHOOK_URL);
    }
  }
});

/**
 * プロンプト生成ステップ
 */
async function processPromptStep(orderRef, order, orderId) {
  console.log(`[processPromptStep] Processing order ${orderId}`);

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // プロンプト生成
  const systemPrompt = order.plan === "pro"
    ? buildProModePrompt(order)
    : buildSimpleModePrompt(order);

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    {contents: [{parts: [{text: systemPrompt}]}]},
    {headers: {"Content-Type": "application/json"}, timeout: 60000}
  );

  const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error("Gemini returned empty response");
  }

  // JSONパース
  const cleanJsonText = generatedText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsedResult = JSON.parse(cleanJsonText);

  // Firestore更新
  await orderRef.update({
    generatedLyrics: parsedResult.lyrics,
    generatedPrompt: parsedResult.sunoPrompt,
    promptGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "processing",
    currentStep: "song",
  });

  // 次のステップをキューに追加
  await scheduleNextStep(orderId, "song");

  console.log(`[processPromptStep] Completed for order ${orderId}`);
}

/**
 * Suno楽曲生成ステップ
 */
async function processSongStep(orderRef, order, orderId) {
  console.log(`[processSongStep] Processing order ${orderId}`);

  const sunoApiKey = process.env.SUNO_API_KEY;
  if (!sunoApiKey) {
    throw new Error("SUNO_API_KEY is not configured");
  }

  if (!order.generatedLyrics || !order.generatedPrompt) {
    throw new Error("Lyrics or prompt not generated yet");
  }

  // callbackUrl設定
  const appEnv = process.env.APP_ENV || "prod";
  const callbackBaseUrl = appEnv === "prod"
    ? "https://birthday-song-app.firebaseapp.com"
    : "https://birthday-song-app-stg.firebaseapp.com";

  const response = await axios.post(
    "https://api.sunoapi.org/api/v1/generate",
    {
      customMode: true,
      prompt: order.generatedLyrics,
      style: order.generatedPrompt,
      title: "Happy Birthday",
      instrumental: false,
      model: "V5",
      callBackUrl: `${callbackBaseUrl}/api/callback`,
    },
    {
      headers: {
        "Authorization": `Bearer ${sunoApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  if (response.data.code !== 200 || !response.data.data?.taskId) {
    throw new Error(`Suno API error: ${response.data.msg || "Unknown error"}`);
  }

  const taskId = response.data.data.taskId;

  await orderRef.update({
    status: "generating_song",
    sunoTaskId: taskId,
    songGenerationStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    sunoStatus: "PENDING",
    sunoErrorCode: null,
    sunoErrorMessage: null,
    currentStep: "song",
  });

  console.log(`[processSongStep] Started Suno generation for order ${orderId}, taskId: ${taskId}`);
  // Sunoの完了はcheckSunoStatusScheduledでポーリング
}

/**
 * プレビュー生成ステップ（2曲分）
 */
async function processPreviewStep(orderRef, order, orderId) {
  console.log(`[processPreviewStep] Processing order ${orderId}`);

  const videoGeneratorUrl = process.env.VIDEO_GENERATOR_URL;
  if (!videoGeneratorUrl) {
    throw new Error("VIDEO_GENERATOR_URL is not configured");
  }

  if (!order.generatedSongs || order.generatedSongs.length === 0) {
    throw new Error("No songs generated yet");
  }

  // 認証トークン取得
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(videoGeneratorUrl);

  // 2曲分のプレビュー生成
  const response = await client.request({
    url: `${videoGeneratorUrl}/generate-previews`,
    method: "POST",
    data: {
      songs: order.generatedSongs,
      orderId: orderId,
    },
    timeout: 300000,
  });

  if (!response.data.success) {
    throw new Error("Preview generation failed");
  }

  // generatedSongsを更新（previewAudioPath追加）
  const updatedSongs = response.data.results;

  await orderRef.update({
    generatedSongs: updatedSongs,
    status: "previews_ready",
    currentStep: "email",
    previewsGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 次のステップをキューに追加
  await scheduleNextStep(orderId, "email");

  console.log(`[processPreviewStep] Completed for order ${orderId}`);
}

/**
 * プレビュー完成メール送信ステップ
 */
async function processEmailStep(orderRef, order, orderId) {
  console.log(`[processEmailStep] Processing order ${orderId}`);

  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }

  sgMail.setApiKey(sendgridApiKey.trim());

  const appEnv = process.env.APP_ENV || "prod";
  const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";
  const frontendBaseUrl = resolveFrontendBaseUrl(appEnv);
  const previewUrl = `${frontendBaseUrl}/o/${orderId}?t=${order.accessToken}`;

  const planName = order.plan === "simple" ? "魔法診断（簡単モード）" : "プロモード";

  const emailBody = `${order.userEmail} 様

この度は、Songiftの「${planName}」プランをご利用いただき、誠にありがとうございます。

${order.targetName}様への世界に一つだけのバースデーソング（15秒プレビュー）が完成いたしました！

🎵 2曲のプレビューが完成しました！
以下のURLからプレビューをご確認いただき、お好みの曲をお選びください：
${previewUrl}

気に入った曲を選択後、ページ内の支払いボタンから¥500をお支払いください。
お支払い確認後、選択された曲でフル動画（MP4）を作成し、メールでお届けします。

---
Songift運営チーム`;

  const originalSubject = `【Songift】プレビュー完成！曲を選んでください - ${order.userEmail}様`;
  const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, order.userEmail, originalSubject);

  if (!emailDestination.shouldSkip) {
    const msg = {
      to: emailDestination.to,
      from: {email: "fukui@gadandan.co.jp", name: "Songift"},
      subject: emailDestination.subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, "<br>"),
    };

    await sgMail.send(msg);
    console.log(`[processEmailStep] Preview email sent to ${emailDestination.to}`);
  } else {
    console.log(`[processEmailStep] Email skipped (STG environment)`);
  }

  await orderRef.update({
    previewEmailStatus: "sent",
    previewEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    automationStatus: "completed",
    currentStep: null,
  });

  console.log(`[processEmailStep] Completed for order ${orderId}`);
}

/**
 * 動画生成ステップ（支払い後）
 */
async function processVideoStep(orderRef, order, orderId) {
  console.log(`[processVideoStep] Processing order ${orderId}`);

  const videoGeneratorUrl = process.env.VIDEO_GENERATOR_URL;
  if (!videoGeneratorUrl) {
    throw new Error("VIDEO_GENERATOR_URL is not configured");
  }

  if (!order.selectedSongUrl) {
    throw new Error("No song selected yet");
  }

  // 認証トークン取得
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(videoGeneratorUrl);

  const bucket = admin.storage().bucket();
  const sourceAudioPath = `audios/${orderId}/source.mp3`;
  const fullVideoPath = `videos/${orderId}/full.mp4`;

  // 1. 選択された曲をStorageに保存
  const audioResponse = await axios.get(order.selectedSongUrl, {
    responseType: "arraybuffer",
    timeout: 120000,
  });

  await bucket.file(sourceAudioPath).save(Buffer.from(audioResponse.data), {
    metadata: {contentType: "audio/mpeg"},
  });

  // 2. フル動画生成
  const videoResponse = await client.request({
    url: `${videoGeneratorUrl}/generate-full-video`,
    method: "POST",
    data: {
      sourceAudioPath: sourceAudioPath,
      outputPath: fullVideoPath,
      backgroundTemplateId: order.backgroundTemplateId || "t1",
      lyricsText: order.generatedLyrics || "",
      sunoTaskId: order.sunoTaskId || null,
      selectedSongUrl: order.selectedSongUrl || null,
    },
    timeout: 480000,
  });

  if (!videoResponse.data.success) {
    throw new Error("Video generation failed");
  }

  await orderRef.update({
    sourceAudioPath: sourceAudioPath,
    fullVideoPath: fullVideoPath,
    fullVideoAudioDurationSec: videoResponse.data.audioDurationSeconds,
    fullVideoDurationSec: videoResponse.data.videoDurationSeconds,
    subtitleMode: videoResponse.data.subtitleMode,
    videoGenerationStatus: "completed",
    status: "completed",
    currentStep: null,
  });

  // 3. MP4納品メール送信
  await sendDeliveryEmail(orderRef, order, orderId, fullVideoPath);

  console.log(`[processVideoStep] Completed for order ${orderId}`);
}

/**
 * MP4納品メール送信
 */
async function sendDeliveryEmail(orderRef, order, orderId, fullVideoPath) {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }

  sgMail.setApiKey(sendgridApiKey.trim());

  const appEnv = process.env.APP_ENV || "prod";
  const stgOverrideTo = process.env.STG_EMAIL_OVERRIDE_TO || "";
  const frontendBaseUrl = resolveFrontendBaseUrl(appEnv);
  const feedbackUrl = `${frontendBaseUrl}/feedback?ch=delivery_email&oid=${orderId}`;

  // フル動画の署名URL取得
  const bucket = admin.storage().bucket();
  const [fullVideoUrl] = await bucket.file(fullVideoPath).getSignedUrl({
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });

  // MP4ダウンロード
  const mp4Response = await axios.get(fullVideoUrl, {
    responseType: "arraybuffer",
    timeout: 120000,
  });

  const mp4Buffer = Buffer.from(mp4Response.data);
  const mp4Base64 = mp4Buffer.toString("base64");

  const emailBody = `${order.userEmail} 様

お支払いいただきありがとうございます。
世界に一つのバースデーソングをお届けします。

添付のMP4ファイルをダウンロードしてご覧ください。
縦型動画（1080x1920）なのでスマホでの再生に最適です。

---

ご感想をお聞かせください（1分で完了します）：
${feedbackUrl}

---
Songift運営チーム`;

  const originalSubject = `【Songift】世界に一つのバースデーソングをお届けします - ${order.userEmail}様`;
  const emailDestination = resolveEmailDestination(appEnv, stgOverrideTo, order.userEmail, originalSubject);

  if (!emailDestination.shouldSkip) {
    const msg = {
      to: emailDestination.to,
      from: {email: "fukui@gadandan.co.jp", name: "Songift"},
      subject: emailDestination.subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, "<br>"),
      attachments: [{
        content: mp4Base64,
        filename: `birthday_song_${order.targetName}.mp4`,
        type: "video/mp4",
        disposition: "attachment",
      }],
    };

    await sgMail.send(msg);
    console.log(`[sendDeliveryEmail] MP4 delivery email sent to ${emailDestination.to}`);
  }

  await orderRef.update({
    deliveryStatus: "sent",
    deliverySentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Sunoステータス確認（1分ごと）
 */
exports.checkSunoStatusScheduled = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Asia/Tokyo",
  secrets: ["SUNO_API_KEY"],
}, async (event) => {
  const db = admin.firestore();
  const sunoApiKey = process.env.SUNO_API_KEY;

  if (!sunoApiKey) {
    console.error("[checkSunoStatusScheduled] SUNO_API_KEY not configured");
    return;
  }

  // generating_song状態のオーダーを取得
  const ordersSnapshot = await db.collection("orders")
    .where("status", "==", "generating_song")
    .get();

  if (ordersSnapshot.empty) {
    return;
  }

  console.log(`[checkSunoStatusScheduled] Checking ${ordersSnapshot.size} orders`);

  for (const orderDoc of ordersSnapshot.docs) {
    const order = orderDoc.data();
    const orderId = orderDoc.id;

    try {
      // タイムアウトチェック（4分）
      if (order.songGenerationStartedAt) {
        const startedAt = order.songGenerationStartedAt.toDate();
        const elapsedSeconds = (Date.now() - startedAt.getTime()) / 1000;

        if (elapsedSeconds > 240) {
          await orderDoc.ref.update({
            status: "song_timeout",
            sunoStatus: "TIMEOUT",
            sunoErrorMessage: "Timed out waiting for Suno (4 minutes)",
            automationStatus: "failed",
            lastError: "Song generation timeout",
          });

          // Slack通知
          const slackUrl = process.env.SLACK_WEBHOOK_URL;
          if (slackUrl) {
            await notifyAutomationError(orderId, "song", new Error("Song generation timeout"), slackUrl);
          }
          continue;
        }
      }

      // Sunoステータス確認
      const response = await axios.get(
        `https://api.sunoapi.org/api/v1/generate/record-info?taskId=${order.sunoTaskId}`,
        {
          headers: {
            "Authorization": `Bearer ${sunoApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const dataStatus = response.data?.data?.status;
      const errorCode = response.data?.data?.errorCode;
      const errorMessage = response.data?.data?.errorMessage;

      // 失敗判定
      if (
        dataStatus === "GENERATE_AUDIO_FAILED" ||
        dataStatus?.includes("FAILED") ||
        dataStatus?.includes("ERROR") ||
        errorCode != null ||
        errorMessage != null
      ) {
        await orderDoc.ref.update({
          status: "song_failed",
          sunoStatus: dataStatus || "FAILED",
          sunoErrorCode: errorCode,
          sunoErrorMessage: errorMessage || "Generation failed",
          automationStatus: "failed",
          lastError: errorMessage || "Song generation failed",
        });

        const slackUrl = process.env.SLACK_WEBHOOK_URL;
        if (slackUrl) {
          await notifyAutomationError(orderId, "song", new Error(errorMessage || "Song generation failed"), slackUrl);
        }
        continue;
      }

      // 成功判定
      if (response.data.code === 200 && dataStatus === "SUCCESS") {
        const sunoData = response.data.data.response?.sunoData || [];

        if (sunoData.length > 0) {
          const songs = sunoData.map((song) => ({
            id: song.id,
            audio_url: song.audioUrl || song.audio_url,
            stream_audio_url: song.streamAudioUrl,
            title: song.title,
            duration: song.duration,
          }));

          await orderDoc.ref.update({
            status: "song_generated",
            sunoStatus: "SUCCESS",
            generatedSongs: songs,
          });

          // プレビュー生成ステップをキューに追加
          await scheduleNextStep(orderId, "preview");

          console.log(`[checkSunoStatusScheduled] Song generated for order ${orderId}`);
        }
      }
    } catch (error) {
      console.error(`[checkSunoStatusScheduled] Error checking order ${orderId}:`, error);
    }
  }
});

// =====================================================
// 自動化システム - 顧客向けAPI
// =====================================================

/**
 * 顧客が2曲から1曲を選択
 */
exports.selectSong = onCall({
  cors: true,
}, async (request) => {
  const {orderId, token, selectedSongIndex} = request.data;

  if (!orderId || !token || selectedSongIndex === undefined) {
    throw new Error("必須パラメータが不足しています");
  }

  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    throw new Error("注文が見つかりません");
  }

  const order = orderDoc.data();

  // トークン検証
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (tokenHash !== order.tokenHash) {
    throw new Error("無効なトークンです");
  }

  // 有効期限チェック
  if (order.tokenExpiresAt && order.tokenExpiresAt.toDate() < new Date()) {
    throw new Error("トークンの有効期限が切れています");
  }

  // 選択可能な状態か確認
  if (order.status !== "previews_ready") {
    throw new Error("選択できる状態ではありません");
  }

  if (!order.generatedSongs || selectedSongIndex < 0 || selectedSongIndex >= order.generatedSongs.length) {
    throw new Error("無効な選択です");
  }

  const selectedSong = order.generatedSongs[selectedSongIndex];

  await orderRef.update({
    selectedSongIndex: selectedSongIndex,
    selectedSongUrl: selectedSong.audio_url,
    selectedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "song_selected",
    previewAudioPath: selectedSong.previewAudioPath,
  });

  console.log(`[selectSong] Song ${selectedSongIndex} selected for order ${orderId}`);

  return {success: true, message: "曲を選択しました"};
});

/**
 * 曲インデックス指定でプレビュー署名URL取得
 */
exports.getPreviewSignedUrlBySongIndex = onCall({
  cors: true,
}, async (request) => {
  const {orderId, token, songIndex} = request.data;

  if (!orderId || !token || songIndex === undefined) {
    throw new Error("必須パラメータが不足しています");
  }

  const db = admin.firestore();
  const orderDoc = await db.collection("orders").doc(orderId).get();

  if (!orderDoc.exists) {
    throw new Error("注文が見つかりません");
  }

  const order = orderDoc.data();

  // トークン検証
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (tokenHash !== order.tokenHash) {
    throw new Error("無効なトークンです");
  }

  if (!order.generatedSongs || songIndex < 0 || songIndex >= order.generatedSongs.length) {
    throw new Error("無効なインデックスです");
  }

  const song = order.generatedSongs[songIndex];

  if (!song.previewAudioPath) {
    throw new Error("プレビューがまだ生成されていません");
  }

  const bucket = admin.storage().bucket();
  const [signedUrl] = await bucket.file(song.previewAudioPath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 20 * 60 * 1000, // 20分
  });

  return {signedUrl};
});

