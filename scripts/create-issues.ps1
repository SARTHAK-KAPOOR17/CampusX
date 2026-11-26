# scripts/create-issues.ps1
# Automation script for MANAGER to create Day 1 GitHub issues using gh CLI

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) is not installed. Please install it first."
    exit 1
}

try {
    gh auth status | Out-Null
} catch {
    Write-Host "You are not logged into GitHub CLI. Please run:" -ForegroundColor Yellow
    Write-Host "  gh auth login" -ForegroundColor Cyan
    exit 1
}

Write-Host "Creating 'day-1' label..." -ForegroundColor Green
gh label create "day-1" --description "Tasks for Day 1: Project Foundation" --color "0E8A16" --force

$issues = @(
    @{
        title = "[Day 1] Monorepo Architecture & Base Setup"
        body = "Setup monorepo folder layout for client, server, ai-service, docker, and .github/workflows. Add root .gitignore and environment templates."
    },
    @{
        title = "[Day 1] Modular Express Server & Security Foundation"
        body = "Initialize Express modular monolith with helmet, CORS whitelist, express-rate-limit, express-validator, xss-clean, central error handling, async wrapper, pino logger, and standard JSON response format."
    },
    @{
        title = "[Day 1] PostgreSQL & Prisma Database Layer Setup"
        body = "Setup Prisma ORM with PostgreSQL datasource, initial schema with placeholder User model, client generator, and connection check."
    },
    @{
        title = "[Day 1] Server Health API Endpoint (/api/health)"
        body = "Implement GET /api/health returning service status, process uptime, and database connectivity."
    },
    @{
        title = "[Day 1] Client Vite React & Tailwind CSS Setup"
        body = "Setup React + Vite + Tailwind CSS frontend with standard folder structure (pages, components, hooks, services, store), axios instance, and live health dashboard."
    },
    @{
        title = "[Day 1] AI Service FastAPI Skeleton (/health)"
        body = "Setup FastAPI app skeleton with GET /health, requirements.txt, and pydantic environment configuration."
    },
    @{
        title = "[Day 1] Docker Containerization & Docker Compose"
        body = "Create Dockerfiles for server, client, ai-service, and docker-compose.yml orchestrating all services with PostgreSQL and healthchecks."
    },
    @{
        title = "[Day 1] GitHub Actions CI Pipeline"
        body = "Configure .github/workflows/ci.yml to run install, lint, test, and build across server, client, and ai-service on push and pull requests."
    },
    @{
        title = "[Day 1] QA Healthcheck Test Suite & Verification"
        body = "Add Jest and Supertest test suite for /api/health and verify docker compose up --build runs all containers cleanly."
    }
)

foreach ($issue in $issues) {
    Write-Host "Creating issue: $($issue.title)" -ForegroundColor Cyan
    gh issue create --title $issue.title --body $issue.body --label "day-1"
}

Write-Host "All Day 1 issues created successfully!" -ForegroundColor Green
