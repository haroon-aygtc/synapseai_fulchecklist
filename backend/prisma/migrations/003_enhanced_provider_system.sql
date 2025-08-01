-- Enhanced Provider System Migration
-- A/B Testing, Custom Routing Rules, and Real-time Monitoring

-- Create A/B Testing tables
CREATE TABLE IF NOT EXISTS ab_tests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    provider_ids TEXT[] DEFAULT '{}',
    traffic_split FLOAT DEFAULT 50.0,
    split_type TEXT DEFAULT 'REQUESTS' CHECK (split_type IN ('REQUESTS', 'USERS', 'TIME')),
    conditions JSONB DEFAULT '{}',
    metrics TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    duration INTEGER,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ab_test_variants (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    test_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    traffic_percentage FLOAT NOT NULL,
    is_control BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(test_id, provider_id),
    FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ab_test_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    test_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    date DATE NOT NULL,
    requests INTEGER DEFAULT 0,
    successes INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    total_latency FLOAT DEFAULT 0,
    total_cost FLOAT DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    UNIQUE(test_id, provider_id, date),
    FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE
);

-- Create Custom Routing Rules tables
CREATE TABLE IF NOT EXISTS custom_routing_rules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    conditions JSONB DEFAULT '{}',
    actions JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    match_count INTEGER DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    avg_execution_time FLOAT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routing_rule_executions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    rule_id TEXT NOT NULL,
    request_id TEXT,
    matched BOOLEAN DEFAULT false,
    executed BOOLEAN DEFAULT false,
    success BOOLEAN DEFAULT false,
    execution_time FLOAT DEFAULT 0,
    selected_provider TEXT,
    request_context JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    error TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (rule_id) REFERENCES custom_routing_rules(id) ON DELETE CASCADE
);

-- Create Real-time Monitoring tables
CREATE TABLE IF NOT EXISTS provider_monitoring_alerts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('WARNING', 'ERROR', 'CRITICAL')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP,
    auto_resolve BOOLEAN DEFAULT false,
    auto_resolve_after INTEGER,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS real_time_metrics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    active_requests INTEGER DEFAULT 0,
    requests_per_minute INTEGER DEFAULT 0,
    avg_response_time FLOAT DEFAULT 0,
    error_rate FLOAT DEFAULT 0,
    success_rate FLOAT DEFAULT 0,
    queue_length INTEGER DEFAULT 0,
    circuit_breaker_status TEXT DEFAULT 'CLOSED',
    rate_limit_remaining INTEGER DEFAULT 0,
    cost_per_minute FLOAT DEFAULT 0,
    tokens_per_minute INTEGER DEFAULT 0,
    cpu_usage FLOAT,
    memory_usage FLOAT,
    disk_usage FLOAT,
    network_latency FLOAT,
    UNIQUE(provider_id, timestamp),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Create Enhanced Analytics tables
