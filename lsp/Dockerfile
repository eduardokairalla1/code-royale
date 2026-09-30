# --- service build stage ---
FROM golang:1.27-bookworm AS build

WORKDIR /src

# download the modules first, so code changes reuse the layer
COPY go.mod go.sum ./
RUN go mod download

# the release it belongs to, stamped on every log line
ARG VERSION=dev
ARG COMMIT=unknown

# static binary, no cgo
COPY . .
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags="-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
      -o /out/lsp .

# gopls, built with the same toolchain the image ships for it
RUN GOBIN=/out go install golang.org/x/tools/gopls@v0.23.0

# --- runtime stage ---
FROM node:24.18.0-slim

ENV DEBIAN_FRONTEND=noninteractive

# c/c++ (clangd + libstdc++ headers), and what rustup needs
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl g++ clangd \
 && rm -rf /var/lib/apt/lists/*


# python and javascript/typescript: servers published on npm
WORKDIR /opt/lsp
RUN npm init -y > /dev/null \
 && npm install --omit=dev --no-fund --no-audit \
      pyright@1.1.414 \
      typescript@6.0.3 \
      typescript-language-server@6.0.1 \
      @types/node@26.6.2 \
 && npm cache clean --force

# go: the toolchain gopls runs, and gopls itself
COPY --from=build /usr/local/go /usr/local/go
COPY --from=build /out/gopls /usr/local/bin/gopls

# rust: the standard library sources and rust-analyzer
ENV RUSTUP_HOME=/opt/rustup
RUN curl -sSf https://sh.rustup.rs \
      | CARGO_HOME=/opt/cargo sh -s -- -y --no-modify-path \
          --profile minimal --component rust-src,rust-analyzer \
 && chmod -R a+rX /opt/rustup /opt/cargo

# java: a jdk and jdtls
COPY --from=eclipse-temurin:21-jdk /opt/java/openjdk /opt/java
ENV JAVA_HOME=/opt/java \
    JDTLS_HOME=/opt/jdtls
RUN mkdir -p "$JDTLS_HOME" \
 && curl -sSfL https://download.eclipse.org/jdtls/milestones/1.61.0/jdt-language-server-1.61.0-202609031315.tar.gz \
      | tar -xz -C "$JDTLS_HOME"
COPY scripts/jdtls-session /usr/local/bin/jdtls-session

# the service
COPY --from=build /out/lsp /usr/local/bin/lsp

ENV PATH=/opt/lsp/node_modules/.bin:/opt/cargo/bin:/usr/local/go/bin:/opt/java/bin:$PATH \
    NODE_TYPES_DIR=/opt/lsp/node_modules/@types \
    WORKSPACES_DIR=/tmp/workspaces

# root only to start sessions as their own users; see README.md
USER root

EXPOSE 3001

CMD ["lsp"]
