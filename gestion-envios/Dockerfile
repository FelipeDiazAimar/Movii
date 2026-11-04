# Web (React) + API (Go) en un solo servicio: el binario Go sirve la web en / y la API en /api.
FROM node:22-alpine AS web
WORKDIR /web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
ENV VITE_API_URL=/api
RUN npm run build

FROM golang:1.25-alpine AS api
WORKDIR /src
COPY services/api/go.mod services/api/go.sum ./
RUN go mod download
COPY services/api/ ./
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=api /out/api /app/api
COPY --from=web /web/dist /app/web
ENV WEB_DIR=/app/web PORT=8080
EXPOSE 8080
CMD ["/app/api"]
