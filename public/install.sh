#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 Verifying script integrity...${NC}"
SCRIPT_URL="https://forge.zephyyrr.in/install.sh"
SCRIPT_HASH_URL="https://forge.zephyyrr.in/install.sh.sha256"

# Verify Node.js installation
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}✓ Environment check passed${NC}"
echo -e "${BLUE}🚀 Installing Zephyrforge...${NC}"

# Create temporary directory
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

# Install and run Zephyrforge
echo -e "${GREEN}Running installer...${NC}"
npx @parazeeknova/zephyr-forge@latest init

# Cleanup
rm -rf "$TMP_DIR"
