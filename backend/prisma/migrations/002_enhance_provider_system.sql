-- Add missing provider-related tables and columns

-- Add missing columns to existing Provider table
ALTER TABLE providers ADD COLUMN IF NOT EXISTS encrypted_credentials JSONB;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS health_status VARCHAR(20) DEFAULT 'UNKNOWN';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS circuit_breaker_status VARCHAR(20) DEFAULT 'CLOSED';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS avg_response_time FLOAT DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS success_rate FLOAT DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS total_requests INTEGER DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS total_errors INTEGER DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- Create ProviderAuthentication table
CREATE TABLE IF NOT EXISTS provider_authentications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id TEXT NOT NULL UNIQUE,
    auth_type TEXT NOT NULL DEFAULT 'api_key',
    credentials JSONB NOT NULL,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Create ProviderRoutingRule table
CREATE TABLE IF NOT EXISTS provider_routing_rules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id TEXT NOT NULL,
    condition JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    fallback BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Create ProviderUsageMetric table
CREATE TABLE IF NOT EXISTS provider_usage_metrics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id TEXT NOT NULL,
    date DATE NOT NULL,
    requests INTEGER DEFAULT 0,
    tokens INTEGER DEFAULT 0,
    cost FLOAT DEFAULT 0,
    errors INTEGER DEFAULT 0,
    avg_latency FLOAT DEFAULT 0,
    success_rate FLOAT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    UNIQUE(provider_id, date),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Create ProviderHealthCheck table
CREATE TABLE IF NOT EXISTS provider_health_checks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time FLOAT,
    error_message TEXT,
    checked_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Create ProviderFallbackChain table
CREATE TABLE IF NOT EXISTS provider_fallback_chains (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    primary_provider_id TEXT NOT NULL,
    fallback_provider_id TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    condition JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(primary_provider_id, fallback_provider_id),
    FOREIGN KEY (primary_provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    FOREIGN KEY (fallback_provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Create audit_logs table for comprehensive auditing
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id TEXT,
    success BOOLEAN NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_providers_organization_id ON providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(type);
CREATE INDEX IF NOT EXISTS idx_providers_health_status ON providers(health_status);
CREATE INDEX IF NOT EXISTS idx_providers_is_active ON providers(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_authentications_provider_id ON provider_authentications(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_authentications_expires_at ON provider_authentications(expires_at);

CREATE INDEX IF NOT EXISTS idx_provider_routing_rules_provider_id ON provider_routing_rules(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_routing_rules_priority ON provider_routing_rules(priority);

CREATE INDEX IF NOT EXISTS idx_provider_usage_metrics_provider_id ON provider_usage_metrics(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_usage_metrics_date ON provider_usage_metrics(date);

CREATE INDEX IF NOT EXISTS idx_provider_health_checks_provider_id ON provider_health_checks(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_health_checks_checked_at ON provider_health_checks(checked_at);

CREATE INDEX IF NOT EXISTS idx_provider_fallback_chains_primary ON provider_fallback_chains(primary_provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_fallback_chains_fallback ON provider_fallback_chains(fallback_provider_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_authentications_updated_at BEFORE UPDATE ON provider_authentications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_routing_rules_updated_at BEFORE UPDATE ON provider_routing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_fallback_chains_updated_at BEFORE UPDATE ON provider_fallback_chains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();