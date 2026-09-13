# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps

WORKDIR /app

# Only copy lockfiles first so this layer is cached unless deps change
COPY package.json package-lock.json ./

RUN npm ci --omit=dev --no-audit --no-fund

# ---- Stage 2: Final runtime image ----
FROM node:20-alpine AS runner

# dumb-init handles signals properly (clean shutdown, no zombie processes)
RUN apk add --no-cache dumb-init

# Run as non-root for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

WORKDIR /app

ENV NODE_ENV=production

# Copy only production node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy app source (respects .dockerignore)
COPY --chown=nodeuser:nodejs . .

USER nodeuser

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
