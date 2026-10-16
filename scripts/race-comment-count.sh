#!/bin/bash
# Concurrency test for reports.comment_count: two sessions comment on the same report at once.
# The second session's trigger waits on the first's row lock; the stored count must still equal
# the number of visible comments afterwards. Cleans up its own rows.
set -euo pipefail
cd "$(dirname "$0")/.."

sql() { docker exec -i supabase_db_jaeng psql -U postgres -qtA -v ON_ERROR_STOP=1 "$@"; }

rid=$(sql -c "select id from public.reports where status = 'open' order by created_at limit 1")
uid=$(sql -c "select id from public.profiles order by created_at limit 1")
[ -n "$rid" ] && [ -n "$uid" ] || { echo "race: needs seeded data (run scripts/reset-db.sh)" >&2; exit 2; }

ins="insert into public.comments (report_id, author_id, body) values ('$rid', '$uid', 'race-probe')"

# Session A holds the report row lock for 3 s; session B starts inside that window.
printf 'begin; %s; select pg_sleep(3); commit;\n' "$ins" | sql > /dev/null &
sleep 1
printf '%s;\n' "$ins" | sql > /dev/null
wait

stored=$(sql -c "select comment_count from public.reports where id = '$rid'")
actual=$(sql -c "select count(*) from public.comments where report_id = '$rid' and status = 'visible'")

sql -c "delete from public.comments where report_id = '$rid' and body = 'race-probe'" > /dev/null

if [ "$stored" = "$actual" ]; then
  echo "✓ comment_count stays exact under concurrent comments ($stored)"
else
  echo "✗ comment_count drifted under concurrent comments: stored $stored, actual $actual"
  exit 1
fi
