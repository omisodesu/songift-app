import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../lib/analytics';
import { getVariant } from '../lib/ab';
import {
  COLORS,
  FEELINGS,
  MAGIC_WORDS,
  MAGIC_SPELLS,
  PRO_GENRES,
  PRO_INSTRUMENTS,
  PRO_GENDERS,
} from '../lib/constants';
import { BACKGROUND_TEMPLATES } from '../lib/backgroundTemplates';

// 2. 注文フォームページ
const OrderPage = ({ user = null }) => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState('simple');
  const trackedRef = useRef(false);

  // ページ表示時にorder_startイベントを送信（1回のみ）
  useEffect(() => {
    if (!trackedRef.current) {
      track('order_start', { variant: getVariant() });
      trackedRef.current = true;
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [otherInstrument, setOtherInstrument] = useState('');
  const [nameError, setNameError] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const [formData, setFormData] = useState({
    targetName: '',
    targetColor: '',
    targetFeeling: '',
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
    // 背景テンプレート
    backgroundTemplateId: 't1',
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

      // 注文成功イベントを送信（orderIdのみ、PIIは送らない）
      track('order_created', {
        variant: getVariant(),
        orderId: result.orderId || null,
      });

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
                      <input type="radio" name="targetFeeling" value={f.value} onChange={handleChange} required className="form-radio text-pink-500" />
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

          {/* 背景テンプレート選択（両モード共通） */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <label className="block font-bold text-gray-800 mb-2">
              🎬 動画の背景スタイル <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-gray-500 mb-3">
              完成動画に使用する背景を選んでください
            </p>
            <div className="grid grid-cols-3 gap-3">
              {BACKGROUND_TEMPLATES.map((template) => (
                <label
                  key={template.id}
                  className={`relative flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.backgroundTemplateId === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="backgroundTemplateId"
                    value={template.id}
                    checked={formData.backgroundTemplateId === template.id}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div
                    className={`w-16 h-24 rounded-md mb-2 ${template.previewClass}`}
                  ></div>
                  <span className="text-sm font-medium text-gray-800">{template.name}</span>
                  <span className="text-xs text-gray-500">{template.desc}</span>
                  {formData.backgroundTemplateId === template.id && (
                    <span className="absolute top-1 right-1 text-blue-500 text-lg">✓</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className={`w-full py-4 rounded-lg font-bold text-white text-xl shadow hover:opacity-90 transition ${plan === 'simple' ? 'bg-pink-500' : 'bg-indigo-600'}`}>
            {loading ? '送信中...' : 'この内容で申し込む'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrderPage;
