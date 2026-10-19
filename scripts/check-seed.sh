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

# Demo photos (plan 4, task 8): seeded through the real image pipeline.
PUB=http://localhost:8000/sb/storage/v1/object/public/photos-public
PUBLIC_STATUSES="'open','fix_claimed','resolved'"

expect "at least 20 public reports have photos" "select count(distinct r.id) >= 20 from public.reports r join public.report_photos p on p.report_id = r.id where r.status in ($PUBLIC_STATUSES)" t
expect "every fix_claimed/resolved report has an after photo" "select count(*) = 0 from public.reports r where r.status in ('fix_claimed','resolved') and not exists (select 1 from public.report_photos p where p.report_id = r.id and p.kind = 'after')" t
expect "no orphan photos" "select count(*) from public.report_photos where report_id is null" 0
expect "photos are not marked blurred" "select count(*) from public.report_photos where blurred" 0
expect "photo sizes recorded and within 1600" "select count(*) = 0 from public.report_photos where width is null or height is null or greatest(width, height) > 1600" t

bad_public=0 checked_public=0 bad_exif=0 bad_size=0
while read -r path; do
  [ -z "$path" ] && continue
  for p in "$path" "${path%.webp}_thumb.webp"; do
    checked_public=$((checked_public + 1))
    headers=$(curl -s -o /tmp/seed-photo.bin -D - "$PUB/$p")
    echo "$headers" | head -1 | grep -q " 200" || { echo "  not 200: $p"; bad_public=$((bad_public + 1)); continue; }
    echo "$headers" | grep -qi '^content-type: *image/webp' || { echo "  not webp: $p"; bad_public=$((bad_public + 1)); }
    [ "$(head -c 4 /tmp/seed-photo.bin)" = "RIFF" ] && [ "$(tail -c +9 /tmp/seed-photo.bin | head -c 4)" = "WEBP" ] || { echo "  bad magic: $p"; bad_public=$((bad_public + 1)); }
    [ "$(grep -ac Exif /tmp/seed-photo.bin)" = "0" ] || { echo "  has Exif: $p"; bad_exif=$((bad_exif + 1)); }
  done
done < <(q "select p.storage_path from public.report_photos p join public.reports r on r.id = p.report_id where r.status in ($PUBLIC_STATUSES)")
rm -f /tmp/seed-photo.bin
if [ "$checked_public" -ge 40 ] && [ "$bad_public" = 0 ]; then echo "✓ public photos and thumbs served as WebP ($checked_public files)"; else echo "✗ public photos: $bad_public bad of $checked_public (need at least 40 files)"; fail=1; fi
if [ "$checked_public" -ge 40 ] && [ "$bad_exif" = 0 ]; then echo "✓ no Exif in public photos"; else echo "✗ Exif found in $bad_exif public files"; fail=1; fi

expect "pending reports have a private photo" "select count(*) >= 1 from public.reports r join public.report_photos p on p.report_id = r.id where r.status = 'pending_review'" t
expect "pending photos live under the reporter id" "select count(*) = 0 from public.reports r join public.report_photos p on p.report_id = r.id where r.status = 'pending_review' and p.storage_path not like r.author_id::text || '/%'" t
pend_bad=0
while read -r path; do
  [ -z "$path" ] && continue
  code=$(curl -s -o /dev/null -w '%{http_code}' "$PUB/$path")
  case "$code" in 400|404) ;; *) echo "  pending photo public ($code): $path"; pend_bad=$((pend_bad + 1)) ;; esac
done < <(q "select p.storage_path from public.report_photos p join public.reports r on r.id = p.report_id where r.status = 'pending_review'")
if [ "$pend_bad" = 0 ]; then echo "✓ pending photos are not public"; else echo "✗ $pend_bad pending photos reachable publicly"; fail=1; fi

missing=0
for f in supabase/seed-photos/*.jpg; do
  grep -q "$(basename "$f")" supabase/seed-photos/CREDITS.md || { echo "  CREDITS.md misses $(basename "$f")"; missing=$((missing + 1)); }
done
count=$(ls supabase/seed-photos/*.jpg 2>/dev/null | wc -l)
if [ "$missing" = 0 ] && [ "$count" -ge 12 ]; then echo "✓ CREDITS.md covers all $count seed photos"; else echo "✗ CREDITS.md: $missing missing, $count photos (need 12 or more)"; fail=1; fi

exit $fail
