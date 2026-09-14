# MFU Longevity Passport — production image for the PWA (frontend only).
#
# This app's backend is Supabase (hosted separately — auth, database, Edge
# Functions), not something this image runs. The `backend/` folder is an
# older, currently-unused NestJS + Postgres service the app doesn't call in
# production (see backend/docker-compose.yml — that one's for local dev of
# that service only, and is unrelated to this file). What actually needs
# deploying is the built static app, which is what this image serves.
#
# Build:
#   docker build \
#     --build-arg VITE_SUPABASE_URL=https://xxxx.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
#     --build-arg VITE_VAPID_PUBLIC_KEY=your-vapid-public-key \
#     -t mfu-longevity-passport .
#
# Run:
#   docker run -p 8080:80 mfu-longevity-passport
#
# All 3 build args are PUBLIC values by design (the Supabase anon key and
# the VAPID public key both ship inside the browser bundle already, on
# Vercel today) — Vite inlines VITE_* variables at build time, so they must
# be supplied here, not as container runtime env vars.

# ── Build stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_VAPID_PUBLIC_KEY
ARG VITE_API_URL=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY \
    VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig*.json tailwind.config.js postcss.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
