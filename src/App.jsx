import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
// Firebase関連
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, doc, updateDoc, onSnapshot
} from "firebase/firestore";

// ---------------------------
// Firebase設定
// ---------------------------
const firebaseConfig = {
  // 環境変数から読み込み（Vite標準の書き方）
  // STG環境では .env.stg が、PROD環境では .env が読み込まれる
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 初期化（環境確認ログ追加）
console.log(`[Firebase] Initializing with projectId: ${firebaseConfig.projectId}, authDomain: ${firebaseConfig.authDomain}`);

// ---------------------------
// 🛡️ 起動時の安全チェック（STG/PROD混在防止）
// ---------------------------
(() => {
  const hostname = window.location.hostname;
  const apiKey = firebaseConfig.apiKey;

  // STGドメインのチェック
  if (hostname === 'birthday-song-app-stg.web.app' || hostname === 'birthday-song-app-stg.firebaseapp.com') {
    if (!apiKey.startsWith('AIzaSyDCg1')) {
      const errorMsg = `❌ 環境エラー: STGドメインですがPROD用のAPIキーが使われています！\n\nドメイン: ${hostname}\nAPIキー prefix: ${apiKey.substring(0, 15)}...\n期待値: AIzaSyDCg1...\n\n修正方法:\n1. .env.stg のVITE_FIREBASE_API_KEYをSTG用に変更\n2. npm run build:stg でビルド\n3. npm run deploy:stg でデプロイ`;
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error('STG/PROD環境混在エラー');
    }
    console.log('✅ 環境チェックOK: STG環境として正しく動作しています');
  }

  // PRODドメインのチェック
  if (hostname === 'birthday-song-app.web.app' || hostname === 'birthday-song-app.firebaseapp.com') {
    if (!apiKey.startsWith('AIzaSyBQ0E')) {
      const errorMsg = `❌ 環境エラー: PRODドメインですがSTG用のAPIキーが使われています！\n\nドメイン: ${hostname}\nAPIキー prefix: ${apiKey.substring(0, 15)}...\n期待値: AIzaSyBQ0E...\n\n修正方法:\n1. .env.production のVITE_FIREBASE_API_KEYをPROD用に変更\n2. npm run build:prod でビルド\n3. npm run deploy:prod でデプロイ`;
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error('STG/PROD環境混在エラー');
    }
    console.log('✅ 環境チェックOK: PROD環境として正しく動作しています');
  }
})();

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

// ---------------------------
// API Keys（未使用だが既存コードとの互換性のため残す）
// ---------------------------
// ★プレビュー環境では警告が出ますが、ローカル環境(Vite)ではこの書き方が必須です
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const SUNO_API_KEY = import.meta.env.VITE_SUNO_API_KEY;
const SLACK_WEBHOOK_URL = import.meta.env.VITE_SLACK_WEBHOOK_URL;

// ---------------------------
// 定数・データ
// ---------------------------
const COLORS = [
  { label: "🔴 情熱の赤（エネルギッシュ・明るい）", value: "Red (Energetic, Bright)" },
  { label: "🟡 元気な黄色（ポジティブ・太陽みたい）", value: "Yellow (Positive, Sunny)" },
  { label: "🔵 優しい青（穏やか・落ち着いている）", value: "Blue (Gentle, Calm)" },
  { label: "🟢 癒しの緑（安心感・自然体）", value: "Green (Healing, Natural)" },
  { label: "🟣 個性的な紫（おしゃれ・ユニーク）", value: "Purple (Unique, Stylish)" },
  { label: "⚪ 純粋な白（清楚・まじめ）", value: "White (Pure, Serious)" },
];

const FEELINGS = [
  { label: "😊 楽しい", value: "Fun" },
  { label: "😌 安心する", value: "Relaxed" },
  { label: "💪 元気が出る", value: "Energetic" },
  { label: "🥰 幸せ", value: "Happy" },
  { label: "✨ 刺激的", value: "Exciting" },
  { label: "😁 笑える", value: "Laughing" },
];

const MAGIC_WORDS = [
  "💖 いつもありがとう",
  "✨ 出会えて本当によかった",
  "🎸 夢を応援してるよ",
  "🎉 最高の一年になりますように",
  "😍 あなたは特別な存在",
  "🌈 これからもよろしくね",
  "⭐ ずっと友達でいてね",
];

const MAGIC_SPELLS = [
  "✨ キラキラ輝く魔法（夢が叶う）",
  "💪 勇気が湧く魔法（挑戦を応援）",
  "💖 愛に包まれる魔法（温かい一年に）",
  "🎉 笑顔が溢れる魔法（楽しい毎日）",
  "🌈 希望の魔法（素敵な出会いがある）",
];

const PRO_GENRES = [
  "J-pop（明るいポップス）",
  "R&B（おしゃれでスムーズ）",
  "Rock（パワフルで熱い）",
  "Jazz（大人っぽく洗練）",
  "Acoustic（温かみのある生音）",
  "EDM（ノリノリでダンサブル）",
  "Bossa Nova（リラックスした雰囲気）"
];

const PRO_INSTRUMENTS = [
  "Piano（ピアノ）",
  "Acoustic Guitar（アコースティックギター）",
  "Electric Guitar（エレキギター）",
  "Ukulele（ウクレレ）",
  "Trumpet（トランペット）",
  "Saxophone（サックス）",
  "Violin（バイオリン）",
  "Strings（ストリングス）",
  "Bells（ベル・鐘）",
  "Synthesizer（シンセサイザー）",
  "Harmonica（ハーモニカ）",
  "その他"
];

const PRO_GENDERS = [
  "男性（Male）",
  "女性（Female）"
];

// ---------------------------
// ページコンポーネント
// ---------------------------

// 1. トップページ
const TopPage = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center bg-blue-50">
    <h1 className="text-4xl font-bold text-blue-600 mb-6">Songift</h1>
    <p className="mb-8 text-lg text-gray-600">
      想いを込めた、世界に一つのバースデーソングを。<br />
      あなたの大切な人へ贈りませんか？
    </p>
    <Link to="/order" className="bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-blue-600 transition shadow-lg">
      作成を申し込む
    </Link>
  </div>
);

