const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const axios = require("axios");
const crypto = require("crypto");

admin.initializeApp();

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
    const emailBody = `${formData.targetName}様のバースデーソング作成を承りました。

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
    const originalSubject = `【Songift】ご注文を受け付けました - ${formData.targetName}様`;
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
    const {orderId, recipientEmail, recipientName, mp3Url, emailBody} = req.body;

    // パラメータ検証
    if (!orderId || !recipientEmail || !recipientName || !mp3Url || !emailBody) {
      res.status(400).json({
        error: "必須パラメータが不足しています",
        required: ["orderId", "recipientEmail", "recipientName", "mp3Url", "emailBody"],
      });
      return;
    }

    console.log(`Processing email for order ${orderId}`);

    // MP3ファイルをダウンロード
    console.log(`Downloading MP3 from: ${mp3Url}`);
    const mp3Response = await axios.get(mp3Url, {
      responseType: "arraybuffer",
    });

    const mp3Buffer = Buffer.from(mp3Response.data);
    const mp3Base64 = mp3Buffer.toString("base64");

    console.log(`MP3 downloaded, size: ${mp3Buffer.length} bytes`);

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
            content: mp3Base64,
            filename: `birthday_song_${recipientName}.mp3`,
            type: "audio/mpeg",
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
