#!/bin/bash
# Recreates the local database from migrations and seed files.
set -euo pipefail
cd "$(dirname "$0")/.."
npx supabase db reset
