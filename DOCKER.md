# CanvasCast Docker Deployment Guide

This document explains how to deploy CanvasCast using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- At least 4GB of available RAM
- 10GB of available disk space

## Quick Start

1. **Clone the repository and navigate to the project root**

```bash
cd CanvasCast-Target
```

2. **Create environment file**

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key for GPT-4 and TTS
- `GEMINI_API_KEY` - Google Gemini API key for image generation
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `JWT_SECRET` - Random string for JWT signing
- `RESEND_API_KEY` - Resend API key for emails

3. **Build and start all services**

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- Redis queue (port 6379)
- API service (port 8989)
- Worker service (background)
- Web frontend (port 3838)

4. **Check service health**

```bash
docker-compose ps
```

All services should show "Up (healthy)" status.

5. **View logs**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f api
docker-compose logs -f worker
```

## Service Details

### Web (Next.js Frontend)
- **Port:** 3838
- **Health Check:** `http://localhost:3838/api/health`
- **Multi-stage build:** Optimized for production with standalone output

### API (Express Backend)
- **Port:** 8989
- **Health Check:** `http://localhost:8989/health`
- **Dependencies:** PostgreSQL, Redis

### Worker (BullMQ Job Processor)
- **No exposed ports**
- **Dependencies:** PostgreSQL, Redis
- **Includes:** FFmpeg, Chromium for Remotion rendering

### Redis
- **Port:** 6379
- **Purpose:** Job queue and caching

### PostgreSQL
- **Port:** 5432
- **Purpose:** Primary database
- **Data Persistence:** Volume `canvascast-postgres-data`

## Docker Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### Stop services and remove volumes
```bash
docker-compose down -v
```

### Rebuild a specific service
```bash
docker-compose build web
docker-compose up -d web
```

### Rebuild all services
```bash
docker-compose build
docker-compose up -d
```

### View resource usage
```bash
docker stats
```

### Access service shell
```bash
docker-compose exec web sh
docker-compose exec api sh
docker-compose exec worker sh
```

### Run database migrations
```bash
# Connect to Supabase and run migrations
# Migrations should be applied through Supabase CLI or dashboard
```

## Environment Variables

All services support environment variable configuration. See `.env.example` for a complete list.

### Override default ports

```bash
# In your .env file
WEB_PORT=3000
API_PORT=8080
POSTGRES_PORT=5433
REDIS_PORT=6380
```

## Production Considerations

### Security
1. Use strong passwords for PostgreSQL
2. Set secure `JWT_SECRET` (use a random 64-character string)
3. Enable HTTPS with a reverse proxy (nginx, Caddy, Traefik)
4. Configure firewall rules to restrict database and Redis access
5. Use Docker secrets for sensitive environment variables

### Scaling
1. **Worker horizontal scaling:**
   ```bash
   docker-compose up -d --scale worker=3
   ```

2. **Resource limits:** Add resource constraints in docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

### Monitoring
1. **Health checks** are configured for all services
2. **Logs:** Use `docker-compose logs` or ship to a logging service
3. **Metrics:** Consider adding Prometheus exporters

### Backups
1. **Database backup:**
   ```bash
   docker-compose exec postgres pg_dump -U postgres canvascast > backup.sql
   ```

2. **Restore database:**
   ```bash
   cat backup.sql | docker-compose exec -T postgres psql -U postgres canvascast
   ```

3. **Redis backup:** Redis uses AOF persistence by default (saved to volume)

## Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs <service-name>

# Check if ports are already in use
lsof -i :3838
lsof -i :8989
```

### Out of memory
```bash
# Check Docker memory allocation
docker stats

# Increase Docker Desktop memory limit (Settings > Resources)
```

### Worker not processing jobs
```bash
# Check worker logs
docker-compose logs worker

# Verify Redis connection
docker-compose exec worker node -e "require('ioredis').createClient(process.env.REDIS_URL).ping().then(console.log)"
```

### Database connection issues
```bash
# Verify PostgreSQL is healthy
docker-compose exec postgres pg_isready

# Check connection string
docker-compose exec api node -e "console.log(process.env.DATABASE_URL)"
```

## Development vs Production

The Dockerfiles use multi-stage builds and are optimized for production:
- Separate dependency installation stage for better caching
- Production-only dependencies in final stage
- Non-root users for security
- Health checks for orchestration

For local development, use:
```bash
pnpm dev:all
```

## File Structure

```
CanvasCast-Target/
├── docker-compose.yml          # Service orchestration
├── .dockerignore              # Files excluded from build context
├── apps/
│   ├── web/Dockerfile         # Next.js frontend
│   ├── api/Dockerfile         # Express API
│   └── worker/Dockerfile      # BullMQ worker
└── .env                       # Environment variables (create from .env.example)
```

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Verify environment variables are set correctly
3. Ensure all external services (Supabase, Stripe, etc.) are configured
4. Check the health endpoints for each service

## License

See LICENSE file in the project root.
