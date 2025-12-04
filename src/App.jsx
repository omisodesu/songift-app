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
  apiKey: "AIzaSyBQ0EaxaTZPEJDJpP9K_AsNq74kyRhi5kQ",
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
    targetName: '',
    targetAge: '',
    relation: '',
    mood: '明るい',
    episode: '',
    genre: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
        status: "waiting", // waiting -> processing -> completed
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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow">
        <h2 className="text-2xl font-bold text-center mb-6">楽曲作成オーダー</h2>
        <div className="flex justify-center mb-8">
          <button onClick={() => setPlan('simple')} className={`px-6 py-2 rounded-l-lg font-bold ${plan === 'simple' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>簡単モード</button>
          <button onClick={() => setPlan('pro')} className={`px-6 py-2 rounded-r-lg font-bold ${plan === 'pro' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'}`}>プロモード</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div><label className="block text-sm font-bold text-gray-700 mb-1">お相手のお名前</label><input required type="text" name="targetName" onChange={handleChange} className="w-full border p-3 rounded" placeholder="例：花子" /></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-1">お相手の年齢</label><input required type="text" name="targetAge" onChange={handleChange} className="w-full border p-3 rounded" placeholder="例：24歳" /></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-1">関係性</label><input required type="text" name="relation" onChange={handleChange} className="w-full border p-3 rounded" placeholder="例：恋人、親友" /></div>
          {plan === 'simple' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">曲の雰囲気</label>
              <select name="mood" onChange={handleChange} className="w-full border p-3 rounded">
                <option value="明るい">明るい・ポップ</option>
                <option value="感動的">感動的・バラード</option>
                <option value="おしゃれ">おしゃれ・カフェ風</option>
              </select>
            </div>
          )}
          {plan === 'pro' && (
            <>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">具体的なジャンル</label><input type="text" name="genre" onChange={handleChange} className="w-full border p-3 rounded" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">エピソード</label><textarea name="episode" onChange={handleChange} rows="4" className="w-full border p-3 rounded"></textarea></div>
            </>
          )}
          <button type="submit" disabled={loading} className={`w-full py-4 rounded-lg font-bold text-white text-xl shadow hover:opacity-90 transition ${plan === 'simple' ? 'bg-blue-500' : 'bg-indigo-600'}`}>{loading ? '送信中...' : 'この内容で注文する（¥500）'}</button>
        </form>
      </div>
    </div>
  );
};

// 4. 管理者ダッシュボード
const AdminPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sunoUrlInput, setSunoUrlInput] = useState({}); // 入力中のURLを管理

  // ★ここに取得したGeminiのAPIキーを貼り付けてください！
  const GEMINI_API_KEY = "AIzaSyBuMrqGnKsh-X8phIHqKp7yPM4ZzU6Gufk"; 

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
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("ここに")) {
      alert("APIキーが設定されていません。コードを確認してください。");
      return;
    }
    if (!confirm(`${order.targetName}様のプロンプトを生成しますか？`)) return;

    // Geminiへの指示書
    const systemPrompt = `
      あなたはプロの作詞作曲家です。
      以下のユーザー情報を元に、Suno AIで楽曲を生成するための「英語のプロンプト（歌詞のテーマと音楽スタイル）」を作成してください。
      出力は英語のプロンプトのみを行ってください。余計な説明は不要です。
      
      [ユーザー情報]
      Target: ${order.targetName} (${order.targetAge}yo)
      Relation: ${order.relation}
      Mood: ${order.mood || 'Happy Birthday'}
      Plan: ${order.plan}
      ${order.plan === 'pro' ? `Genre: ${order.genre}\nEpisode: ${order.episode}` : ''}
    `;

    try {
      // Gemini APIを呼び出し
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
      });
      
      const data = await response.json();

      // ★エラーチェックを強化しました
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
        fetchOrders(); // 画面更新
      } else {
        console.log("Response Data:", data);
        alert("生成に失敗しました。(AIが空の応答を返しました)");
      }
    } catch (error) {
      console.error(error);
      // エラーの内容をアラートで表示
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.plan === 'pro' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                      {order.plan === 'simple' ? '簡単' : 'プロ'}
                    </span>
                    <span className="text-sm text-gray-500">{order.createdAt}</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {order.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold">{order.targetName} 様 ({order.targetAge}) <span className="text-sm font-normal text-gray-600">関係: {order.relation}</span></h3>
                  <p className="text-gray-600 mt-1">雰囲気: {order.mood} {order.genre && `/ ${order.genre}`}</p>
                  {order.episode && <p className="text-sm bg-gray-50 p-2 mt-2 rounded">エピソード: {order.episode}</p>}
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
                        onChange={(e) => setSunoUrlInput({...sunoUrlInput, [order.id]: e.target.value})}
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