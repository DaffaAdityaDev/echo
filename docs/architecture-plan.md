# Echo Backend Architecture Implementation Plan

## Overview

Build a modular monolith Go backend service and a separate Node.js agent service, designed to scale from 100 users initially while keeping architecture scalable.

## Architecture Decisions

### Tech Stack

- **Go Backend**: Fiber framework, PostgreSQL with pgvector extension, modular monolith pattern
- **Node.js Agent**: LangGraph for mission generation, Chroma DB for RAG, gRPC client
- **Communication**: REST (frontend↔Go), gRPC (Go↔Node.js agent)
- **Database**: PostgreSQL (Go), Chroma DB (Node.js agent)
- **Auth**: JWT (access + refresh tokens)
- **LLM**: Local Qwen3 4B model
- **Deployment**: Docker Compose for development

### Data Modeling

- **DAG Storage**: Hybrid approach - normalized tables (`skill_nodes`, `skill_edges`) + JSONB cache in `goals.skill_tree`
- **RAG**: Chroma DB in Node.js agent for semantic search of content/topics

## Implementation Structure

### 1. Project Structure

```
backend/
├── cmd/
│   ├── server/          # Go main application
│   └── migrate/         # Migration CLI (future)
├── internal/
│   ├── config/          # Configuration management
│   ├── database/        # PostgreSQL connection (pgx pool) & migrations
│   ├── models/          # Plain structs (no ORM tags)
│   ├── repositories/    # Data access layer with native SQL queries
│   ├── services/        # Business logic
│   ├── handlers/        # HTTP handlers (Fiber)
│   ├── middleware/      # Auth, CORS, etc.
│   ├── grpc/            # gRPC client for Node.js agent
│   └── llm/             # Local LLM integration (Qwen3 4B)
├── migrations/          # SQL migration files
├── proto/               # gRPC proto definitions
├── docker/              # Dockerfiles
├── docker-compose.yml
├── .env.example
└── go.mod

agent/
├── src/
│   ├── index.ts         # Main entry
│   ├── langgraph/       # LangGraph mission generator
│   ├── services/
│   │   ├── chroma.ts    # Chroma DB client
│   │   ├── llm.ts       # Qwen3 4B integration
│   │   └── grpc.ts      # gRPC server
│   └── tools/            # MCP-style tool registry
├── docker/
├── package.json
└── tsconfig.json
```

### 2. Go Backend Implementation

#### Core Modules

- **Config**: Environment variable loading, validation
- **Database**: PostgreSQL connection with pgvector, **pgx/v5 pool** (NO ORM - native SQL queries only), migration support
- **Models**: User, Goal, Card, Topic, SkillNode, SkillEdge (plain structs - no ORM tags, just Go structs)
- **Repositories**: Data access layer using **raw SQL queries** with pgx (UserRepo, GoalRepo, CardRepo, TopicRepo) - all queries written manually for learning and performance
- **Services**: Business logic (AuthService, GoalService, CardService, EvaluationService)
- **Handlers**: REST endpoints (auth, goals, cards, answers, topics)
- **Middleware**: JWT validation, CORS, error handling
- **gRPC Client**: Client for calling Node.js agent service

#### Key Endpoints (MVP)

- `POST /api/v1/register` - User registration
- `POST /api/v1/login` - User login (returns JWT)
- `POST /api/v1/refresh` - Refresh access token
- `POST /api/v1/goal` - Create goal, auto-generate skill DAG
- `GET /api/v1/goal/:id` - Get goal with skill tree
- `POST /api/v1/topic` - Create topic
- `POST /api/v1/topic/import` - Bulk import (CSV/Markdown)
- `GET /api/v1/cards/today` - Get today's cards (spaced repetition)
- `POST /api/v1/answer` - Submit answer, get LLM evaluation
- `POST /api/v1/mission/generate` - Request mission generation
- `GET /api/v1/mission` - Get user's missions

#### Database Schema

