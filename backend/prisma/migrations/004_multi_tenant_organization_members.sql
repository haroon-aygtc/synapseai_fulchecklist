-- Migration: Multi-tenant Organization Members System
-- This migration transforms the direct user-organization relationship into a many-to-many relationship

-- Step 1: Create organization_members table
CREATE TABLE organization_members (
    id VARCHAR(255) PRIMARY KEY,
    organization_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_id)
);

-- Step 2: Migrate existing user-organization relationships
INSERT INTO organization_members (id, organization_id, user_id, role, is_active, joined_at, updated_at)
SELECT 
    CONCAT('mem_', SUBSTR(MD5(RANDOM()::text), 1, 25)) as id,
    organization_id,
    id as user_id,
    role,
    is_active,
    created_at as joined_at,
    updated_at
FROM users
WHERE organization_id IS NOT NULL;

-- Step 3: Add organization_id to audit_logs for better tracking
ALTER TABLE audit_logs ADD COLUMN organization_id VARCHAR(255);

-- Step 4: Update audit_logs with organization context from existing user relationships
UPDATE audit_logs 
SET organization_id = users.organization_id
FROM users 
WHERE audit_logs.user_id = users.id;

-- Step 5: Remove the direct organization relationship from users table
-- Note: We'll keep this for now to maintain backward compatibility during transition
-- ALTER TABLE users DROP CONSTRAINT users_organization_id_fkey;
-- ALTER TABLE users DROP COLUMN organization_id;
-- ALTER TABLE users DROP COLUMN role;

-- Step 6: Create indexes for performance
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_active ON organization_members(is_active);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);

-- Step 7: Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 8: Create trigger for organization_members updated_at
CREATE TRIGGER update_organization_members_updated_at 
    BEFORE UPDATE ON organization_members 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();