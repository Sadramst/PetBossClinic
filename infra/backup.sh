#!/bin/bash
# Backup script for Pet Boss Postgres DB to Vultr Object Storage
PG_CONTAINER="infra-db-1"
DB_USER="user"
DB_NAME="petboss"
BACKUP_FILE="petboss_backup_$(date +%Y%m%d_%H%M%S).sql"

docker exec $PG_CONTAINER pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE
# TODO(phase-1): Upload $BACKUP_FILE to S3-compatible Vultr Object Storage using aws-cli or rclone
echo "Backup saved to $BACKUP_FILE"
