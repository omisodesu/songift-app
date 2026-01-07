# Node.js 20 + ffmpeg
FROM node:20-slim

# ffmpegと日本語フォントのインストール
RUN apt-get update && \
    apt-get install -y ffmpeg fonts-noto-cjk && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 作業ディレクトリ
WORKDIR /app

# 依存関係をコピーしてインストール
COPY package*.json ./
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# ポート8080で起動
ENV PORT=8080
EXPOSE 8080

# アプリケーション起動
CMD ["node", "index.js"]
