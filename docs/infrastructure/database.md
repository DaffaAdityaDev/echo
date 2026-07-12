================================================================================
  DATABASE — DATA STORES & INITIALIZATION
================================================================================
  Module    : Database
  Service   : Infrastructure
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Echo uses three purpose-built data stores: **PostgreSQL with pgvector** for
relational data and vector similarity search, **Redis** for caching and agent
state, and **ChromaDB** for vector embeddings. RabbitMQ is also provisioned for
async job messaging. All three databases are defined in `docker-compose.yml`
(Docker) and have equivalent Kubernetes manifests (RabbitMQ is Docker-only;
no K8s manifest exists yet).

## File Structure

+-----------------------------+-----------------------------------------------------------+
| File                        | Purpose                                                   |
+-----------------------------+-----------------------------------------------------------+
| backend/scripts/init-       | vector extension + tool_catalog table + HNSW index        |
|   pgvector.sql              |                                                           |
| backend/scripts/init-       | pgcrypto, pg_cron, NUQ queue schema + maintenance crons   |
|   nuq.sql                   |                                                           |
| infra/k8s/postgres.yaml     | ConfigMap (init SQL), PVC, Deployment, Service            |
| infra/k8s/redis.yaml        | Deployment, Service                                       |
| infra/k8s/chroma.yaml       | PVC, Deployment, Service                                  |
+-----------------------------+-----------------------------------------------------------+

## ASCII Flow Diagram — Data Architecture

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                             APPLICATION LAYER                                          │
│                                                                                       │
│   ┌──────────────────────────┐            ┌────────────────────────────────┐         │
│   │   Backend (Go)           │            │   Agent (Bun)                  │         │
│   │                          │            │                                │         │
│   │   ┌─ App data ───────────┤            │   ┌─ LLM calls ────────────────┤         │
│   │   │ tool_catalog         │            │   │ state management           │         │
│   │   │ NUQ job queues       │            │   │ embedding queries          │         │
│   │   │ user/session         │            │   └────────────────────────────┘         │
│   │   └──────────────────────┤            │                                │         │
│   └───────────┬──────────────┘            └─────────────┬──────────────────┘         │
│               │                                         │                             │
└───────────────┼─────────────────────────────────────────┼─────────────────────────────┘
                │                                         │
         ┌──────┴──────┐                          ┌───────┴────────┐
         │  PostgreSQL  │                          │     Redis      │
         │    :5432     │                          │    :6379       │
         │  pgvector    │                          │                │
          │  pg_cron     │                          │  Features cache│
          │  pgcrypto    │                          │  Skills cache  │
          │              │                          │  Episodic mem  │
          │  Tables:     │                          │  (24h TTL)     │
          │  tool_catalog│                          │  Pub/Sub       │
          │  nuq.*       │                          │  (SaaS mode)   │
          │  group_crawl │                          └────────────────┘
         └──────┬───────┘
                │
         ┌──────┴───────┐
         │   ChromaDB   │
         │    :8000      │
         │              │
         │  Collections:│
         │  tool_       │
         │  embeddings  │
         │  document_   │
         │  chunks      │
         └──────────────┘

         ┌─────────────────┐
         │    RabbitMQ     │
         │    :5672        │
         │                 │
         │  Queues:        │
         │  nuq.*          │
         └─────────────────┘

## Entry Points & Connection URLs

### PostgreSQL (pgvector)

+------------------+------------------------------------------------------------+
| Property         | Value                                                      |
+------------------+------------------------------------------------------------+
| Image            | ankane/pgvector:latest                                     |
| Internal Host    | postgres (Docker) / echo-postgres (K8s)                    |
| Port             | 5432                                                       |
| User             | user                                                       |
| Password         | password                                                   |
| Database         | echo_db                                                    |
| Prod DATABASE_URL| postgresql://user:password@postgres:5432/echo_db?          |
|                  |   sslmode=disable                                          |
| Dev env vars     | DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME            |
+------------------+------------------------------------------------------------+

### Redis

+------------------+------------------------------------------------------------+
| Property         | Value                                                      |
+------------------+------------------------------------------------------------+
| Image            | redis:7-alpine                                             |
| Internal Host    | redis (Docker) / echo-redis (K8s)                          |
| Port             | 6379                                                       |
| Connection       | redis://redis:6379                                         |
| Usage            | Features/skills cache (10m TTL), episodic memory (24h      |
|                  |   TTL), Pub/Sub streaming (SaaS mode)                      |
+------------------+------------------------------------------------------------+

### ChromaDB

+------------------+------------------------------------------------------------+
| Property         | Value                                                      |
+------------------+------------------------------------------------------------+
| Image            | chromadb/chroma:latest                                     |
| Internal Host    | chroma (Docker) / echo-chroma (K8s)                        |
| Port             | 8000                                                       |
| Usage            | Vector embedding storage for tool retrieval, document      |
|                  |   chunk similarity                                         |
| Data Volume      | /chroma/chroma (1Gi PVC in K8s, named volume in Docker)    |
+------------------+------------------------------------------------------------+

### RabbitMQ

