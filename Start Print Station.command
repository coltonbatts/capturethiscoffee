#!/bin/bash
set -euo pipefail

REPO_DIR="/Users/coltonbatts/Desktop/CaptureThisCoffee"

cd "$REPO_DIR"
echo "Starting Capture This Coffee print station..."
echo ""
npm run station:start
