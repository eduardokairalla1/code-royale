# --- build stage ---
FROM node:24.18.0-slim AS build

WORKDIR /app

# backend origin, baked in; empty is the page's own, behind a proxy
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# lsp origin, the same way; "off" turns autocomplete off
ARG VITE_LSP_URL
ENV VITE_LSP_URL=${VITE_LSP_URL}

# install every dependency, dev ones included, to compile
COPY package.json package-lock.json ./
RUN npm ci

# typecheck and bundle into dist/
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts vitest.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- runtime stage ---
FROM nginxinc/nginx-unprivileged:1.27-alpine

# static files only: the backend lives in its own container
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
