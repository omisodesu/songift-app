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
  // 環境変数から読み込み（Vite標準の書き方）
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
// 管理者リストの定義（複数対応）
// ---------------------------
// 環境変数から読み込み、カンマで区切って配列にする
// ※プレビュー環境で警告が出ても、ローカル(Vite)では正常に動作します
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAIL || "")
  .split(',')
  .map(email => email.trim());

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
  const [otherInstrument, setOtherInstrument] = useState(''); 
  const [nameError, setNameError] = useState('');
  
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

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userEmail: user.email,
        plan: plan,
        ...finalFormData,
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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow">
        <h2 className="text-2xl font-bold text-center mb-6">楽曲作成オーダー</h2>
        
        <div className="flex justify-center mb-8">
          <button onClick={() => setPlan('simple')} className={`px-6 py-2 rounded-l-lg font-bold ${plan === 'simple' ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-600'}`}>簡単モード（魔法診断）</button>
          <button onClick={() => setPlan('pro')} className={`px-6 py-2 rounded-r-lg font-bold ${plan === 'pro' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'}`}>プロモード</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
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

// 4. 管理者ダッシュボード
const AdminPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sunoUrlInput, setSunoUrlInput] = useState({});

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

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

  // アクセス制限のチェック
  const { user } = auth; // 現在のユーザーを取得
  useEffect(() => {
    // ユーザーが存在しない、または管理者リストに含まれていない場合
    if (!auth.currentUser || !ADMIN_EMAILS.includes(auth.currentUser.email)) {
      alert("権限がありません。トップページへ戻ります。");
      window.location.href = '/'; 
    } else {
      fetchOrders();
    }
  }, []);

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
        fetchOrders();
      } else {
        alert("生成に失敗しました。(AIが空の応答を返しました)");
      }
    } catch (error) {
      console.error(error);
      alert(`エラーが発生しました:\n${error.message}`);
    }
  };

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

              {/* 作業エリア */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 左：AIプロンプト生成 */}
                <div className="bg-gray-50 p-4 rounded border flex flex-col gap-4">
                  <h4 className="font-bold text-gray-700">1. AIプロンプト生成</h4>
                  
                  {/* 歌詞エリア */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">生成された歌詞</label>
                    <div className="relative">
                      <textarea 
                        readOnly 
                        className="w-full h-32 p-2 text-xs border rounded bg-white"
                        value={order.generatedLyrics || "（未生成）"}
                      />
                      {order.generatedLyrics && (
                        <button 
                          onClick={() => navigator.clipboard.writeText(order.generatedLyrics)}
                          className="absolute right-2 top-2 bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-300"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sunoプロンプトエリア */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Suno AIプロンプト</label>
                    <div className="relative">
                      <textarea 
                        readOnly 
                        className="w-full h-24 p-2 text-xs border rounded bg-white"
                        value={order.generatedPrompt || "（未生成）"}
                      />
                      {order.generatedPrompt && (
                        <button 
                          onClick={() => navigator.clipboard.writeText(order.generatedPrompt)}
                          className="absolute right-2 top-2 bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-300"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleGeneratePrompt(order)}
                    className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition w-full"
                  >
                    Geminiでプロンプト生成 ✨
                  </button>
                </div>

                {/* 右：Suno URL登録と納品 */}
                <div className="bg-gray-50 p-4 rounded border">
                  <h4 className="font-bold text-gray-700 mb-2">2. 楽曲登録 & 納品</h4>
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
                  {order.sunoUrl && <button onClick={() => handleSendMail(order)} className="mt-2 bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 w-full font-bold">メールで納品する 📧</button>}
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <BrowserRouter>
      {user && (
        <header className="p-4 bg-white shadow-sm flex justify-between items-center fixed top-0 w-full z-10">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bold text-blue-600 text-xl">Songift</Link>
            {/* 複数管理者対応: メールアドレスリストに含まれているかチェック */}
            {ADMIN_EMAILS.includes(user.email) && (
              <Link to="/admin" className="text-sm font-bold text-gray-600 hover:text-blue-500 bg-gray-100 px-3 py-1 rounded">
                管理者画面へ
              </Link>
            )}
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
        {/* 管理者ページのルート: ここでも念のためガードを入れておく */}
        <Route path="/admin" element={user ? <div className="pt-16"><AdminPage /></div> : <LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;