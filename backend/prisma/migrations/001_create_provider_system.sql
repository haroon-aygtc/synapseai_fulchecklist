-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE', 'MISTRAL', 'GROQ', 'DEEPSEEK', 'HUGGINGFACE', 'OPENROUTER', 'OLLAMA', 'LOCALAI', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ProviderHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CircuitBreakerStatus" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "endpoint" TEXT,
    "apiKey" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "rateLimit" INTEGER,
    "costPerToken" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encryptedCredentials" JSONB,
    "lastHealthCheck" TIMESTAMP(3),
    "healthStatus" "ProviderHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "circuitBreakerStatus" "CircuitBreakerStatus" NOT NULL DEFAULT 'CLOSED',
    "avgResponseTime" DOUBLE PRECISION DEFAULT 0,
    "successRate" DOUBLE PRECISION DEFAULT 0,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_routing_rules" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "condition" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_usage_metrics" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "avgLatency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "provider_usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_health_checks" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "ProviderHealthStatus" NOT NULL,
    "responseTime" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "provider_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_fallback_chains" (
    "id" TEXT NOT NULL,
    "primaryProviderId" TEXT NOT NULL,
    "fallbackProviderId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_fallback_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_authentications" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_authentications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT,
    "action" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "providers_organizationId_idx" ON "providers"("organizationId");

-- CreateIndex
CREATE INDEX "providers_type_idx" ON "providers"("type");

-- CreateIndex
CREATE INDEX "providers_isActive_idx" ON "providers"("isActive");

-- CreateIndex
CREATE INDEX "providers_healthStatus_idx" ON "providers"("healthStatus");

-- CreateIndex
CREATE INDEX "providers_priority_idx" ON "providers"("priority");

-- CreateIndex
CREATE INDEX "provider_routing_rules_providerId_idx" ON "provider_routing_rules"("providerId");

-- CreateIndex
CREATE INDEX "provider_routing_rules_priority_idx" ON "provider_routing_rules"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "provider_usage_metrics_providerId_date_key" ON "provider_usage_metrics"("providerId", "date");

-- CreateIndex
CREATE INDEX "provider_usage_metrics_providerId_idx" ON "provider_usage_metrics"("providerId");

-- CreateIndex
CREATE INDEX "provider_usage_metrics_date_idx" ON "provider_usage_metrics"("date");

-- CreateIndex
CREATE INDEX "provider_health_checks_providerId_idx" ON "provider_health_checks"("providerId");

-- CreateIndex
CREATE INDEX "provider_health_checks_checkedAt_idx" ON "provider_health_checks"("checkedAt");

-- CreateIndex
CREATE INDEX "provider_health_checks_status_idx" ON "provider_health_checks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "provider_fallback_chains_primaryProviderId_fallbackProviderId_key" ON "provider_fallback_chains"("primaryProviderId", "fallbackProviderId");

-- CreateIndex
CREATE INDEX "provider_fallback_chains_primaryProviderId_idx" ON "provider_fallback_chains"("primaryProviderId");

-- CreateIndex
CREATE INDEX "provider_fallback_chains_priority_idx" ON "provider_fallback_chains"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "provider_authentications_providerId_key" ON "provider_authentications"("providerId");

-- CreateIndex
CREATE INDEX "audit_logs_provider_id_idx" ON "audit_logs"("provider_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_routing_rules" ADD CONSTRAINT "provider_routing_rules_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usage_metrics" ADD CONSTRAINT "provider_usage_metrics_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_health_checks" ADD CONSTRAINT "provider_health_checks_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_fallback_chains" ADD CONSTRAINT "provider_fallback_chains_primaryProviderId_fkey" FOREIGN KEY ("primaryProviderId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_authentications" ADD CONSTRAINT "provider_authentications_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;