- **users**: id, email, password_hash, name, role, created_at, updated_at
- **goals**: id, user_id, title, description, target_date, skill_tree (JSONB), created_at
- **skill_nodes**: id, goal_id, name, difficulty, estimated_hours, created_at
- **skill_edges**: id, parent_node_id, child_node_id, prerequisite_type
- **topics**: id, user_id, name, tag, difficulty, estimated_hours, content_path, created_at
- **cards**: id, user_id, topic_id, question, answer, ef, interval, due, repetitions, last_score, priority, created_at
- **missions**: id, user_id, skill_id, prompt, type (code/read/build), status, created_at
- **answers**: id, card_id, user_id, text, score, feedback, created_at

Enable pgvector extension for future embedding storage.

### 3. Node.js Agent Service

#### Core Components

- **LangGraph Workflow**: Mission generation graph with nodes:

  1. `fetchUserContext` - Get user cards, weak topics from Go API
  2. `fetchMarketTrends` - Hit Indeed API (optional, can mock for MVP)
  3. `weighWeakness` - Calculate weak topics (avg score < 70%)
  4. `pruneSkills` - Select top-3 skills
  5. `generatePrompt` - Use LLM to create mission prompt
  6. `storeMission` - Send back to Go API via gRPC

- **Chroma DB**: Store topic/content embeddings for RAG retrieval
- **gRPC Server**: Expose `GenerateMission(user_id)` endpoint
- **Tool Registry**: MCP-style tools (search_jobs, fetch_docs, create_template, notify_user, log_event)
- **LLM Integration**: Local Qwen3 4B model via API or local inference

#### Mission Generation Flow

1. User requests mission OR completes card → triggers Go service
2. Go service calls Node.js agent via gRPC: `GenerateMission(user_id)`
3. Agent fetches user context from Go API (REST)
4. Agent queries Chroma for relevant content (RAG)
5. Agent uses Qwen3 4B to generate mission prompt
6. Agent returns mission via gRPC
7. Go service stores mission in DB

### 4. gRPC Communication

#### Proto Definition (`proto/agent.proto`)

```protobuf
service AgentService {
  rpc GenerateMission(GenerateMissionRequest) returns (GenerateMissionResponse);
  rpc EvaluateAnswer(EvaluateAnswerRequest) returns (EvaluateAnswerResponse);
}

message GenerateMissionRequest {
  uint32 user_id = 1;
  repeated uint32 weak_topic_ids = 2;
}

message GenerateMissionResponse {
  Mission mission = 1;
  string error = 2;
}
```

- Go: gRPC client in `internal/grpc/agent_client.go`
- Node.js: gRPC server using `@grpc/grpc-js`

### 5. Local LLM Integration (Qwen3 4B)

#### Go Service (Answer Evaluation)

- HTTP client to local Qwen3 4B API endpoint
- Prompt: "Evaluate this answer: {answer}. Question: {question}. Score 0-100 (correctness 40%, depth 30%, clarity 30%)"
- Parse response, extract score and feedback

#### Node.js Agent (Mission Generation)

- Same Qwen3 4B API for generating mission prompts
- Use RAG context from Chroma to enhance prompts

### 6. JWT Authentication

- **Access Token**: 15 minutes, stored in memory/frontend
- **Refresh Token**: 7 days, httpOnly cookie or separate endpoint
- **Middleware**: Validate JWT, extract user_id, role
- **Refresh Endpoint**: `POST /api/v1/refresh` with refresh_token

### 7. Docker Setup

#### docker-compose.yml

- **postgres**: PostgreSQL 15+ with pgvector extension
- **chroma**: Chroma DB service (or local file-based for MVP)
- **go-api**: Go backend service
- **node-agent**: Node.js agent service
- **qwen-llm**: Local Qwen3 4B model service (or connect to existing)

#### Dockerfiles

- Multi-stage builds for Go (small final image)
- Node.js Alpine image for agent

### 8. Architecture Documentation

Create in `docs/` folder:

- `architecture.md` - System architecture, component diagram
- `api-design.md` - REST API specifications
- `database-schema.md` - Database schema with relationships
- `grpc-api.md` - gRPC service definitions
- `deployment.md` - Docker setup, environment variables
- `development.md` - Local development setup guide

## Implementation Order

1. **Phase 1: Foundation**

   - Go project structure, config, database connection
   - PostgreSQL setup with pgvector
   - **Database layer: pgx/v5 pool setup (NO ORM - all native SQL queries)**
   - Basic models (plain structs) and migrations
   - Docker Compose setup

