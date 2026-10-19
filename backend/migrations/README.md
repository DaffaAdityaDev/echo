# Legacy migrations (not executed)

Nothing in the backend, Dockerfile, compose files or Kubernetes manifests runs
these SQL files. The live schema is `internal/database/schema.go`
(`database.Migrate`), which runs on server start and via `cmd/db/migrate`.

Do not add new files here; put DDL changes in `schema.go`.

`20260813_001_add_session_and_memory_indexes` has no counterpart in
`schema.go`, so its indexes (`idx_sessions_status_updated_at`,
`idx_sessions_status_last_accessed`, `idx_memory_semantic_content_trgm`) exist
only on databases where it was applied by hand.
