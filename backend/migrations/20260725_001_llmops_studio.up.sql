-- Migration: LLMOps User Studio Schema
-- Module: Backend / Database

BEGIN;

CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'local',
    name VARCHAR(128) NOT NULL,
    description TEXT,
    active_version INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_templates_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    version INT NOT NULL,
    system_prompt TEXT NOT NULL,
    bound_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'shadow', 'approved', 'production', 'rolled_back')),
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_versions_template_version UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS eval_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'local',
    name VARCHAR(128) NOT NULL,
    description TEXT,
    test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eval_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES eval_datasets(id) ON DELETE SET NULL,
    pass_rate INT NOT NULL DEFAULT 0,
    score_accuracy INT NOT NULL DEFAULT 0,
    score_format INT NOT NULL DEFAULT 0,
    score_tools INT NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '[]'::jsonb,
    executed_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shadow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    live_version_id UUID NOT NULL REFERENCES prompt_versions(id),
    candidate_version_id UUID NOT NULL REFERENCES prompt_versions(id),
    user_query TEXT NOT NULL,
    live_output TEXT NOT NULL,
    shadow_output TEXT NOT NULL,
    live_cost_usd NUMERIC(10, 6) DEFAULT 0.0,
    shadow_cost_usd NUMERIC(10, 6) DEFAULT 0.0,
    live_latency_ms INT DEFAULT 0,
    shadow_latency_ms INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'local',
    actor VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_template ON prompt_versions(template_id, version);
CREATE INDEX IF NOT EXISTS idx_eval_runs_version ON eval_runs(prompt_version_id);
CREATE INDEX IF NOT EXISTS idx_eval_runs_dataset ON eval_runs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_shadow_runs_template ON shadow_runs(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_runs_live_ver ON shadow_runs(live_version_id);
CREATE INDEX IF NOT EXISTS idx_shadow_runs_cand_ver ON shadow_runs(candidate_version_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_actor ON audit_logs(tenant_id, actor, created_at DESC);

COMMIT;
