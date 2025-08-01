#!/bin/bash

# Production-Grade Authentication System Deployment Script
# This script helps deploy the enhanced multi-tenant authentication system

set -e  # Exit on any error

echo "🚀 SynapseAI Enhanced Authentication System Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required commands exist
check_dependencies() {
    print_status "Checking dependencies..."
    
    commands=("node" "npm" "psql" "redis-cli")
    for cmd in "${commands[@]}"; do
        if ! command -v $cmd &> /dev/null; then
            print_error "$cmd is required but not installed."
            exit 1
        fi
    done
    
    print_success "All dependencies are available"
}

# Check environment variables
check_environment() {
    print_status "Checking environment variables..."
    
    required_vars=("DATABASE_URL" "JWT_SECRET" "REDIS_URL")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    print_success "Environment variables are configured"
}

# Backup existing database
backup_database() {
    print_status "Creating database backup..."
    
    # Extract database name from DATABASE_URL
    DB_NAME=$(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/')
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if pg_dump $DATABASE_URL > "backups/$BACKUP_FILE"; then
        print_success "Database backup created: backups/$BACKUP_FILE"
    else
        print_error "Failed to create database backup"
        exit 1
    fi
}

# Run database migration
run_migration() {
    print_status "Running database migration..."
    
    # Create backups directory if it doesn't exist
    mkdir -p backups
    
    # Run the migration
    if psql $DATABASE_URL -f backend/prisma/migrations/004_multi_tenant_organization_members.sql; then
        print_success "Database migration completed successfully"
    else
        print_error "Database migration failed"
        print_warning "You may need to restore from backup: backups/$BACKUP_FILE"
        exit 1
    fi
}

# Generate Prisma client
generate_prisma() {
    print_status "Generating Prisma client..."
    
    cd backend
    if npx prisma generate; then
        print_success "Prisma client generated successfully"
    else
        print_error "Failed to generate Prisma client"
        exit 1
    fi
    cd ..
}

# Install dependencies
install_dependencies() {
    print_status "Installing backend dependencies..."
    
    cd backend
    if npm ci; then
        print_success "Backend dependencies installed"
    else
        print_error "Failed to install backend dependencies"
        exit 1
    fi
    cd ..
    
    print_status "Installing frontend dependencies..."
    if npm ci; then
        print_success "Frontend dependencies installed"
    else
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
}

# Build the application
build_application() {
    print_status "Building backend application..."
    
    cd backend
    if npm run build; then
        print_success "Backend build completed"
    else
        print_error "Backend build failed"
        exit 1
    fi
    cd ..
    
    print_status "Building frontend application..."
    if npm run build; then
        print_success "Frontend build completed"
    else
        print_error "Frontend build failed"
        exit 1
    fi
}

# Test the authentication system
test_auth_system() {
    print_status "Testing authentication system..."
    
    # Test database connection
    if psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Database connection failed"
        exit 1
    fi
    
    # Test Redis connection
    if redis-cli -u $REDIS_URL ping > /dev/null 2>&1; then
        print_success "Redis connection successful"
    else
        print_error "Redis connection failed"
        exit 1
    fi
    
    # Run backend tests
    print_status "Running backend tests..."
    cd backend
    if npm run test; then
        print_success "Backend tests passed"
    else
        print_warning "Some backend tests failed - review before deploying to production"
    fi
    cd ..
    
    # Run frontend tests
    print_status "Running frontend tests..."
    if npm run test; then
        print_success "Frontend tests passed"
    else
        print_warning "Some frontend tests failed - review before deploying to production"
    fi
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Check if enhanced auth module is properly configured
    if grep -q "EnhancedAuthModule" backend/src/app.module.ts; then
        print_success "Enhanced auth module is configured"
    else
        print_warning "Enhanced auth module may not be properly configured in app.module.ts"
    fi
    
    # Check if migration was applied
    if psql $DATABASE_URL -c "SELECT 1 FROM organization_members LIMIT 1;" > /dev/null 2>&1; then
        print_success "Organization members table exists"
    else
        print_error "Organization members table not found - migration may have failed"
        exit 1
    fi
    
    print_success "Deployment verification completed"
}

# Main deployment process
main() {
    echo ""
    print_status "Starting deployment process..."
    echo ""
    
    # Pre-deployment checks
    check_dependencies
    check_environment
    
    # Create backup
    backup_database
    
    # Install dependencies
    install_dependencies
    
    # Run migration
    run_migration
    
    # Generate Prisma client
    generate_prisma
    
    # Build application
    build_application
    
    # Test the system
    test_auth_system
    
    # Verify deployment
    verify_deployment
    
    echo ""
    print_success "🎉 Enhanced Authentication System Deployment Completed!"
    echo ""
    echo "Next steps:"
    echo "1. Update your app.module.ts to import EnhancedAuthModule"
    echo "2. Update your frontend to use EnhancedAuthProvider"
    echo "3. Test the system thoroughly in staging environment"
    echo "4. Deploy to production with proper monitoring"
    echo ""
    echo "Documentation: See AUTH_SYSTEM_README.md for detailed usage instructions"
    echo ""
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "backup-only")
        check_dependencies
        check_environment
        backup_database
        ;;
    "migrate-only")
        check_dependencies
        check_environment
        run_migration
        generate_prisma
        ;;
    "test-only")
        check_dependencies
        check_environment
        test_auth_system
        ;;
    "verify-only")
        check_dependencies
        check_environment
        verify_deployment
        ;;
    *)
        echo "Usage: $0 [deploy|backup-only|migrate-only|test-only|verify-only]"
        echo ""
        echo "Commands:"
        echo "  deploy      - Full deployment process (default)"
        echo "  backup-only - Create database backup only"
        echo "  migrate-only- Run database migration only"
        echo "  test-only   - Run tests only"
        echo "  verify-only - Verify deployment only"
        exit 1
        ;;
esac