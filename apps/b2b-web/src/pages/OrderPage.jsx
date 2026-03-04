import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../lib/analytics';
import { getVariant } from '../lib/ab';
import {
  NH_GENDERS,
  NH_GENRES,
  NH_SEASONS,
  NH_MEMORIES,
  NH_PERSONALITIES,
  SAMPLE_VIDEOS,
} from '../lib/constants';
import { useAuth } from '../contexts/AuthContext';


// 楽曲作成オーダーページ
const OrderPage = () => {
  const { user, currentOrgId, membership } = useAuth();
  const navigate = useNavigate();
  const trackedRef = useRef(false);

  // ページ表示時にorder_startイベントを送信（1回のみ）
  useEffect(() => {
    if (!trackedRef.current) {
      track('order_start', { variant: getVariant() });
      trackedRef.current = true;
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [showQ2Sample, setShowQ2Sample] = useState(false);
  const [showQ3SampleMale, setShowQ3SampleMale] = useState(false);
  const [showQ3SampleFemale, setShowQ3SampleFemale] = useState(false);

  const [formData, setFormData] = useState({
    targetName: '',       // Q1: 呼び名
    nhGender: '',         // Q2: 歌い手の性別
    nhGenre: '',          // Q3: 曲の雰囲気
    nhSeason: '',         // Q4: 生まれた季節
    nhMemory: '',         // Q5: よく話される思い出
    nhPersonality: '',    // Q6: 人柄
  });

  const validateName = (name) => {
    const regex = /^[a-zA-Z0-9ぁ-んァ-ンー\s]+$/;
    return regex.test(name);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'targetName') {
      if (value !== '' && !validateName(value)) {
        setNameError('※漢字は使用できません（ひらがな、カタカナ、英語のみ）');
      } else {
        setNameError('');
      }
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (nameError || !formData.targetName) {
      alert("お名前の入力を確認してください。");
      return;
    }

    setLoading(true);

    try {
      // Cloud Functions createOrder を呼び出し
      const functionUrl = `${import.meta.env.VITE_FUNCTIONS_BASE_URL}/createOrder`;

      // orgIdを決定: currentOrgId > 単一org所属 > なし
      const orgId = currentOrgId || (membership?.orgIds?.length === 1 ? membership.orgIds[0] : null);

      const idToken = user ? await user.getIdToken() : null;
      const headers = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plan: 'nursingHome',
          formData: formData,
          orgId: orgId,
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
      alert('注文を受け付けました！');
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

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Q1. 呼び名 */}
          <div className="bg-amber-50 p-5 rounded-lg border border-amber-100">
            <label className="block font-bold text-gray-800 mb-2">
              🎤 Q1. 歌の中で、歌ってもらいたい呼び名は？ <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-gray-500 mb-2">ひらがな、カタカナ、アルファベットOKです（漢字入力不可）</p>
            <input
              required
              type="text"
              name="targetName"
              value={formData.targetName}
              onChange={handleChange}
              className={`w-full border p-3 rounded ${nameError ? 'border-red-500' : ''}`}
              placeholder="例：ゆうちゃん、Hanako"
            />
            {nameError && <p className="text-xs text-red-500 mt-1 font-bold">{nameError}</p>}
          </div>

          {/* Q2. 歌い手の性別 */}
          <div className="bg-amber-50 p-5 rounded-lg border border-amber-100">
            <label className="block font-bold text-gray-800 mb-2">
              🎵 Q2. 歌い手の性別は？ <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-gray-500 mb-2">どちらの声で歌ってほしいですか？（選択するとサンプル曲を試聴できます）</p>
            <div className="space-y-2">
              {NH_GENDERS.map((g) => (
                <label key={g.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nhGender"
                    value={g.value}
                    onChange={(e) => { handleChange(e); setShowQ2Sample(false); }}
                    required
                    className="form-radio text-amber-500"
                  />
                  <span>{g.label}</span>
                </label>
              ))}
            </div>
            {formData.nhGender && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowQ2Sample(!showQ2Sample)}
                  className="text-sm text-amber-700 underline hover:text-amber-900 transition"
                >
                  {showQ2Sample ? '▲ サンプルを閉じる' : `▶ サンプル曲を聴く（演歌・${formData.nhGender}）`}
                </button>
                {showQ2Sample && (
                  <div className="mt-2 aspect-video rounded-lg overflow-hidden shadow">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${SAMPLE_VIDEOS[`${formData.nhGender}_演歌`]}`}
                      title="サンプル曲（演歌）"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Q3. 曲の雰囲気 */}
          <div className="bg-amber-50 p-5 rounded-lg border border-amber-100">
            <label className="block font-bold text-gray-800 mb-2">
              🎼 Q3. 曲の雰囲気は？ <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-gray-500 mb-2">どんな音楽で祝福しますか？（各ジャンルのサンプルを試聴できます）</p>
            <div className="space-y-2">
              {NH_GENRES.map((g) => (
                <label key={g.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nhGenre"
                    value={g.value}
                    onChange={(e) => { handleChange(e); setShowQ3SampleMale(false); setShowQ3SampleFemale(false); }}
                    required
                    className="form-radio text-amber-500"
                  />
                  <span>{g.label}</span>
                </label>
              ))}
            </div>
            {formData.nhGenre && (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => { setShowQ3SampleMale(!showQ3SampleMale); setShowQ3SampleFemale(false); }}
                  className="text-sm text-amber-700 underline hover:text-amber-900 transition block"
                >
                  {showQ3SampleMale ? '▲ サンプルを閉じる' : `▶ サンプル曲を聴く（${formData.nhGenre}・男性）`}
                </button>
                {showQ3SampleMale && (
                  <div className="mt-2 aspect-video rounded-lg overflow-hidden shadow">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${SAMPLE_VIDEOS[`男性_${formData.nhGenre}`]}`}
                      title={`サンプル曲（${formData.nhGenre}・男性）`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setShowQ3SampleFemale(!showQ3SampleFemale); setShowQ3SampleMale(false); }}
                  className="text-sm text-amber-700 underline hover:text-amber-900 transition block"
                >
                  {showQ3SampleFemale ? '▲ サンプルを閉じる' : `▶ サンプル曲を聴く（${formData.nhGenre}・女性）`}
                </button>
                {showQ3SampleFemale && (
                  <div className="mt-2 aspect-video rounded-lg overflow-hidden shadow">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${SAMPLE_VIDEOS[`女性_${formData.nhGenre}`]}`}
                      title={`サンプル曲（${formData.nhGenre}・女性）`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Q4. 生まれた季節 */}
          <div className="bg-amber-50 p-5 rounded-lg border border-amber-100">
            <label className="block font-bold text-gray-800 mb-2">
              🗓️ Q4. この方の生まれた季節は？ <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {NH_SEASONS.map((s) => (
                <label key={s.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nhSeason"
                    value={s.value}
                    onChange={handleChange}
                    required
                    className="form-radio text-amber-500"
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Q5. よく話される思い出 */}
          <div className="bg-amber-50 p-5 rounded-lg border border-amber-100">
            <label className="block font-bold text-gray-800 mb-2">
              💭 Q5. この方がよく話される思い出は？ <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {NH_MEMORIES.map((m) => (
                <label key={m.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nhMemory"
                    value={m.value}
                    onChange={handleChange}
                    required
                    className="form-radio text-amber-500"
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Q6. 人柄 */}
          <div className="bg-amber-50 p-5 rounded-lg border border-amber-100">
            <label className="block font-bold text-gray-800 mb-2">
              ✨ Q6. この方の人柄で当てはまるものは？ <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {NH_PERSONALITIES.map((p) => (
                <label key={p.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nhPersonality"
                    value={p.value}
                    onChange={handleChange}
                    required
                    className="form-radio text-amber-500"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-lg font-bold text-white text-xl shadow hover:opacity-90 transition bg-amber-500"
          >
            {loading ? '送信中...' : 'この内容で作詞する'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrderPage;
