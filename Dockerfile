FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 CONFIG_DIR=/data
RUN apk add --no-cache ffmpeg
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js /app/package.json ./
COPY --from=build /app/src/server ./src/server
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
CMD ["node", "server.js"]