CREATE TABLE IF NOT EXISTS provider_usage_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id TEXT,
    organization_id TEXT NOT NULL,
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost FLOAT DEFAULT 0,
    avg_latency FLOAT DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    model TEXT,
    user_tier TEXT,
    metadata JSONB DEFAULT '{}',
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provider_model_usage (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL,
    date DATE NOT NULL,
    requests INTEGER DEFAULT 0,
    tokens INTEGER DEFAULT 0,
    cost FLOAT DEFAULT 0,
    errors INTEGER DEFAULT 0,
    avg_latency FLOAT DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    UNIQUE(provider_id, model, date),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routing_decisions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    request_id TEXT UNIQUE NOT NULL,
    organization_id TEXT NOT NULL,
    selected_provider TEXT NOT NULL,
    strategy TEXT NOT NULL,
    decision_time FLOAT DEFAULT 0,
    fallback_used BOOLEAN DEFAULT false,
    ab_test_id TEXT,
    custom_rule_id TEXT,
    request_context JSONB DEFAULT '{}',
    provider_scores JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ab_tests_organization_id ON ab_tests(organization_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_is_active ON ab_tests(is_active);

CREATE INDEX IF NOT EXISTS idx_ab_test_variants_test_id ON ab_test_variants(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_variants_provider_id ON ab_test_variants(provider_id);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_id ON ab_test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_date ON ab_test_results(date);

CREATE INDEX IF NOT EXISTS idx_custom_routing_rules_organization_id ON custom_routing_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_routing_rules_is_active ON custom_routing_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_routing_rules_priority ON custom_routing_rules(priority);

CREATE INDEX IF NOT EXISTS idx_routing_rule_executions_rule_id ON routing_rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_routing_rule_executions_timestamp ON routing_rule_executions(timestamp);
CREATE INDEX IF NOT EXISTS idx_routing_rule_executions_matched ON routing_rule_executions(matched);

CREATE INDEX IF NOT EXISTS idx_provider_monitoring_alerts_provider_id ON provider_monitoring_alerts(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_monitoring_alerts_type ON provider_monitoring_alerts(type);
CREATE INDEX IF NOT EXISTS idx_provider_monitoring_alerts_acknowledged ON provider_monitoring_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_provider_monitoring_alerts_resolved ON provider_monitoring_alerts(resolved);

CREATE INDEX IF NOT EXISTS idx_real_time_metrics_provider_id ON real_time_metrics(provider_id);
CREATE INDEX IF NOT EXISTS idx_real_time_metrics_timestamp ON real_time_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_provider_usage_sessions_provider_id ON provider_usage_sessions(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_usage_sessions_organization_id ON provider_usage_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_provider_usage_sessions_start_time ON provider_usage_sessions(start_time);

CREATE INDEX IF NOT EXISTS idx_provider_model_usage_provider_id ON provider_model_usage(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_model_usage_date ON provider_model_usage(date);
CREATE INDEX IF NOT EXISTS idx_provider_model_usage_model ON provider_model_usage(model);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_organization_id ON routing_decisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_selected_provider ON routing_decisions(selected_provider);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_timestamp ON routing_decisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_ab_test_id ON routing_decisions(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_custom_rule_id ON routing_decisions(custom_rule_id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_ab_tests_updated_at BEFORE UPDATE ON ab_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_routing_rules_updated_at BEFORE UPDATE ON custom_routing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW provider_performance_summary AS
SELECT 
    p.id,
    p.name,
    p.type,
    p.is_active,
    p.health_status,
    p.avg_response_time,
    p.success_rate,
    p.total_requests,
    p.total_errors,
    COALESCE(rtm.active_requests, 0) as current_active_requests,
    COALESCE(rtm.requests_per_minute, 0) as current_requests_per_minute,
    COALESCE(rtm.error_rate, 0) as current_error_rate,
    COUNT(pma.id) FILTER (WHERE pma.resolved = false) as active_alerts
FROM providers p
LEFT JOIN LATERAL (
    SELECT * FROM real_time_metrics 
    WHERE provider_id = p.id 
    ORDER BY timestamp DESC 
    LIMIT 1
) rtm ON true
LEFT JOIN provider_monitoring_alerts pma ON pma.provider_id = p.id AND pma.resolved = false
GROUP BY p.id, p.name, p.type, p.is_active, p.health_status, p.avg_response_time, 
         p.success_rate, p.total_requests, p.total_errors, rtm.active_requests, 
         rtm.requests_per_minute, rtm.error_rate;

CREATE OR REPLACE VIEW ab_test_performance_summary AS
SELECT 
    at.id,
    at.name,
    at.status,
    at.start_date,
    at.end_date,
    COUNT(atv.id) as variant_count,
    SUM(atr.requests) as total_requests,
    AVG(atr.total_latency / NULLIF(atr.requests, 0)) as avg_latency,
    SUM(atr.total_cost) as total_cost,
    (SUM(atr.successes)::float / NULLIF(SUM(atr.requests), 0)) * 100 as success_rate
FROM ab_tests at
LEFT JOIN ab_test_variants atv ON atv.test_id = at.id
LEFT JOIN ab_test_results atr ON atr.test_id = at.id
GROUP BY at.id, at.name, at.status, at.start_date, at.end_date;

CREATE OR REPLACE VIEW routing_rule_performance_summary AS
SELECT 
    crr.id,
    crr.name,
    crr.is_active,
    crr.priority,
    crr.match_count,
    crr.execution_count,
    crr.success_count,
    crr.avg_execution_time,
    (crr.success_count::float / NULLIF(crr.execution_count, 0)) * 100 as success_rate,
    COUNT(rre.id) FILTER (WHERE rre.matched = true AND rre.timestamp > NOW() - INTERVAL '24 hours') as matches_last_24h,
    COUNT(rre.id) FILTER (WHERE rre.executed = true AND rre.timestamp > NOW() - INTERVAL '24 hours') as executions_last_24h
FROM custom_routing_rules crr
LEFT JOIN routing_rule_executions rre ON rre.rule_id = crr.id
GROUP BY crr.id, crr.name, crr.is_active, crr.priority, crr.match_count, 
         crr.execution_count, crr.success_count, crr.avg_execution_time;