2. **Phase 2: Authentication**

   - JWT implementation
   - User registration/login endpoints
   - Auth middleware

3. **Phase 3: Core Features**

   - Goal creation with DAG generation (simplified initially)
   - Topic CRUD
   - Card model and basic spaced-repetition logic

4. **Phase 4: Agent Integration**

   - Node.js agent service setup
   - gRPC proto definitions
   - Basic mission generation (without full LangGraph initially)

5. **Phase 5: LLM Integration**

   - Local Qwen3 4B setup
   - Answer evaluation endpoint
   - Mission generation with LLM

6. **Phase 6: RAG Setup**

   - Chroma DB integration in Node.js
   - Content embedding and retrieval

## MVP Simplifications

- **DAG Generation**: Start with simple rule-based skill extraction, add LLM-based later
- **Spaced Repetition**: Basic SM-2 algorithm, add personal weighting later
- **Mission Generation**: Simple prompt generation, full LangGraph workflow later
- **Market Trends**: Mock data initially, real API integration later
- **Chroma DB**: File-based for MVP, service later if needed
- **Tool Registry**: Basic implementation, full MCP-style later

## Files to Create

### Go Backend

- `backend/go.mod`
- `backend/cmd/server/main.go`
- `backend/internal/config/config.go`
- `backend/internal/database/postgres.go`
- `backend/internal/models/*.go` (User, Goal, Card, Topic, etc.)
- `backend/internal/repositories/*.go`
- `backend/internal/services/*.go`
- `backend/internal/handlers/*.go`
- `backend/internal/middleware/auth.go`
- `backend/internal/grpc/agent_client.go`
- `backend/internal/llm/qwen.go`
- `backend/migrations/*.sql`
- `backend/proto/agent.proto`
- `backend/Dockerfile`
- `backend/.env.example`

### Node.js Agent

- `agent/package.json`
- `agent/src/index.ts`
- `agent/src/langgraph/mission.ts`
- `agent/src/services/chroma.ts`
- `agent/src/services/llm.ts`
- `agent/src/services/grpc.ts`
- `agent/src/tools/registry.ts`
- `agent/Dockerfile`
- `agent/.env.example`

### Documentation

- `docs/architecture.md` - System architecture, component diagram
- `docs/api-design.md` - REST API specifications
- `docs/database-schema.md` - Database schema with relationships
- `docs/grpc-api.md` - gRPC service definitions
- `docs/deployment.md` - Docker setup, environment variables
- `docs/development.md` - Local development setup guide

### Root

- `docker-compose.yml`
- `.env.example`

## Key Technical Decisions

### Database Access

- **NO ORM**: We use **native SQL queries only** with `github.com/jackc/pgx/v5` for maximum performance and learning
- **Query Method**: All database operations use raw SQL strings with `pgx.Conn.Query()`, `Exec()`, `QueryRow()` - you write every SQL query yourself
- **Connection Pooling**: Use `pgxpool.Pool` for efficient database connections
- **Models**: Plain Go structs with no ORM tags - manual scanning from query results using `pgx.Rows.Scan()`
- **Migrations**: Use SQL migration files, run manually or via CLI tool
- **Benefits**: 
  - Maximum performance (no ORM overhead)
  - Learn SQL by writing all queries
  - Full control over query optimization
  - See exactly what SQL executes

**Note on sqlc**: `sqlc` is a code generator that reads SQL and generates type-safe Go code using pgx. We're starting with **pure pgx** (manual queries) for learning. Later, we can optionally add `sqlc` to reduce boilerplate while still writing raw SQL - it generates code that uses pgx, so performance is the same. For now, manual approach = better learning.

### Performance Considerations

- **Native SQL queries** (no ORM) for optimal performance - direct control over every query
- Connection pooling with pgx pool
- JSONB for flexible skill_tree caching
- Prepared statements for frequently used queries (using pgx prepared statements)
- Manual query optimization - you can optimize each SQL query directly

### Scalability

- Modular monolith pattern allows easy extraction to microservices later
- Stateless services for horizontal scaling
- Database connection pooling ready for load
- gRPC for efficient inter-service communication

