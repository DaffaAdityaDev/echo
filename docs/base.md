Sistem yang harus ada (jangan mulai coding sampai semua ini tercover):

---

### 1. Identity & Goal System
- User register → input **global goal** (ex: “distributed systems engineer in 6 mo”)  
- Auto-pecah jadi **milestone DAG** (node = skill, edge = prereq)  
- Simpan di PostgreSQL + graph column (`ltree` / `closure table`)  
- Endpoint: `POST /goal` → return skill-tree JSON

---

### 2. Topic & Content Ingestion
- CRUD topic (tag, difficulty, estimated hours)  
- Accept **bulk import** (CSV, Notion, Markdown folder)  
- Auto-split jadi **atomic micro-skill** (< 2 jam each)  
- Store raw content di S3 / local disk; index ke Chroma untuk semantic search

---

### 3. Spaced-Repetition Engine (Go)
- Tabel `card` (question, answer, EF, interval, due, user_id, topic_id)  
- Algo: SM-2 + personal weight (error-rate, time-to-answer, market trend)  
- Daily scheduler (`SELECT * FROM card WHERE due ≤ TODAY ORDER BY priority DESC LIMIT 3`)  
- Expose gRPC: `GetTodayCards` / `UpdateCard`

---

### 4. Agent Mission Generator (Node + LangGraph)
- Input: user_id → fetch today cards + weak topics + market trend + calendar  
- Graph node:  
  1. `fetch_jobs` → hit Indeed API → trend score  
  2. `weigh_weakness` → avg score < 70 % → boost  
  3. `prune_mission` → top-3 skill  
  4. `generate_prompt` → varied question + code / read / build  
- Output: `Mission[]` → push to queue (Redis)  
- Schedule: Celery-beat 07:00 local

---

### 5. Real-Time Evaluation Service
- Endpoint: `POST /answer` (card_id, text, lang)  
- Flow:  
  - LLM judge (rubric: correctness 40 %, depth 30 %, clarity 30 %) → score 0-100  
  - Update card (new EF, interval, due)  
  - Embedding jawaban → Chroma (future similarity search)  
- Return: score + 1-sentence feedback + next micro-task

---

### 6. Tool Registry (MCP-style)
- Function-call list (OpenAI schema) → register saat start Node service:  
  - `search_jobs(keyword, location)`  
  - `fetch_docs(url)` → markdown 3-bullet  
  - `create_code_template(lang, topic)` → zip / gist url  
  - `notify_user(msg)` → Telegram bot HTTP call  
  - `log_event(user_id, event)` → ke Go API  
- Semua tool idempotent & ≤ 2 s timeout

---

### 7. Notification & Sync
- Channel: Telegram (primary), email (fallback)  
- Format: 1 mission message + 1 reminder (21:00)  
- Rate-limit: max 3 msg / hari  
- Dapat di-toggle off per channel

---

### 8. Analytics & Observability
- Prometheus metric: `mission_created`, `card_recall_rate`, `tool_latency`  
- Grafana dashboard: weak-skill heat-map, streak days, market trend overlay  
- Log aggregation: Loki / ELK → trace user-id di header

---

### 9. Security & Config
- JWT access + refresh (15 min / 7 day)  
- RBAC: user vs admin (admin bisa lihat aggregate, bukan jawaban plaintext)  
- Env variable: `DRIVER`, `LLM_KEY`, `TELE_BOT_TOKEN`, `REDIS_URL`  
- Migrations: golang-migrate (PostgreSQL) + goose (Chroma schema)

---

### 10. Deployment Artifact
- Go service: compile jadi **single binary** + `config.yaml`  
- Node agent: `node dist/index.js` (docker image `node:20-alpine`)  
- React Native UI:  
  - Mobile: ipa / apk  
  - Desktop: msix (Windows) / dmg (macOS) via RN-windows/macos  
- Docker-compose satu file untuk dev; helm chart untuk k8s prod

---

### Minimal MVP Checklist (boleh rilis closed-beta)
- [ ] Regist/login + input goal  
- [ ] Import 1 topic → auto-split micro-skill  
- [ ] Spaced-rep DB & `GetTodayCards`  
- [ ] Agent generate 1 mission pagi → Telegram  
- [ ] User jawab → dapat score → card ter-update  
- [ ] Streak counter & weak-skill badge

Kalau semua sistem di atas sudah ter-cover baru mulai coding fitur polish (gamification, social, etc).