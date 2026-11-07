# Web (React) + API (Go) en un solo servicio: el binario Go sirve la web en / y la API en /api.
FROM node:22-alpine AS web
WORKDIR /web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
ENV VITE_API_URL=/api VITE_REPARTIDOR_URL=/app/
RUN npm run build

# Panel del repartidor: la app Expo exportada para web, servida en /app
FROM node:22-alpine AS app
WORKDIR /mobile
COPY apps/mobile/package*.json ./
RUN npm ci
COPY apps/mobile/ ./
ENV EXPO_BASE_URL=/app EXPO_PUBLIC_API_URL=/api CI=1
RUN npx expo export -p web --output-dir dist-web

FROM golang:1.27-alpine AS api
WORKDIR /src
COPY services/api/go.mod services/api/go.sum ./
RUN go mod download
COPY services/api/ ./
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=api /out/api /app/api
COPY --from=api /src/migrations /app/migrations
COPY --from=web /web/dist /app/web
COPY --from=app /mobile/dist-web /app/repartidor
# Las migraciones se aplican solas al arrancar (deploy en Railway sin pasos manuales).
ENV WEB_DIR=/app/web APP_DIR=/app/repartidor PORT=8080     MIGRATIONS_DIR=/app/migrations MIGRATE_ON_START=true ENV=production
EXPOSE 8080
CMD ["/app/api"]
