# KataraGnosis Environment Contract

> Comprehensive environment variable specifications for Katara Backend and Frontend.

---

## 1. Katara Backend (`app/KataraGnosis/backend/.env`)

| Variable                        | Type     | Default                                                                 | Required | Description                                   |
| ------------------------------- | -------- | ----------------------------------------------------------------------- | -------- | --------------------------------------------- |
| `PORT`                          | `int`    | `8090`                                                                  | Yes      | HTTP listening port for Fiber v3              |
| `DATABASE_URL`                  | `string` | `postgres://postgres:postgres@localhost:5432/katara_db?sslmode=disable` | Yes      | PostgreSQL connection string for `katara_db`  |
| `JWT_SECRET`                    | `string` | `change-me-in-production-katara-secret`                                 | Yes      | Secret key for signing user JWT tokens        |
| `REDIS_URL`                     | `string` | `redis://localhost:6379/1`                                              | Yes      | Redis connection string for Asynq task queue  |
| `QDRANT_URL`                    | `string` | `http://localhost:6333`                                                 | Yes      | Qdrant vector database endpoint               |
| `QDRANT_API_KEY`                | `string` | `""`                                                                    | No       | Optional API key for Qdrant Cloud             |
| `GARAGE_ENDPOINT`               | `string` | `http://localhost:3900`                                                 | Yes      | S3-compatible GarageHQ endpoint               |
| `GARAGE_REGION`                 | `string` | `garage`                                                                | Yes      | S3 region                                     |
| `GARAGE_ACCESS_KEY`             | `string` | `garage-access-key`                                                     | Yes      | S3 Access Key ID                              |
| `GARAGE_SECRET_KEY`             | `string` | `garage-secret-key`                                                     | Yes      | S3 Secret Access Key                          |
| `GARAGE_BUCKET`                 | `string` | `inquizitive-docs`                                                      | Yes      | S3 bucket name for documents                  |
| `EMBEDDING_PROVIDER`            | `string` | `gemini`                                                                | Yes      | Vector provider: `gemini`, `openai`, `ollama` |
| `GEMINI_API_KEY`                | `string` | `""`                                                                    | Optional | API key if using Gemini provider              |
| `OPENAI_API_KEY`                | `string` | `""`                                                                    | Optional | API key if using OpenAI provider              |
| `KATARA_SESSION_SIZE`           | `int`    | `10`                                                                    | No       | Default question count per drill              |
| `KATARA_TARGET_DAILY_QUESTIONS` | `int`    | `6`                                                                     | No       | Minimum daily target questions                |
| `KATARA_TARGET_SCORE_THRESHOLD` | `float`  | `60.0`                                                                  | No       | Minimum daily score percentage                |
| `KATARA_GRACE_DAYS_PER_WEEK`    | `int`    | `1`                                                                     | No       | Permitted missed days per rolling week        |

---

## 2. Katara Frontend (`app/KataraGnosis/frontend/.env.local`)

| Variable      | Type     | Default                 | Required | Description                            |
| ------------- | -------- | ----------------------- | -------- | -------------------------------------- |
| `PORT`        | `int`    | `3002`                  | Yes      | Next.js server port                    |
| `BACKEND_URL` | `string` | `http://localhost:8090` | Yes      | Katara Go backend URL forwarded by BFF |
