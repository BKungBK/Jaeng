// Live API check against the running stack (http://localhost:8000). Run: node scripts/check-api.mjs
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:8000';
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

function psql(sql) {
  return execFileSync('docker', ['exec', 'supabase_db_jaeng', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql], {
    encoding: 'utf8',
  }).trim();
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  // A previous run killed between ban and unban would leave neighbor1 banned; start clean (idempotent).
  psql(`update public.profiles set banned_at = null where id = (select id from auth.users where email='neighbor1@jaeng.local')`);
  const config = await api('/config');
  const anon = config.json?.supabaseAnonKey;
  const sb = async (path) => {
    const res = await fetch(`${BASE}/sb/rest/v1/${path}`, { headers: { apikey: anon, authorization: `Bearer ${anon}` } });
    return res.json();
  };

  // 1
  check('/api/config lists 3 quick-login users', config.json?.quickLogin?.length === 3, JSON.stringify(config.json?.quickLogin));

  // 2
  const login = async (who) => (await api('/dev/quick-login', { method: 'POST', body: { who } })).json;
  const reporter = await login('reporter');
  const neighbor = await login('neighbor1');
  check('quick login as reporter', !!reporter?.access_token);
  check('quick login as neighbor1', !!neighbor?.access_token);
  if (!reporter?.access_token || !neighbor?.access_token) return;

  // The seed may already hold neighbor1's confirmation, so read the starting state first.
  const taken = new Set(
    psql(`select report_id from public.confirmations where user_id = (select id from auth.users where email='neighbor1@jaeng.local')`)
      .split('\n')
      .filter(Boolean),
  );
  const candidates = await sb('public_reports?select=id,status,author_name,confirm_count&status=eq.open&author_name=is.null&limit=100');
  const open = candidates[0];
  const wasConfirmed = open ? taken.has(open.id) : false;
  const [resolved] = await sb('public_reports?select=id&status=eq.resolved&limit=1');
  if (!open) {
    check('found an open anonymous report', false, 'run scripts/reset-db.sh');
    return;
  }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuid = (v) => {
    if (!UUID.test(String(v))) throw new Error(`not a uuid: ${v}`);
    return v;
  };
  const reportId = uuid(open.id);
  const n1 = `(select id from auth.users where email='neighbor1@jaeng.local')`;

  let commentId = null;
  try {
    // 3
    const first = await api(`/reports/${open.id}/confirm`, { method: 'POST', token: neighbor.access_token });
    const second = await api(`/reports/${open.id}/confirm`, { method: 'POST', token: neighbor.access_token });
    check(
      'neighbor1 confirm toggles twice, count restored',
      first.status === 200 &&
        first.json.confirmed === !wasConfirmed &&
        first.json.report.confirm_count === open.confirm_count + (wasConfirmed ? -1 : 1) &&
        second.status === 200 &&
        second.json.confirmed === wasConfirmed &&
        second.json.report.confirm_count === open.confirm_count,
      JSON.stringify([first.status, first.json, second.status, second.json]),
    );

    // 4
    const posted = await api(`/reports/${open.id}/comments`, { method: 'POST', token: reporter.access_token, body: { body: 'ทดสอบ check-api' } });
    commentId = posted.json?.comment?.id ?? null;
    check(
      'reporter comment is anonymous with by_reporter',
      posted.status === 201 && posted.json.comment.author_name === null && posted.json.comment.by_reporter === true,
      JSON.stringify(posted.json),
    );
    const [pub] = commentId ? await sb(`public_comments?select=id,author_name,by_reporter&id=eq.${commentId}`) : [];
    check('anon read of the comment shows author_name null', !!pub && pub.author_name === null, JSON.stringify(pub));

    // 5
    const noTok = await api(`/reports/${open.id}/confirm`, { method: 'POST' });
    const junk = await api(`/reports/${open.id}/confirm`, { method: 'POST', token: 'not.a.jwt' });
    const anonTok = await api(`/reports/${open.id}/confirm`, { method: 'POST', token: anon });
    check('no token, junk token and anon key are all 401', [noTok, junk, anonTok].every((r) => r.status === 401), [noTok, junk, anonTok].map((r) => r.status).join(','));

    // 6
    const ban = (v) =>
      psql(`update public.profiles set banned_at = ${v} where id = (select id from auth.users where email='neighbor1@jaeng.local')`);
    try {
      ban('now()');
      const c = await api(`/reports/${open.id}/confirm`, { method: 'POST', token: neighbor.access_token });
      const m = await api(`/reports/${open.id}/comments`, { method: 'POST', token: neighbor.access_token, body: { body: 'x' } });
      check(
        'banned neighbor1 gets 403 banned on confirm and comment',
        c.status === 403 && c.json.error.code === 'banned' && m.status === 403 && m.json.error.code === 'banned',
        JSON.stringify([c.status, m.status]),
      );
    } finally {
      ban('null');
    }

    // 7
    if (resolved) {
      const r = await api(`/reports/${resolved.id}/confirm`, { method: 'POST', token: neighbor.access_token });
      check('confirming a resolved report is 409', r.status === 409 && r.json.error.code === 'report_resolved', JSON.stringify([r.status, r.json]));
    } else {
      check('confirming a resolved report is 409', false, 'no resolved report in the seed');
    }

    // 7b
    const ghost = await api(`/reports/${crypto.randomUUID()}/confirm`, { method: 'POST', token: neighbor.access_token });
    check(
      'confirming a non-existent report is 404 report_not_found',
      ghost.status === 404 && ghost.json?.error?.code === 'report_not_found',
      JSON.stringify([ghost.status, ghost.json]),
    );
  } finally {
    // 8
    // Each cleanup has its own try/catch so one failure cannot skip the other.
    try {
      if (commentId) {
        const cid = uuid(commentId);
        psql(`delete from public.comments where id = '${cid}'`);
        const left = await sb(`public_comments?select=id&id=eq.${cid}`);
        check('test comment cleaned up', left.length === 0);
      }
    } catch (e) {
      check('test comment cleaned up', false, String(e));
    }
    // Restore neighbor1's confirmation to the starting state (the counter trigger fixes confirm_count).
    try {
      const now = psql(`select count(*) from public.confirmations where report_id = '${reportId}' and user_id = ${n1}`) === '1';
      if (now !== wasConfirmed) {
        psql(
          wasConfirmed
            ? `insert into public.confirmations (report_id, user_id) values ('${reportId}', ${n1})`
            : `delete from public.confirmations where report_id = '${reportId}' and user_id = ${n1}`,
        );
        console.log('! restored neighbor1 confirmation to its starting state');
      }
    } catch (e) {
      check('neighbor1 confirmation restored', false, String(e));
    }
  }
}

try {
  await main();
} catch (e) {
  console.error(e);
  failed++;
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