// 2. 注文フォームページ
const OrderPage = ({ user = null }) => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState('simple');
  const [loading, setLoading] = useState(false);
  const [otherInstrument, setOtherInstrument] = useState('');
  const [nameError, setNameError] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const [formData, setFormData] = useState({
    targetName: '',
    targetColor: '',
    targetFeeling: [],
    magicWord: '',
    magicSpell: '',
    // プロモード用
    proGenre: '',
    proInstruments: [],
    proGender: '',
    proMessage1: '',
    proMessage2: '',
    // 旧データ互換
    targetAge: '',
    relation: '',
    mood: '明るい',
    episode: '',
    genre: '',
  });

  const validateName = (name) => {
    const regex = /^[a-zA-Z0-9ぁ-んァ-ンー\s]+$/;
    return regex.test(name);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'targetName') {
      if (value !== '' && !validateName(value)) {
        setNameError('※漢字は使用できません（ひらがな、カタカナ、英語のみ）');
      } else {
        setNameError('');
      }
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleCheckboxChange = (e) => {
    const { value, checked } = e.target;
    let newFeelings = [...formData.targetFeeling];
    if (checked) {
      newFeelings.push(value);
    } else {
      newFeelings = newFeelings.filter((item) => item !== value);
    }
    setFormData({ ...formData, targetFeeling: newFeelings });
  };

  const handleProCheckboxChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      let newInstruments = [...prev.proInstruments];
      if (checked) {
        newInstruments.push(value);
      } else {
        newInstruments = newInstruments.filter(item => item !== value);
        if (value === 'その他') setOtherInstrument('');
      }
      return { ...prev, proInstruments: newInstruments };
    });
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // バリデーション
    if (!validateEmail(email)) {
      setEmailError('有効なメールアドレスを入力してください');
      return;
    }

    if (nameError || !formData.targetName) {
      alert("お名前の入力を確認してください。");
      return;
    }

    setLoading(true);

    let finalFormData = { ...formData };
    if (plan === 'pro' && formData.proInstruments.includes('その他')) {
      const instruments = formData.proInstruments.filter(i => i !== 'その他');
      if (otherInstrument.trim()) {
        instruments.push(`その他(${otherInstrument})`);
      }
      finalFormData.proInstruments = instruments;
    }

    try {
      // Cloud Functions createOrder を呼び出し
      const functionUrl = `${import.meta.env.VITE_FUNCTIONS_BASE_URL}/createOrder`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan,
          formData: finalFormData,
          email: email
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "注文に失敗しました");
      }

      // 成功メッセージ
      alert(`注文を受け付けました！\n\n${email} 宛に確認メールを送信しました。\nメールに記載されたURLから進捗を確認できます。`);
      navigate('/');
    } catch (error) {
      console.error("注文エラー:", error);
      alert(`送信に失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow">
        <h2 className="text-2xl font-bold text-center mb-6">楽曲作成オーダー</h2>
        
        <div className="flex justify-center mb-8">
          <button onClick={() => setPlan('simple')} className={`px-6 py-2 rounded-l-lg font-bold ${plan === 'simple' ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-600'}`}>簡単モード（魔法診断）</button>
          <button onClick={() => setPlan('pro')} className={`px-6 py-2 rounded-r-lg font-bold ${plan === 'pro' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'}`}>プロモード</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* メールアドレス入力（新規追加） */}
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
            <label className="block font-bold text-gray-800 mb-2">
              📧 メールアドレス <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-gray-500 mb-2">
              注文確認と完成通知をお送りします
            </p>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (!validateEmail(e.target.value)) {
                  setEmailError('有効なメールアドレスを入力してください');
                } else {
                  setEmailError('');
                }
              }}
              className={`w-full border p-3 rounded ${emailError ? 'border-red-500' : ''}`}
              placeholder="example@email.com"
            />
            {emailError && <p className="text-xs text-red-500 mt-1 font-bold">{emailError}</p>}
          </div>

          {/* ========== 簡単モード ========== */}
          {plan === 'simple' && (
            <>
              {/* Q1. 呼び名 */}
              <div className="bg-pink-50 p-5 rounded-lg border border-pink-100">
                <label className="block font-bold text-gray-800 mb-2">🎸 Q1. 歌の中で、歌ってもらいたい呼び名は？ <span className="text-red-500">*</span></label>
                <p className="text-sm text-gray-500 mb-2">ひらがな、カタカナ、アルファベットOKです（漢字入力不可）</p>
                <input required type="text" name="targetName" onChange={handleChange} className={`w-full border p-3 rounded ${nameError ? 'border-red-500' : ''}`} placeholder="例：ゆうちゃん、Hanako" />
                {nameError && <p className="text-xs text-red-500 mt-1 font-bold">{nameError}</p>}
              </div>

              {/* Q2. 色 */}
              <div className="bg-pink-50 p-5 rounded-lg border border-pink-100">
                <label className="block font-bold text-gray-800 mb-2">🌈 Q2. その人を色で表すと？ <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {COLORS.map((c) => (
                    <label key={c.label} className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="targetColor" value={c.value} onChange={handleChange} required className="form-radio text-pink-500" />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q3. 気持ち */}
              <div className="bg-pink-50 p-5 rounded-lg border border-pink-100">
                <label className="block font-bold text-gray-800 mb-2">✨ Q3. その人といると、どんな気持ち？ <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {FEELINGS.map((f) => (
                    <label key={f.label} className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" value={f.value} onChange={handleCheckboxChange} className="form-checkbox text-pink-500" />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q4. 魔法の言葉 */}
              <div className="bg-pink-50 p-5 rounded-lg border border-pink-100">
                <label className="block font-bold text-gray-800 mb-2">💌 Q4. 魔法の言葉を一つ贈るなら？ <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {MAGIC_WORDS.map((w) => (
                    <label key={w} className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="magicWord" value={w} onChange={handleChange} required className="form-radio text-pink-500" />
                      <span>{w}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q5. かけたい魔法 */}
              <div className="bg-pink-50 p-5 rounded-lg border border-pink-100">
                <label className="block font-bold text-gray-800 mb-2">🧚‍♀️ Q5. その人の新しい一年に、どんな魔法をかけたい？ <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {MAGIC_SPELLS.map((s) => (
                    <label key={s} className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="magicSpell" value={s} onChange={handleChange} required className="form-radio text-pink-500" />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ========== プロモード ========== */}
          {plan === 'pro' && (
            <>
              {/* Q1. ジャンル */}
              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
                <label className="block font-bold text-gray-800 mb-2">Q1. ジャンルを選んでください <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {PRO_GENRES.map((g) => (
                    <label key={g} className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="proGenre" value={g} onChange={handleChange} required className="form-radio text-indigo-500" />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q2. 楽器 */}
              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
                <label className="block font-bold text-gray-800 mb-2">Q2. 入れたい楽器を選んでください（複数可） <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {PRO_INSTRUMENTS.map((i) => (
                    <div key={i} className="col-span-1">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" value={i} checked={formData.proInstruments.includes(i)} onChange={handleProCheckboxChange} className="form-checkbox text-indigo-500" />
                        <span>{i}</span>
                      </label>
                      {i === 'その他' && formData.proInstruments.includes('その他') && (
                        <input type="text" value={otherInstrument} onChange={(e) => setOtherInstrument(e.target.value)} placeholder="楽器名を入力" className="mt-1 ml-6 w-3/4 text-sm border-b border-gray-400 focus:outline-none focus:border-indigo-500 bg-transparent" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Q3. 性別 */}
              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
                <label className="block font-bold text-gray-800 mb-2">Q3. 歌い手の性別を選んでください <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {PRO_GENDERS.map((g) => (
                    <label key={g} className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" name="proGender" value={g} onChange={handleChange} required className="form-radio text-indigo-500" />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q4. 呼び名 */}
              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
                <label className="block font-bold text-gray-800 mb-2">Q4. 歌の中で、歌ってもらいたい呼び名は？ <span className="text-red-500">*</span></label>
                <p className="text-sm text-gray-500 mb-2">ひらがな、カタカナ、アルファベットOKです（漢字入力不可）</p>
                <input required type="text" name="targetName" onChange={handleChange} className={`w-full border p-3 rounded bg-white ${nameError ? 'border-red-500' : ''}`} placeholder="例：ゆうちゃん、Hanako" />
                {nameError && <p className="text-xs text-red-500 mt-1 font-bold">{nameError}</p>}
              </div>

              {/* Q5-1. メッセージ1 */}
              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
                <label className="block font-bold text-gray-800 mb-2">Q5-1. メッセージ1（Aメロ用） <span className="text-red-500">*</span></label>
                <p className="text-sm text-gray-500 mb-2">30文字以内で入力してください</p>
                <input required type="text" name="proMessage1" maxLength={30} onChange={handleChange} className="w-full border p-3 rounded" placeholder="例：素敵な一年になりますように" />
                <p className="text-right text-xs text-gray-400">{formData.proMessage1.length}/30</p>
              </div>

              {/* Q5-2. メッセージ2 */}
              <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
                <label className="block font-bold text-gray-800 mb-2">Q5-2. メッセージ2（Bメロ用） <span className="text-red-500">*</span></label>
                <p className="text-sm text-gray-500 mb-2">30文字以内で入力してください</p>
                <input required type="text" name="proMessage2" maxLength={30} onChange={handleChange} className="w-full border p-3 rounded" placeholder="例：いつもありがとう" />
                <p className="text-right text-xs text-gray-400">{formData.proMessage2.length}/30</p>
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className={`w-full py-4 rounded-lg font-bold text-white text-xl shadow hover:opacity-90 transition ${plan === 'simple' ? 'bg-pink-500' : 'bg-indigo-600'}`}>
            {loading ? '送信中...' : 'この内容で注文する（¥500）'}
          </button>
        </form>
      </div>
    </div>
  );
};

// 4. 注文確認ページ（トークン認証）
const OrderConfirmPage = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        <div className="text-center">
          <Link to="/" className="text-blue-500 underline">トップページへ戻る</Link>
        </div>
      </div>
    </div>
  );
};

// 5. 管理者ログインページ
const AdminLoginPage = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      console.log('[Auth] Attempting Google sign in with popup...');
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log('[Auth] Sign in successful:', user.email);

      // 管理者チェック
      const adminEmailsStr = import.meta.env.VITE_ADMIN_EMAIL || '';
      const adminEmails = adminEmailsStr.split(',').map(e => e.trim());

      if (!adminEmails.includes(user.email)) {
        console.warn('[Auth] User is not an admin:', user.email);
        await signOut(auth);
        alert('管理者権限がありません');
        return;
      }

      console.log('[Auth] Admin verified, navigating to /admin');
      navigate('/admin');
    } catch (error) {
      // 詳細なエラー情報をログ出力
      console.error('[Auth] Login error occurred:', {
        code: error?.code,
        message: error?.message,
        email: error?.customData?.email,
        fullError: error
      });

      // ユーザーにも詳細を表示
      const code = error?.code || '(no code)';
      const message = error?.message || String(error);
      const email = error?.customData?.email ? `\nemail: ${error.customData.email}` : '';

      alert(`ログインに失敗しました。${email}\n\nエラーコード: ${code}\n\n詳細: ${message}\n\nFirebase設定を確認してください:\n- projectId: ${import.meta.env.VITE_FIREBASE_PROJECT_ID}\n- authDomain: ${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center bg-gray-50">
      <h2 className="text-2xl font-bold mb-6">管理者ログイン</h2>
      <button
        onClick={handleGoogleLogin}
        className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded shadow hover:bg-gray-100 transition"
      >
        <span className="text-blue-500 mr-2">G</span> Googleでログイン
      </button>
      <Link to="/" className="text-blue-500 text-sm underline mt-6 block">
        トップページへ
      </Link>
    </div>
  );
};

// 6. 管理者ダッシュボード
const AdminPage = ({ user }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // 編集機能用の状態管理
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editedLyrics, setEditedLyrics] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');

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

  // ポーリング処理 (useCallbackでラップ)
  const checkSunoStatus = useCallback(async (order) => {
    if (!SUNO_API_KEY) return;
    try {
      // 正しいエンドポイント: /api/v1/generate/record-info?taskId=...
      const response = await fetch(`${SUNO_BASE_URL}/generate/record-info?taskId=${order.sunoTaskId}`, {
        headers: {
          "Authorization": `Bearer ${SUNO_API_KEY}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) return;

      const result = await response.json();

      // レスポンス構造: { code: 200, msg: "success", data: { taskId, status, response: { sunoData: [...] } } }
      if (result.code === 200 && result.data?.status === "SUCCESS") {
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
            generatedSongs: songs
          });
        }
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
          callBackUrl: "https://birthday-song-app.firebaseapp.com/api/callback"
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
          sunoTaskId: taskId
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

  const handleGenerateEmail = async (order) => {
    if (!GEMINI_API_KEY) return;
    const prompt = `
      以下の顧客への「バースデーソング納品メール」の文面を作成してください。
      顧客名: ${order.targetName} 様
      プラン: ${order.plan === 'simple' ? '魔法診断' : 'プロ'}
      曲の雰囲気: ${order.mood || order.proGenre}

      条件:
      - 件名は「【Songift】世界に一つのバースデーソングをお届けします」
      - 本文は感動的で温かいトーン
      - 「添付のMP3ファイルをダウンロードしてお聞きください」という案内を入れる
      - URL案内はしない（ファイル添付のため）
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      await updateDoc(doc(db, "orders", order.id), {
        deliveryEmailBody: text
      });
    } catch (e) {
      alert("メール生成エラー");
    }
  };

  const handleSendDelivery = async (order) => {
    if (!order.selectedSongUrl) return alert("楽曲が選定されていません");
    if (!order.deliveryEmailBody) return alert("メール文面が生成されていません");
    if (!confirm("MP3ファイルを添付してメールを自動送信します。よろしいですか？")) return;

    try {
      // ステータスを送信中に更新
      await updateDoc(doc(db, "orders", order.id), {
        deliveryStatus: "sending"
      });

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
          recipientName: order.targetName,
          mp3Url: order.selectedSongUrl,
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


  if (loading) return <div className="p-10 text-center">データを読み込んでいます...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">管理者ダッシュボード</h1>
        
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
                  {order.status === 'generating_song' ? (
                    <div className="text-center py-4 text-orange-600 font-bold animate-pulse">
                      生成中... 自動更新されます
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateSong(order)}
                      disabled={!order.generatedPrompt}
                      className="bg-orange-500 text-white w-full py-2 rounded shadow hover:bg-orange-600 disabled:bg-gray-300 mb-2"
                    >
                      {order.sunoTaskId ? 'Sunoで再生成 🔄' : 'Sunoで生成開始 🎵'}
                    </button>
                  )}
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

                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold text-gray-700 mb-2">3. メール作成 & 納品</h4>
                  {!order.deliveryEmailBody ? (
                    <button
                      onClick={() => handleGenerateEmail(order)}
                      disabled={!order.selectedSongUrl}
                      className="bg-blue-600 text-white w-full py-2 rounded shadow hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      文面作成 📝
                    </button>
                  ) : (
                    <>
                      <textarea
                        className="w-full h-32 text-xs border p-2 rounded mb-2"
                        defaultValue={order.deliveryEmailBody}
                      />
                      <button
                        onClick={() => handleSendDelivery(order)}
                        className="bg-green-600 text-white w-full py-2 rounded shadow hover:bg-green-700 font-bold"
                      >
                        MP3添付で送信 🚀
                      </button>
                    </>
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

// ---------------------------
// メインアプリコンポーネント
// ---------------------------
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    alert("ログアウトしました");
  };

  // 管理者判定ヘルパー
  const isAdmin = (user) => {
    if (!user) return false;
    const adminEmailsStr = import.meta.env.VITE_ADMIN_EMAIL || '';
    const adminEmails = adminEmailsStr.split(',').map(e => e.trim());
    return adminEmails.includes(user.email);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <BrowserRouter>
      {/* ヘッダーは管理者のみ表示 */}
      {user && isAdmin(user) && (
        <header className="p-4 bg-white shadow-sm flex justify-between items-center fixed top-0 w-full z-10">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bold text-blue-600 text-xl">Songift</Link>
            <Link to="/admin" className="text-sm font-bold text-gray-600 hover:text-blue-500 bg-gray-100 px-3 py-1 rounded">
              管理者画面へ
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.displayName}さん</span>
            <button onClick={handleLogout} className="text-sm text-red-500 underline">ログアウト</button>
          </div>
        </header>
      )}

      <Routes>
        {/* 一般ユーザー向けルート */}
        <Route path="/" element={<TopPage />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/o/:orderId" element={<OrderConfirmPage />} />

        {/* 管理者向けルート */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            user && isAdmin(user)
              ? <div className="pt-16"><AdminPage user={user} /></div>
              : <Navigate to="/admin/login" />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;