const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const axios = require("axios");

admin.initializeApp();

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
  secrets: ["SLACK_WEBHOOK_URL"],
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
  secrets: ["SENDGRID_API_KEY"],
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

    // メール送信
    const msg = {
      to: recipientEmail,
      from: {
        email: "fukui@gadandan.co.jp",
        name: "Songift",
      },
      subject: `【Songift】世界に一つのバースデーソングをお届けします - ${recipientName}様`,
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

    console.log(`Email sent successfully to ${recipientEmail}`);

    // Firestoreのステータス更新
    await admin.firestore().collection("orders").doc(orderId).update({
      deliveryStatus: "sent",
      deliverySentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: "メール送信完了",
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
