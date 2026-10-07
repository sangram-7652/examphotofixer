# syntax=docker/dockerfile:1

# ExamPhotoFixer production image.
#
# Three stages: install deps with a locked, reproducible `npm ci`, build the static/standalone
# Next.js output, then copy only the traced runtime files into a minimal, non-root image.
# All image processing (crop/compress/validate) runs client-side in the browser; this server
# only serves prerendered HTML, static assets and security headers — see docs/DEPLOYMENT.md.

ARG NODE_VERSION=24-alpine

# ---------------------------------------------------------------------------
# Stage 1: dependencies (deterministic, lockfile-only install)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: build
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Build-time-only values baked into the static output and client bundle (see .env.example and
# docs/DEPLOYMENT.md). None are secrets; NEXT_PUBLIC_* are public by Next.js convention.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_INDEXABLE
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_ANALYTICS_DISABLED
ARG GOOGLE_SITE_VERIFICATION
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_INDEXABLE=$NEXT_PUBLIC_SITE_INDEXABLE \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
    NEXT_PUBLIC_ANALYTICS_DISABLED=$NEXT_PUBLIC_ANALYTICS_DISABLED \
    GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runtime (minimal, non-root)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Next.js "standalone" output: a minimal server.js plus only the node_modules each page traced
# as actually needed (docs: node_modules/next/dist/docs/.../output.md). public/ and .next/static
# are not included by standalone and must be copied in manually.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# server.js does not expose a /health route (see docs/DEPLOYMENT.md "no /health endpoint" —
# adding a route solely for this would add a server route for nothing); reuse the homepage.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
