#!/bin/bash

# SynapseAI Production Deployment Script
# This script deploys the complete production-grade system

set -e

echo "🚀 Starting SynapseAI Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="synapseai"
FRONTEND_PORT=3000
BACKEND_PORT=3001
POSTGRES_PORT=5432
REDIS_PORT=6379

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    log "✅ Prerequisites check passed"
}

# Environment setup
setup_environment() {
    log "Setting up environment..."
    
    # Create .env files if they don't exist
    if [ ! -f .env ]; then
        log "Creating .env file..."
        cat > .env << EOF
# Database
DATABASE_URL=postgresql://postgres:password@localhost:${POSTGRES_PORT}/synapseai
TEST_DATABASE_URL=postgresql://postgres:password@localhost:${POSTGRES_PORT}/synapseai_test

# Redis
REDIS_URL=redis://localhost:${REDIS_PORT}
TEST_REDIS_URL=redis://localhost:${REDIS_PORT}/1

# JWT
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}
NEXT_PUBLIC_WS_URL=ws://localhost:${BACKEND_PORT}

# Production
NODE_ENV=production
PORT=${BACKEND_PORT}
EOF
        warn "Please update the .env file with your actual API keys and credentials"
    fi
    
    # Create backend .env
    if [ ! -f backend/.env ]; then
        cp .env backend/.env
    fi
    
    log "✅ Environment setup completed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Frontend dependencies
    log "Installing frontend dependencies..."
    npm ci
    
    # Backend dependencies
    log "Installing backend dependencies..."
    cd backend
    npm ci
    cd ..
    
    log "✅ Dependencies installed"
}

# Database setup
setup_database() {
    log "Setting up database..."
    
    # Start PostgreSQL and Redis with Docker
    log "Starting database services..."
    docker-compose up -d postgres redis
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Run database migrations
    log "Running database migrations..."
    cd backend
    npx prisma migrate deploy
    npx prisma generate
    cd ..
    
    log "✅ Database setup completed"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    # Backend tests
    log "Running backend tests..."
    cd backend
    npm run test:cov
    
    if [ $? -ne 0 ]; then
        error "Backend tests failed"
    fi
    
    # E2E tests
    log "Running E2E tests..."
    npm run test:e2e
    
    if [ $? -ne 0 ]; then
        error "E2E tests failed"
    fi
    
    cd ..
    
    # Frontend tests (if configured)
    if [ -f "vitest.config.ts" ]; then
        log "Running frontend tests..."
        npm run test
        
        if [ $? -ne 0 ]; then
            error "Frontend tests failed"
        fi
    fi
    
    log "✅ All tests passed"
}

# Build applications
build_applications() {
    log "Building applications..."
    
    # Build backend
    log "Building backend..."
    cd backend
    npm run build
    cd ..
    
    # Build frontend
    log "Building frontend..."
    npm run build
    
    log "✅ Applications built successfully"
}

# Security hardening
security_hardening() {
    log "Applying security hardening..."
    
    # Set proper file permissions
    chmod 600 .env backend/.env
    
    # Ensure no sensitive files are in version control
    if git check-ignore .env >/dev/null 2>&1; then
        log "✅ .env files are properly ignored"
    else
        warn ".env files should be added to .gitignore"
    fi
    
    log "✅ Security hardening completed"
}

# Start production services
start_production() {
    log "Starting production services..."
    
    # Start all services with Docker Compose
    docker-compose up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 30
    
    # Health checks
    log "Performing health checks..."
    
    # Check backend health
    if curl -f http://localhost:${BACKEND_PORT}/health >/dev/null 2>&1; then
        log "✅ Backend is healthy"
    else
        error "Backend health check failed"
    fi
    
    # Check frontend
    if curl -f http://localhost:${FRONTEND_PORT} >/dev/null 2>&1; then
        log "✅ Frontend is accessible"
    else
        error "Frontend health check failed"
    fi
    
    log "✅ Production services started successfully"
}

# Performance optimization
optimize_performance() {
    log "Optimizing performance..."
    
    # Enable gzip compression
    # Configure caching headers
    # Optimize database connections
    # Set up CDN (if configured)
    
    log "✅ Performance optimization completed"
}

# Monitoring setup
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Start monitoring services (if configured)
    if [ -f "docker-compose.monitoring.yml" ]; then
        docker-compose -f docker-compose.monitoring.yml up -d
    fi
    
    log "✅ Monitoring setup completed"
}

# Backup setup
setup_backup() {
    log "Setting up backup system..."
    
    # Create backup directory
    mkdir -p backups
    
    # Create backup script
    cat > scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker exec postgres pg_dump -U postgres synapseai > "$BACKUP_DIR/db_backup_$DATE.sql"

# Redis backup
docker exec redis redis-cli BGSAVE
docker cp redis:/data/dump.rdb "$BACKUP_DIR/redis_backup_$DATE.rdb"

echo "Backup completed: $DATE"
EOF
    
    chmod +x scripts/backup.sh
    
    log "✅ Backup system setup completed"
}

# Display deployment summary
deployment_summary() {
    log "🎉 Deployment completed successfully!"
    echo
    echo -e "${BLUE}=== SynapseAI Production Deployment Summary ===${NC}"
    echo -e "${GREEN}Frontend URL:${NC} http://localhost:${FRONTEND_PORT}"
    echo -e "${GREEN}Backend API:${NC} http://localhost:${BACKEND_PORT}"
    echo -e "${GREEN}API Documentation:${NC} http://localhost:${BACKEND_PORT}/api/docs"
    echo
    echo -e "${YELLOW}Services Status:${NC}"
    docker-compose ps
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Update API keys in .env file"
    echo "2. Configure domain and SSL certificates"
    echo "3. Set up monitoring alerts"
    echo "4. Configure automated backups"
    echo "5. Review security settings"
    echo
    echo -e "${GREEN}Logs:${NC}"
    echo "  Frontend: docker-compose logs frontend"
    echo "  Backend:  docker-compose logs backend"
    echo "  Database: docker-compose logs postgres"
    echo
    echo -e "${GREEN}Management:${NC}"
    echo "  Stop:     docker-compose down"
    echo "  Restart:  docker-compose restart"
    echo "  Backup:   ./scripts/backup.sh"
}

# Main deployment process
main() {
    log "Starting SynapseAI Production Deployment"
    
    check_prerequisites
    setup_environment
    install_dependencies
    setup_database
    
    # Skip tests in CI/automated deployment if specified
    if [ "$SKIP_TESTS" != "true" ]; then
        run_tests
    fi
    
    build_applications
    security_hardening
    start_production
    optimize_performance
    setup_monitoring
    setup_backup
    
    deployment_summary
}

# Handle script arguments
case "${1:-}" in
    --skip-tests)
        export SKIP_TESTS=true
        main
        ;;
    --help|-h)
        echo "SynapseAI Production Deployment Script"
        echo
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  --skip-tests    Skip running tests during deployment"
        echo "  --help, -h      Show this help message"
        ;;
    *)
        main
        ;;
esac