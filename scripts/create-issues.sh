#!/usr/bin/env bash
# scripts/create-issues.sh
# Automation script for MANAGER to create Day 1 GitHub issues using gh CLI

set -e

if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. Please install it first."
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "You are not logged into GitHub CLI. Please run:"
    echo "  gh auth login"
    exit 1
fi

echo "Creating 'day-1' label if it does not exist..."
gh label create "day-1" --description "Tasks for Day 1: Project Foundation" --color "0E8A16" --force || true

echo "Creating Day 1 GitHub Issues..."

gh issue create \
  --title "[Day 1] Monorepo Architecture & Base Setup" \
  --body "Setup monorepo folder layout for client, server, ai-service, docker, and .github/workflows. Add root .gitignore and environment templates." \
  --label "day-1"

gh issue create \
  --title "[Day 1] Modular Express Server & Security Foundation" \
  --body "Initialize Express modular monolith with helmet, CORS whitelist, express-rate-limit, express-validator, xss-clean, central error handling, async wrapper, pino logger, and standard JSON response format." \
  --label "day-1"

gh issue create \
  --title "[Day 1] PostgreSQL & Prisma Database Layer Setup" \
  --body "Setup Prisma ORM with PostgreSQL datasource, initial schema with placeholder User model, client generator, and connection check." \
  --label "day-1"

gh issue create \
  --title "[Day 1] Server Health API Endpoint (/api/health)" \
  --body "Implement GET /api/health returning service status, process uptime, and database connectivity." \
  --label "day-1"

gh issue create \
  --title "[Day 1] Client Vite React & Tailwind CSS Setup" \
  --body "Setup React + Vite + Tailwind CSS frontend with standard folder structure (pages, components, hooks, services, store), axios instance, and live health dashboard." \
  --label "day-1"

gh issue create \
  --title "[Day 1] AI Service FastAPI Skeleton (/health)" \
  --body "Setup FastAPI app skeleton with GET /health, requirements.txt, and pydantic environment configuration." \
  --label "day-1"

gh issue create \
  --title "[Day 1] Docker Containerization & Docker Compose" \
  --body "Create Dockerfiles for server, client, ai-service, and docker-compose.yml orchestrating all services with PostgreSQL and healthchecks." \
  --label "day-1"

gh issue create \
  --title "[Day 1] GitHub Actions CI Pipeline" \
  --body "Configure .github/workflows/ci.yml to run install, lint, test, and build across server, client, and ai-service on push and pull requests." \
  --label "day-1"

gh issue create \
  --title "[Day 1] QA Healthcheck Test Suite & Verification" \
  --body "Add Jest and Supertest test suite for /api/health and verify docker compose up --build runs all containers cleanly." \
  --label "day-1"

echo "All Day 1 issues created successfully!"
