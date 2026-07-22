# Stage 1: Dependencies
FROM golang:1.22-alpine AS deps
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

# Stage 2: Builder
FROM deps AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o migrate ./cmd/db/migrate
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o seed ./cmd/db/seed

# Stage 3: Runner
FROM alpine:3.19 AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/server .
COPY --from=builder /app/migrate .
COPY --from=builder /app/seed .
USER appuser
EXPOSE 8080
CMD ["./server"]

