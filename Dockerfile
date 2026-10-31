# Runtime image for ollama-gateway.
# The server binds all interfaces inside the container; publish the port on the
# host loopback only (see docs/docker.md).
FROM node:22-alpine

WORKDIR /app

COPY package.json anthropic-proxy.js panel.html panel.js proxy-config.example.json ./
COPY README.md CHANGELOG.md LEGAL.md SECURITY.md NOTICE ./

RUN mkdir -p /data && chown -R node:node /data /app

USER node
ENV PROXY_CFG=/data/config.json \
    PROXY_DATA_DIR=/data \
    NODE_ENV=production

EXPOSE 8799

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PROXY_PORT || 8799) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["node", "anthropic-proxy.js", "--bind", "0.0.0.0"]
