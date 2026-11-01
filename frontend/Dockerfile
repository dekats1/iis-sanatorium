# Сборка статики и раздача через nginx. Образы не собирались в среде разработки записки (Docker там недоступен) —
# сама сборка (npm run build) проверена. Проверить локально: docker compose build frontend.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
