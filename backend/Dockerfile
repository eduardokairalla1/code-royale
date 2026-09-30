# --- build stage ---
FROM node:24.18.0-slim AS build

WORKDIR /app

# install every dependency, dev ones included, to compile
COPY package.json package-lock.json ./
RUN npm ci

# compile typescript into dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage ---
FROM node:24.18.0-slim

ENV NODE_ENV=production

# logged on every line, to tell which build wrote it
ARG VERSION=dev
ARG COMMIT=unknown
ENV VERSION=$VERSION COMMIT=$COMMIT

WORKDIR /app

# install only what runs in production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 && npm cache clean --force

# compiled code and the challenge catalog it reads on boot
COPY --from=build /app/dist ./dist
COPY challenges ./challenges

# run as the unprivileged user that ships with the image
USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
