# Infrastructure

This directory contains the necessary configuration for running PostgreSQL 16 with pgBouncer on Vultr via Docker Compose.

## Usage

1. Create a `.env` file in this directory based on the env variables required.
2. Run `docker-compose up -d` to start the database and connection pooler.
3. Schedule `backup.sh` in a cron job for daily backups.

## Scale up path
- Resize Vultr instance vertically.
- Introduce read replicas.
- Migrate to a Managed PostgreSQL cluster when the application reaches higher scale.
