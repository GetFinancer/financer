#!/bin/bash

# ===========================================
# Financer Update Script (Multi-Tenant)
# ===========================================
# This script safely updates Financer while
# preserving all tenant data

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory (works even when called from another location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Directories
DATA_DIR="$SCRIPT_DIR/data"
BACKUP_DIR="$SCRIPT_DIR/backups"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}       Financer Update Script${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Step 1: Create backup before update
echo -e "${YELLOW}[1/5] Creating backup of tenant data...${NC}"

if [ -d "$DATA_DIR" ] && [ "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/financer-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    tar -czf "$BACKUP_FILE" -C "$SCRIPT_DIR" data/

    # Count tenants and total size
    TENANT_COUNT=$(find "$DATA_DIR" -name "financer.db" | wc -l | tr -d ' ')
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}Backup created: $BACKUP_FILE ($BACKUP_SIZE, $TENANT_COUNT tenant(s))${NC}"

    # List backed up tenants
    for tenant_dir in "$DATA_DIR"/*/; do
        if [ -f "$tenant_dir/financer.db" ]; then
            tenant_name=$(basename "$tenant_dir")
            db_size=$(du -h "$tenant_dir/financer.db" | cut -f1)
            echo -e "  ${BLUE}- $tenant_name ($db_size)${NC}"
        fi
    done
else
    echo -e "${BLUE}No existing data found (fresh install)${NC}"
    BACKUP_FILE=""
fi
echo ""

# Step 2: Pull latest changes from GitHub
echo -e "${YELLOW}[2/5] Pulling latest changes from GitHub...${NC}"
git pull origin main
echo -e "${GREEN}Done!${NC}"
echo ""

# Step 3: Stop running containers (data is on host via bind mount)
echo -e "${YELLOW}[3/5] Stopping running containers...${NC}"
echo -e "${BLUE}(Your data is safely on the host filesystem in ./data/)${NC}"
docker compose down
echo -e "${GREEN}Done!${NC}"
echo ""

# Step 4: Rebuild images
echo -e "${YELLOW}[4/5] Rebuilding Docker images (this may take a few minutes)...${NC}"
docker compose build --no-cache
echo -e "${GREEN}Done!${NC}"
echo ""

# Step 5: Start containers
echo -e "${YELLOW}[5/5] Starting containers...${NC}"
docker compose up -d
echo -e "${GREEN}Done!${NC}"
echo ""

# Clean up old backups (keep last 5)
echo -e "${BLUE}Cleaning up old backups (keeping last 5)...${NC}"
ls -t "$BACKUP_DIR"/financer-backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
echo ""

# Show status
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}       Update completed successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Container status:"
docker compose ps
echo ""

# List active tenants
if [ -d "$DATA_DIR" ]; then
    TENANT_COUNT=$(find "$DATA_DIR" -name "financer.db" | wc -l | tr -d ' ')
    echo -e "Active tenants: ${GREEN}$TENANT_COUNT${NC}"
    for tenant_dir in "$DATA_DIR"/*/; do
        if [ -f "$tenant_dir/financer.db" ]; then
            echo -e "  - $(basename "$tenant_dir")"
        fi
    done
    echo ""
fi

# Ask about backup
if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
    echo ""
    echo -e "${YELLOW}A backup was created at: $BACKUP_FILE${NC}"
    echo ""
    read -p "Do you want to keep the backup? (y/n) [y]: " KEEP_BACKUP
    KEEP_BACKUP=${KEEP_BACKUP:-y}

    if [[ "$KEEP_BACKUP" =~ ^[Nn]$ ]]; then
        rm -f "$BACKUP_FILE"
        echo -e "${BLUE}Backup deleted.${NC}"

        BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/financer-backup-*.tar.gz 2>/dev/null | wc -l)
        if [ "$BACKUP_COUNT" -gt 0 ]; then
            echo ""
            read -p "Delete all old backups too? ($BACKUP_COUNT found) (y/n) [n]: " DELETE_ALL
            DELETE_ALL=${DELETE_ALL:-n}
            if [[ "$DELETE_ALL" =~ ^[Yy]$ ]]; then
                rm -f "$BACKUP_DIR"/financer-backup-*.tar.gz
                rmdir "$BACKUP_DIR" 2>/dev/null || true
                echo -e "${BLUE}All backups deleted.${NC}"
            fi
        fi
    else
        echo -e "${GREEN}Backup kept at: $BACKUP_FILE${NC}"
    fi
fi

echo ""
echo -e "View logs with: ${YELLOW}docker compose logs -f${NC}"
echo -e "Stop app with:  ${YELLOW}docker compose down${NC}"
echo ""
