#!/bin/bash
# Stops the app stack and Supabase. Data stays in Docker volumes.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down
npx supabase stop
