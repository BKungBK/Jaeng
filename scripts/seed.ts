// Demo seed (plan 1, task 12): users through the Auth admin API, reports through SQL.
// Runs inside the Supabase Docker network; scripts/reset-db.sh starts it.
import { SQL } from 'bun';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { thumbPath } from '../packages/shared/report';
import { makeThumb, reencode } from '../apps/api/src/photos/pipeline';
import { processForPrivacy } from '../apps/api/src/photos/privacy';

type DemoReport = {
  title: string;
  description: string;
  category: string;
  danger_level: number;
  lng: number;
  lat: number;
  status: 'open' | 'fix_claimed' | 'resolved' | 'pending_review';
  days_ago: number;
  resolved_days_ago?: number;
  confirms: number;
  comments: string[];
  tags: string[];
  hide_author: boolean;
};

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`seed: missing ${k}`);
  return v;
};
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const PASSWORD = env('DEMO_PASSWORD');
const db = new SQL(env('DATABASE_URL'));

const reports: DemoReport[] = JSON.parse(
  readFileSync(join(import.meta.dir, '../supabase/seed/demo-reports.json'), 'utf8'),
);

async function ensureUser(email: string): Promise<string> {
  const [existing] = await db`select id from auth.users where email = ${email}`;
  if (existing) return existing.id;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`seed: creating ${email} failed: ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

const neighborCount = Math.max(3, ...reports.map((r) => r.confirms));
const adminId = await ensureUser('admin@jaeng.local');
const reporterId = await ensureUser('reporter@jaeng.local');
const neighbors: string[] = [];
for (let i = 1; i <= neighborCount; i++) neighbors.push(await ensureUser(`neighbor${i}@jaeng.local`));

await db`update public.profiles set role = 'admin', display_name = 'ผู้ดูแลแจ้ง' where id = ${adminId}`;
await db`update public.profiles set display_name = 'เพื่อนบ้านใจดี' where id = ${reporterId}`;

// Demo photos (plan 4, task 8): CC0 files in supabase/seed-photos, pushed through the API's own pipeline.
// Category -> pool of file name prefixes. 'other' has no pool, so it gets no photo.
const POOLS: Record<string, string[]> = {};
const photoDir = join(import.meta.dir, '../supabase/seed-photos');
const prefixOf: Record<string, string> = { road: 'road', light: 'light', water: 'drain', flood: 'flood', waste: 'rubbish', tree: 'tree', hazard: 'unsafe' };
const photoFiles = readdirSync(photoDir).filter((f) => f.endsWith('.jpg')).sort();
for (const [category, prefix] of Object.entries(prefixOf)) {
  POOLS[category] = photoFiles.filter((f) => f.startsWith(`${prefix}-`));
}

// Fixed namespace: ids derived from it are the same after every reset, so Storage paths are too.
const NAMESPACE = '6f1c7a52-3b7e-4d0c-9a52-1d3f8e6b2a10';
const processed = new Map<string, { full: Buffer; thumb: Buffer; width: number; height: number }>();
async function loadPhoto(file: string) {
  let p = processed.get(file);
  if (!p) {
    const { image, width, height } = await reencode(readFileSync(join(photoDir, file)));
    const { image: full } = await processForPrivacy(image);
    p = { full, thumb: await makeThumb(full), width, height };
    processed.set(file, p);
  }
  return p;
}

async function upload(bucket: string, path: string, bytes: Uint8Array) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`seed: upload ${bucket}/${path} failed: ${res.status} ${await res.text()}`);
}

// Idempotent: replace every report the demo reporter owns (report_photos go with them).
await db`delete from public.reports where author_id = ${reporterId}`;

const DAY = 86_400_000;
const now = Date.now();
let i = 0;
let photoCount = 0;
const poolCursor: Record<string, number> = {};
const seenTitles = new Set<string>();
for (const r of reports) {
  if (seenTitles.has(r.title)) throw new Error(`seed: duplicate title (ids are derived from it): ${r.title}`);
  seenTitles.add(r.title);
  const reportId = Bun.randomUUIDv5(r.title, NAMESPACE);
  const pending = r.status === 'pending_review';
  const approvedAt = pending ? null : new Date(now - r.days_ago * DAY);
  const createdAt = new Date(now - r.days_ago * DAY - 3_600_000);
  const resolvedAt = r.status === 'resolved' ? new Date(now - (r.resolved_days_ago ?? 0) * DAY) : null;

  const [row] = await db`
    insert into public.reports
      (id, author_id, category_id, danger_level, title, description, status, location,
       hide_author, created_at, approved_at, resolved_at)
    values (
      ${reportId}, ${reporterId},
      (select id from public.categories where slug = ${r.category}),
      ${r.danger_level}, ${r.title}, ${r.description}, ${r.status},
      extensions.st_point(${r.lng}, ${r.lat}, 4326)::extensions.geography,
      ${r.hide_author}, ${createdAt}, ${approvedAt}, ${resolvedAt}
    )
    returning id`;

  for (const userId of neighbors.slice(0, r.confirms)) {
    await db`insert into public.confirmations (report_id, user_id) values (${row.id}, ${userId})`;
  }
  for (const [n, body] of r.comments.entries()) {
    const at = new Date((approvedAt ?? createdAt).getTime() + (n + 1) * 3_600_000);
    await db`insert into public.comments (report_id, author_id, body, created_at)
             values (${row.id}, ${neighbors[(i + n) % 3]}, ${body}, ${at})`;
  }
  for (const name of r.tags) {
    const [tag] = await db`
      insert into public.tags (name) values (${name.toLowerCase()})
      on conflict (name) do update set name = excluded.name
      returning id`;
    await db`insert into public.report_tags (report_id, tag_id) values (${row.id}, ${tag.id})`;
  }

  // Photos: i % 3 !== 0 gets a 'before' from the category pool (round-robin); resolved and
  // fix_claimed also get an 'after' (the next file in the same pool).
  const pool = POOLS[r.category] ?? [];
  if (pool.length > 0) {
    const cursor = poolCursor[r.category] ?? 0;
    poolCursor[r.category] = cursor + 1;
    const wanted: { kind: 'before' | 'after'; file: string }[] = [];
    if (i % 3 !== 0) wanted.push({ kind: 'before', file: pool[cursor % pool.length] });
    if (r.status === 'resolved' || r.status === 'fix_claimed') wanted.push({ kind: 'after', file: pool[(cursor + 1) % pool.length] });
    for (const [n, { kind, file }] of wanted.entries()) {
      const photoId = Bun.randomUUIDv5(`${row.id}:${kind}:${n}`, NAMESPACE);
      const path = pending ? `${reporterId}/${photoId}.webp` : `${row.id}/${photoId}.webp`;
      const bucket = pending ? 'photos-private' : 'photos-public';
      const p = await loadPhoto(file);
      await upload(bucket, path, p.full);
      await upload(bucket, thumbPath(path), p.thumb);
      await db`insert into public.report_photos (id, report_id, uploader_id, kind, storage_path, width, height, blurred)
               values (${photoId}, ${row.id}, ${reporterId}, ${kind}, ${path}, ${p.width}, ${p.height}, false)`;
      photoCount++;
    }
  }
  i++;
}

console.log(`seed: ${reports.length} reports, ${photoCount} photos, ${neighbors.length + 2} users`);
await db.close();
