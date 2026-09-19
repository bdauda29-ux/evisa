FROM node:22-bookworm-slim

WORKDIR /app

# Hosted Railway mode uses the browser extension on the user's PC, so
# Playwright's Chromium download is unnecessary in the server image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production
ENV HOSTED_MODE=true
ENV EVISA_DATA_DIR=/data
ENV PORT=4000

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend
COPY README.md ./README.md

RUN mkdir -p /data

EXPOSE 4000
CMD ["node", "backend/server.js"]
