#!/bin/bash
# Regenerates packages/shared/database.types.ts from the local database schema.
set -euo pipefail
cd "$(dirname "$0")/.."
npx supabase gen types typescript --local > packages/shared/database.types.ts
echo "gen-types: wrote packages/shared/database.types.ts"
