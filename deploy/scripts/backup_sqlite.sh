#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/paleta}"
DB_PATH="${DB_PATH:-$PROJECT_DIR/data/instance/paleta.db}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups/sqlite}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is not installed. Install it first: sudo apt-get install -y sqlite3" >&2
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "SQLite database file not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +'%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/paleta_${TIMESTAMP}.db"

sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

find "$BACKUP_DIR" -type f -name "paleta_*.db" -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $BACKUP_FILE"
