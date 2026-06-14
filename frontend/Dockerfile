# Runtime image for the mezo frontend: nginx serving the static Vite build.
#
# The static bundle is built natively first (env baked in at build time):
#   VITE_USE_MOCK=false VITE_API_URL= \
#   VITE_OWNER_EMAIL=owner@mezo.local VITE_OWNER_PASSWORD=owner pnpm build
# then this image just serves dist/ on an amd64 nginx (matching the x86 node):
#   docker buildx build --platform linux/amd64 \
#     -t ghcr.io/mrkuhne/mezo-frontend:<tag> frontend --push
#
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
EXPOSE 80