+------------------+------------------------------------------------------------+
| Property         | Value                                                      |
+------------------+------------------------------------------------------------+
| Image            | rabbitmq:3-alpine                                          |
| Internal Host    | rabbitmq (Docker)                                          |
| Port             | 5672                                                       |
| Usage            | Async job messaging, listenable NUQ channels               |
+------------------+------------------------------------------------------------+

## Initialization Scripts

### `init-pgvector.sql`

Enables the `vector` extension and creates the `tool_catalog` table with an
HNSW index for sub-10ms similarity search:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tool_catalog (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  schema      JSONB,
  embedding   vector(384)     -- matching all-MiniLM-L6-v2
);

CREATE INDEX IF NOT EXISTS tool_catalog_hnsw_idx
ON tool_catalog USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### `init-nuq.sql`

Comprehensive initialization covering:

+----------------------+--------------------------------------------------------------+
| Component            | Details                                                      |
+----------------------+--------------------------------------------------------------+
| Extensions           | pgcrypto (UUID gen), pg_cron (scheduled maintenance)         |
| Postgres tuning      | Checkpoint settings, background writer tuning, WAL/I/O       |
|                      |   concurrency for SSD/cloud storage                          |
| Schema               | nuq schema                                                   |
| Types                | nuq.job_status (queued, active, completed, failed),          |
|                      |   nuq.group_status (active, completed, cancelled)            |
| Tables               | nuq.queue_scrape, nuq.queue_scrape_backlog,                  |
|                      |   nuq.queue_crawl_finished, nuq.group_crawl                  |
| Partial indexes      | Predicate-matching indexes for queue lookup, group cleanup,  |
|                      |   backlog queries                                            |
| pg_cron jobs         | Cleanup (completed/failed jobs every 5 min), lock reaper     |
|                      |   (15s), group finish detection (15s), group crawl clean     |
|                      |   (every 1 min), REINDEX CONCURRENTLY (spread across low-    |
|                      |   traffic window 02:00-10:00 UTC), maintenance watchdog      |
|                      |   (1 min)                                                    |
| Watchdog             | Cancels any NUQ REINDEX CONCURRENTLY stuck longer than       |
|                      |   18 minutes                                                 |
+----------------------+--------------------------------------------------------------+

Key cron schedules:

+----------------------------------+------------------+-------------------------------------------+
| Cron Name                        | Interval         | Action                                    |
+----------------------------------+------------------+-------------------------------------------+
| nuq_queue_scrape_clean_completed | Every 5 min      | DELETE completed jobs > 1h old            |
| nuq_queue_scrape_clean_failed    | Every 5 min      | DELETE failed jobs > 6h old               |
| nuq_queue_scrape_lock_reaper     | Every 15s        | Recover stuck active jobs (max 9 stalls   |
|                                  |                  |   -> fail)                                |
| nuq_group_crawl_finished         | Every 15s        | Detect completed group crawls -> enqueue  |
|                                  |                  |   crawl_finished                          |
| nuq_group_crawl_clean            | Every 1 min      | Batched DELETE of expired groups +        |
|                                  |                  |   cascade (500/batch, 90s timeout)        |
| nuq_maintenance_watchdog         | Every 1 min      | Cancel stuck REINDEX CONCURRENTLY         |
|                                  |                  |   (>18 min)                               |
| cron_job_run_details_prune       | Every 1h         | Prune cron job run history > 24h          |
| REINDEX series (14 indices)      | 02:00-10:00 UTC  | Spread CONCURRENTLY reindex across 8-hour |
|                                  |                  |   window                                  |
+----------------------------------+------------------+-------------------------------------------+

## Backup Strategy

Currently no automated backup strategy is configured. Recommended additions:

+-----------+------------------------------+----------------------------+
| Store     | Strategy                     | Tool                       |
+-----------+------------------------------+----------------------------+
| Postgres  | Periodic pg_dump + WAL       | pg_dump, barman or wal-g   |
|           |   archiving                  |                            |
| ChromaDB  | Filesystem snapshot of       | Volume snapshot or restic  |
|           |   /chroma/chroma             |                            |
| Redis     | Periodic SAVE / BGSAVE to    | Redis RDB snapshots +      |
|           |   disk                       |   volume backup            |
+-----------+------------------------------+----------------------------+

## Source References

+---------------------------------------------+-------------------------------------------+
| File                                        | Purpose                                   |
+---------------------------------------------+-------------------------------------------+
| backend/scripts/init-pgvector.sql           | Vector extension, tool_catalog table,     |
|                                             |   HNSW index                              |
| backend/scripts/init-nuq.sql                | NUQ queue schema, Postgres tuning,        |
|                                             |   pg_cron maintenance jobs                |
| docker-compose.yml:2-38                     | Postgres, ChromaDB, Redis, RabbitMQ       |
|                                             |   service definitions                     |
| infra/k8s/postgres.yaml                     | K8s ConfigMap, PVC, Deployment, Service   |
|                                             |   for Postgres                            |
| infra/k8s/chroma.yaml                       | K8s PVC, Deployment, Service for ChromaDB |
| infra/k8s/redis.yaml                        | K8s Deployment, Service for Redis         |
+---------------------------------------------+-------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
