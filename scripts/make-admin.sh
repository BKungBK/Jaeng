#!/bin/bash
# Usage: bash scripts/make-admin.sh <email>  — gives an existing user the admin role.
set -euo pipefail
[ $# -eq 1 ] || { echo "usage: $0 <email>" >&2; exit 2; }
id=$(docker exec -i supabase_db_jaeng psql -U postgres -v ON_ERROR_STOP=1 -v email="$1" -qtA <<'SQL'
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = :'email')
returning id;
SQL
)
[ -n "$id" ] || { echo "make-admin: no user with email $1" >&2; exit 1; }
echo "make-admin: $1 is now admin ($id)"
