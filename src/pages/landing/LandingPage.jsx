import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => (
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

export default LandingPage;
