#!/bin/bash
# Verifies the demo seed (plan 1, task 12). Exits non-zero on the first mismatch.
cd "$(dirname "$0")/.." || exit 1
fail=0

q() { docker exec -i supabase_db_jaeng psql -U postgres -tA -c "$1" 2>/dev/null; }

expect() {
  local name="$1" sql="$2" want="$3" got
  got=$(q "$sql")
  if [ "$got" = "$want" ]; then echo "✓ $name ($got)"; else echo "✗ $name: got '$got', want '$want'"; fail=1; fi
}

expect "40 demo reports" "select count(*) from public.reports" 40
expect "38 public reports" "select count(*) from public.public_reports" 38
expect "2 pending review" "select count(*) from public.reports where status='pending_review'" 2
expect "30 open" "select count(*) from public.reports where status='open'" 30
expect "4 fix claimed" "select count(*) from public.reports where status='fix_claimed'" 4
expect "4 resolved" "select count(*) from public.reports where status='resolved'" 4
expect "every level at least 4 times" "select bool_and(n >= 4) from (select count(*) n from public.reports group by danger_level) s" t
expect "4 levels present" "select count(distinct danger_level) from public.reports" 4
expect "at least 3 open over 30 days" "select count(*) >= 3 from public.public_reports where days_open > 30" t
expect "at least 10 provinces" "select count(distinct public.area_province_at(lng, lat)) >= 10 from public.public_reports" t
expect "confirm_count matches rows" "select bool_and(r.confirm_count = (select count(*) from public.confirmations c where c.report_id = r.id)) from public.reports r" t
expect "admin role" "select p.role from public.profiles p join auth.users u on u.id = p.id where u.email = 'admin@jaeng.local'" admin
expect "reporter exists" "select count(*) from auth.users where email = 'reporter@jaeng.local'" 1

exit $fail
