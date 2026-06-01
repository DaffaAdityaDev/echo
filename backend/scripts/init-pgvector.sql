-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tool_catalog table
CREATE TABLE IF NOT EXISTS tool_catalog (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  schema      JSONB,
  embedding   vector(384)  -- 384 dimensions matching all-MiniLM-L6-v2
);

-- Create HNSW index for sub-10ms JIT tool recoveries
CREATE INDEX IF NOT EXISTS tool_catalog_hnsw_idx 
ON tool_catalog USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
