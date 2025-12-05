import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
// Firebase関連
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, getDocs, doc, updateDoc
} from "firebase/firestore";

// ---------------------------
// Firebase設定
// ---------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "birthday-song-app.firebaseapp.com",
  projectId: "birthday-song-app",
  storageBucket: "birthday-song-app.firebasestorage.app",
  messagingSenderId: "60887117542",
  appId: "1:60887117542:web:f4b8dfd446c5f26792d527"
};

// 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

// ---------------------------
// 定数データ（魔法診断用）
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
    <Link to="/login" className="bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-blue-600 transition shadow-lg">
      作成を申し込む
    </Link>
  </div>
);

// 2. ログインページ
const LoginPage = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/order');
    } catch (error) {
      console.error("ログインエラー:", error);
      alert("ログインに失敗しました。");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center bg-gray-50">
      <h2 className="text-2xl font-bold mb-6">ログイン</h2>
      <button
        onClick={handleGoogleLogin}
        className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded shadow hover:bg-gray-100 transition"
      >
        <span className="text-blue-500 mr-2">G</span> Googleでログイン
      </button>
      <Link to="/" className="text-blue-500 text-sm underline mt-6 block">戻る</Link>
    </div>
  );
};

// 3. 注文フォームページ
const OrderPage = ({ user }) => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState('simple');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // 共通
    targetName: '',
    // プロモード用
    targetAge: '',
    relation: '',
    mood: '明るい',
    episode: '',
    genre: '',
    // 簡単モード（魔法診断）用
    targetColor: '',
    targetFeeling: [],
    magicWord: '',
    magicSpell: '',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      // 配列の処理 (targetFeeling)
      setFormData(prev => {
        const newArray = checked
          ? [...prev[name], value]
          : prev[name].filter(item => item !== value);
        return { ...prev, [name]: newArray };
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userEmail: user.email,
        plan: plan,
        ...formData,
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      alert("注文を受け付けました！完成をお待ちください。");
      navigate('/');
    } catch (error) {
      console.error("注文エラー:", error);
      alert("送信に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen py-10 px-4 ${plan === 'simple' ? 'bg-pink-50' : 'bg-gray-50'}`}>
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow">
        <h2 className="text-2xl font-bold text-center mb-6">楽曲作成オーダー</h2>
        <div className="flex justify-center mb-8">
          <button onClick={() => setPlan('simple')} className={`px-6 py-2 rounded-l-lg font-bold ${plan === 'simple' ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-600'}`}>魔法診断 (Easy)</button>
          <button onClick={() => setPlan('pro')} className={`px-6 py-2 rounded-r-lg font-bold ${plan === 'pro' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'}`}>プロモード (Pro)</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* 共通項目: 名前 */}
          <div className={`p-4 rounded-lg border-2 ${plan === 'simple' ? 'border-pink-100 bg-pink-50/30' : 'border-gray-200'}`}>
            <label className="block text-sm font-bold text-gray-700 mb-2">Q1. 歌の中で、歌ってもらいたい呼び名は？</label>
            <input
              required
              type="text"
              name="targetName"
              onChange={handleChange}
              className="w-full border p-3 rounded bg-white"
              placeholder="例：はなこ、ハナコ、Hanako"
            />
            <p className="text-xs text-gray-500 mt-1">※ひらがな、カタカナ、アルファベットOK（漢字不可）</p>
          </div>

          {/* 簡単モード（魔法診断） */}
          {plan === 'simple' && (
            <>
              <div className="p-4 rounded-lg border-2 border-pink-100 bg-pink-50/30">
                <label className="block text-sm font-bold text-gray-700 mb-2">Q2. その人を色で表すと？</label>
                <div className="space-y-2">
                  {COLORS.map((c) => (
                    <label key={c.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="targetColor"
                        value={c.value}
                        onChange={handleChange}
                        required
                        className="text-pink-500 focus:ring-pink-500"
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border-2 border-pink-100 bg-pink-50/30">
                <label className="block text-sm font-bold text-gray-700 mb-2">Q3. その人といると、どんな気持ち？ (複数選択可)</label>
                <div className="grid grid-cols-2 gap-2">
                  {FEELINGS.map((f) => (
                    <label key={f.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="targetFeeling"
                        value={f.value}
                        onChange={handleChange}
                        className="text-pink-500 focus:ring-pink-500 rounded"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border-2 border-pink-100 bg-pink-50/30">
                <label className="block text-sm font-bold text-gray-700 mb-2">Q4. 魔法の言葉を一つ贈るなら？</label>
                <div className="space-y-2">
                  {MAGIC_WORDS.map((w) => (
                    <label key={w} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="magicWord"
                        value={w}
                        onChange={handleChange}
                        required
                        className="text-pink-500 focus:ring-pink-500"
                      />
                      <span>{w}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border-2 border-pink-100 bg-pink-50/30">
                <label className="block text-sm font-bold text-gray-700 mb-2">Q5. その人の新しい一年に、どんな魔法をかけたい？</label>
                <div className="space-y-2">
                  {MAGIC_SPELLS.map((s) => (
                    <label key={s} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="magicSpell"
                        value={s}
                        onChange={handleChange}
                        required
                        className="text-pink-500 focus:ring-pink-500"
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* プロモード */}
          {plan === 'pro' && (
            <>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">お相手の年齢</label><input required type="text" name="targetAge" onChange={handleChange} className="w-full border p-3 rounded" placeholder="例：24歳" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">関係性</label><input required type="text" name="relation" onChange={handleChange} className="w-full border p-3 rounded" placeholder="例：恋人、親友" /></div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">曲の雰囲気</label>
                <select name="mood" onChange={handleChange} className="w-full border p-3 rounded">
                  <option value="明るい">明るい・ポップ</option>
                  <option value="感動的">感動的・バラード</option>
                  <option value="おしゃれ">おしゃれ・カフェ風</option>
                </select>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">具体的なジャンル</label><input type="text" name="genre" onChange={handleChange} className="w-full border p-3 rounded" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">エピソード</label><textarea name="episode" onChange={handleChange} rows="4" className="w-full border p-3 rounded"></textarea></div>
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

// 4. 管理者ダッシュボード
const AdminPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sunoUrlInput, setSunoUrlInput] = useState({});

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  // データ取得
  const fetchOrders = async () => {
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || "日時不明"
      }));
      setOrders(data);
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Geminiでプロンプト生成
  const handleGeneratePrompt = async (order) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "LOAD_FROM_ENV") {
      alert("APIキーが設定されていません。コード内の LOAD_FROM_ENV を import.meta.env... に書き換えてください。");
      return;
    }
    if (!confirm(`${order.targetName}様のプロンプトを生成しますか？`)) return;

    let systemPrompt = "";

    if (order.plan === 'simple') {
      // 魔法診断モードのプロンプト
      const feelingsStr = Array.isArray(order.targetFeeling) ? order.targetFeeling.join(", ") : order.targetFeeling;
      systemPrompt = `
        You are a professional songwriter.
        Based on the "Magic Diagnosis" results below, create an English prompt (Music Style & Lyrics Topic) for Suno AI to generate a birthday song.
        
        [Diagnosis Results]
        Target Name: ${order.targetName}
        Image Color: ${order.targetColor}
        Feelings: ${feelingsStr}
        Message: ${order.magicWord}
        Magic Spell (Wish): ${order.magicSpell}
        
        Output only the English prompt text. No explanations.
      `;
    } else {
      // プロモードのプロンプト
      systemPrompt = `
        You are a professional songwriter.
        Based on the user info below, create an English prompt (Music Style & Lyrics Topic) for Suno AI to generate a birthday song.
        
        [User Info]
        Target: ${order.targetName} (${order.targetAge}yo)
        Relation: ${order.relation}
        Mood: ${order.mood || 'Happy Birthday'}
        Genre: ${order.genre}
        Episode: ${order.episode}
        
        Output only the English prompt text. No explanations.
      `;
    }

    try {
      // Gemini APIを呼び出し（gemini-2.5-flash）
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
        // Firestoreに保存
        const orderRef = doc(db, "orders", order.id);
        await updateDoc(orderRef, {
          generatedPrompt: generatedText,
          status: "processing"
        });
        alert("プロンプト生成完了！");
        fetchOrders();
      } else {
        console.log("Response Data:", data);
        alert("生成に失敗しました。(AIが空の応答を返しました)");
      }
    } catch (error) {
      console.error(error);
      alert(`エラーが発生しました:\n${error.message}`);
    }
  };

  // Suno URLの保存
  const handleSaveUrl = async (orderId) => {
    const url = sunoUrlInput[orderId];
    if (!url) return;

    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        sunoUrl: url,
        status: "completed"
      });
      alert("URLを保存しました！納品準備完了です。");
      fetchOrders();
    } catch (error) {
      console.error(error);
      alert("保存失敗");
    }
  };

  // 納品メール（メーラー起動）
  const handleSendMail = (order) => {
    const subject = `【Songift】バースデーソングの納品：${order.targetName}様へ`;
    const body = `
${order.targetName}様

Songiftをご利用いただきありがとうございます。
ご注文いただいたバースデーソングが完成いたしました！

以下のURLよりお聞きください：
${order.sunoUrl}

素敵な誕生日になりますように。
Songift運営チーム
    `;
    window.location.href = `mailto:${order.userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
                      <h3 className="text-xl font-bold mb-1">{order.targetName} 様 ({order.targetAge})</h3>
                      <p>関係: {order.relation}</p>
                      <p>雰囲気: {order.mood} {order.genre && `/ ${order.genre}`}</p>
                      {order.episode && <p className="text-sm bg-gray-50 p-2 mt-2 rounded">エピソード: {order.episode}</p>}
                    </div>
                  )}

                </div>
              </div>

              {/* 作業エリア */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 左：AIプロンプト生成 */}
                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold text-gray-700 mb-2">1. AIプロンプト生成</h4>
                  {order.generatedPrompt ? (
                    <div>
                      <textarea
                        readOnly
                        className="w-full h-24 p-2 text-xs border rounded mb-2 bg-white"
                        value={order.generatedPrompt}
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(order.generatedPrompt)}
                        className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                      >
                        コピーする
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGeneratePrompt(order)}
                      className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition w-full"
                    >
                      Geminiでプロンプト生成 ✨
                    </button>
                  )}
                </div>

                {/* 右：Suno URL登録と納品 */}
                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold text-gray-700 mb-2">2. 楽曲登録 & 納品</h4>
                  {order.sunoUrl ? (
                    <div>
                      <p className="text-sm text-green-600 font-bold mb-2">楽曲登録済み</p>
                      <a href={order.sunoUrl} target="_blank" rel="noreferrer" className="text-blue-500 underline text-sm block mb-4">
                        {order.sunoUrl}
                      </a>
                      <button
                        onClick={() => handleSendMail(order)}
                        className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition w-full font-bold"
                      >
                        メールで納品する 📧
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Sunoで作ったURLを貼る"
                        className="flex-1 border p-2 rounded text-sm"
                        onChange={(e) => setSunoUrlInput({ ...sunoUrlInput, [order.id]: e.target.value })}
                      />
                      <button
                        onClick={() => handleSaveUrl(order.id)}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                      >
                        保存
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-center text-gray-500">注文はありません</p>}
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <BrowserRouter>
      {user && (
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
        <Route path="/" element={user ? <div className="pt-16"><OrderPage user={user} /></div> : <TopPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/order" element={user ? <div className="pt-16"><OrderPage user={user} /></div> : <LoginPage />} />
        <Route path="/admin" element={user ? <div className="pt-16"><AdminPage /></div> : <LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;