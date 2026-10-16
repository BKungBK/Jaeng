// Demo seed (plan 1, task 12): users through the Auth admin API, reports through SQL.
// Runs inside the Supabase Docker network; scripts/reset-db.sh starts it.
import { SQL } from 'bun';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

// Idempotent: replace every report the demo reporter owns.
await db`delete from public.reports where author_id = ${reporterId}`;

const DAY = 86_400_000;
const now = Date.now();
let i = 0;
for (const r of reports) {
  const pending = r.status === 'pending_review';
  const approvedAt = pending ? null : new Date(now - r.days_ago * DAY);
  const createdAt = new Date(now - r.days_ago * DAY - 3_600_000);
  const resolvedAt = r.status === 'resolved' ? new Date(now - (r.resolved_days_ago ?? 0) * DAY) : null;

  const [row] = await db`
    insert into public.reports
      (author_id, category_id, danger_level, title, description, status, location,
       hide_author, created_at, approved_at, resolved_at)
    values (
      ${reporterId},
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
  i++;
}

console.log(`seed: ${reports.length} reports, ${neighbors.length + 2} users`);
await db.close();
