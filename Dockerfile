FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts \
    && node -e "require('node:fs').symlinkSync('/usr/bin/ffmpeg',require('ffmpeg-static'))"
ARG YTDLP_VERSION=2026.08.19
RUN mkdir /tmp/ytdlp && cd /tmp/ytdlp \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux" -o yt-dlp_linux \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/SHA2-256SUMS" -o SHA2-256SUMS \
    && sha256sum --check --ignore-missing SHA2-256SUMS \
    && install -m 755 yt-dlp_linux /usr/local/bin/yt-dlp \
    && rm -rf /tmp/ytdlp
COPY . .
RUN mkdir -p /app/data && chown node:node /app/data \
    && node --check server.mjs && node --check public/app.js \
    && node --input-type=module -e "import sharp from 'sharp'; await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer()"
ENV NODE_ENV=production PORT=3038 LOCAL_MODE=false DATA_DIR=/app/data YTDLP_PATH=/usr/local/bin/yt-dlp
USER node
EXPOSE 3038
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/auth/me').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--use-env-proxy", "server.mjs"]
