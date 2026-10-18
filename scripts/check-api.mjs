// Live API check against the running stack (http://localhost:8000). Run: node scripts/check-api.mjs
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const BASE = 'http://localhost:8000';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
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

// ---------------------------------------------------------------------------------------------
// Plan 4: photos, report creation, quotas, profanity, duplicates, orphan sweeper, search.
// Everything runs as a throwaway user so the 5 reports/day quota never touches the demo users.
// ---------------------------------------------------------------------------------------------

function readDotEnv() {
  const out = {};
  for (const line of readFileSync(`${ROOT}.env`, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 8-bit RGB PNG built with node:zlib only. `noise` gives incompressible pixels (stored deflate). */
function makePng(w, h, { noise = false, exif = false } = {}) {
  const stride = 1 + w * 3;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    if (noise) {
      randomBytes(w * 3).copy(raw, row + 1);
      continue;
    }
    for (let x = 0; x < w; x++) {
      const i = row + 1 + x * 3;
      raw[i] = Math.floor((x * 255) / w);
      raw[i + 1] = Math.floor((y * 255) / h);
      raw[i + 2] = Math.floor(((x + y) * 255) / (w + h));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr)];
  // Empty big-endian TIFF header with one IFD: the "metadata" a phone would add.
  if (exif) parts.push(chunk('eXIf', Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0])));
  parts.push(chunk('IDAT', deflateSync(raw, { level: noise ? 0 : 6 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/** Width and height of a WebP file (lossy, lossless or extended). */
function webpSize(b) {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  return null;
}

async function plan4() {
  const env = readDotEnv();
  const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
  const PASSWORD = env.DEMO_PASSWORD;
  if (!SERVICE || !PASSWORD) throw new Error('.env needs SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD');
  const REPORT_LIMIT = Number(env.RATE_LIMIT_REPORTS_PER_DAY) || 5;
  const COMMENT_LIMIT = Number(env.RATE_LIMIT_COMMENTS_PER_DAY) || 30;
  const svcHeaders = { apikey: SERVICE, authorization: `Bearer ${SERVICE}` };

  const anon = (await api('/config')).json?.supabaseAnonKey;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuid = (v) => {
    if (!UUID.test(String(v))) throw new Error(`not a uuid: ${v}`);
    return v;
  };

  // A section failing (throwing) must not hide the others.
  const section = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      check(`${label} ran without an error`, false, String(e?.stack ?? e));
    }
  };

  const upload = async (token, bytes, { name = 'photo.png', type = 'image/png' } = {}) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    const res = await fetch(`${BASE}/api/photos`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: form });
    return { status: res.status, json: await res.json().catch(() => null) };
  };

  const email = `check-api-${Date.now()}@jaeng.local`;
  const created = await fetch(`${BASE}/sb/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...svcHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const createdJson = await created.json().catch(() => null);
  if (!created.ok || !createdJson?.id) throw new Error(`could not create the test user: ${created.status} ${JSON.stringify(createdJson)}`);
  const uid = uuid(createdJson.id);

  // Demo report counters, read up front so the cleanup can prove the cascade restored them.
  let demo = null;
  let demoBefore = null;
  const userDbCounts = () => psql(`select confirm_count || '|' || comment_count from public.reports where id = '${demo?.id}'`);

  try {
    const login = await fetch(`${BASE}/sb/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const token = (await login.json().catch(() => null))?.access_token;
    check('throwaway test user can sign in', !!token);
    if (!token) return;

    // Demo rows used by the duplicate and merge checks.
    const [roadId, roadLng, roadLat] = psql(
      `select r.id, extensions.st_x(r.public_location::extensions.geometry), extensions.st_y(r.public_location::extensions.geometry)
         from public.reports r join public.categories c on c.id = r.category_id
        where c.slug = 'road' and r.status = 'open' order by r.created_at limit 1`,
    ).split('|');
    const resolvedRoad = psql(
      `select r.id from public.reports r join public.categories c on c.id = r.category_id
        where c.slug = 'road' and r.status = 'resolved' limit 1`,
    );
    if (!roadId) {
      check('found an open road report in the demo data', false, 'run scripts/reset-db.sh');
      return;
    }
    demo = { id: uuid(roadId), lng: Number(roadLng), lat: Number(roadLat) };
    demoBefore = userDbCounts();

    const small = makePng(320, 240);
    const newPhoto = async (bytes = small) => {
      const r = await upload(token, bytes);
      if (r.status !== 201) throw new Error(`photo upload failed: ${r.status} ${JSON.stringify(r.json)}`);
      return uuid(r.json.photo_id);
    };
    const createReport = (body) => api('/reports', { method: 'POST', token, body });
    const svcGet = async (bucket, path) => {
      const res = await fetch(`${BASE}/sb/storage/v1/object/${bucket}/${path}`, { headers: svcHeaders });
      return { status: res.status, type: res.headers.get('content-type'), bytes: Buffer.from(await res.arrayBuffer()) };
    };

    // ------------------------------------------------------------------ Step 1: photos
    let firstPhoto = null;
    await section('photo upload', async () => {
      const ok = await upload(token, makePng(2400, 1800, { exif: true }));
      firstPhoto = ok.json?.photo_id ? uuid(ok.json.photo_id) : null;
      check('photo: 2400x1800 PNG uploads as 201', ok.status === 201 && !!firstPhoto, JSON.stringify(ok));
      if (!firstPhoto) return;
      const [w, h, blurred, path] = psql(`select width, height, blurred, storage_path from public.report_photos where id = '${firstPhoto}'`).split('|');
      check('photo: row is 1600x1200 and blurred=false', w === '1600' && h === '1200' && blurred === 'f', [w, h, blurred].join(','));
      const full = await svcGet('photos-private', path);
      const size = webpSize(full.bytes);
      check(
        'photo: stored file is image/webp, long side 1600, no Exif',
        full.status === 200 && full.type === 'image/webp' && size?.w === 1600 && !full.bytes.includes('Exif'),
        JSON.stringify([full.status, full.type, size, full.bytes.includes('Exif')]),
      );
      const thumb = await svcGet('photos-private', path.replace(/\.webp$/, '_thumb.webp'));
      check('photo: thumbnail is 400 wide', thumb.status === 200 && webpSize(thumb.bytes)?.w === 400, JSON.stringify([thumb.status, webpSize(thumb.bytes)]));
      const pub = await fetch(`${BASE}/sb/storage/v1/object/public/photos-public/${path}`);
      check('photo: not readable from photos-public', pub.status !== 200, `status ${pub.status}`);

      const text = await upload(token, Buffer.from('this is not an image\n'), { name: 'x.jpg', type: 'image/jpeg' });
      check('photo: text file named x.jpg is 415 invalid_photo', text.status === 415 && text.json?.error?.code === 'invalid_photo', JSON.stringify(text));
      const big = await upload(token, makePng(1200, 1000, { noise: true }));
      check('photo: file over 3 MB is 413', big.status === 413, JSON.stringify(big));
      const noTok = await upload(null, small);
      check('photo: no token is 401', noTok.status === 401, JSON.stringify(noTok));

      // Over the 4 MB server cap Bun answers a bare 413 (maybe not JSON), or drops the connection.
      // Bun refuses on the Content-Length header alone and then drops the socket, so a client that keeps
      // streaming 4.5 MB can lose the answer to a reset (EPIPE). Declare the size but send only the start.
      const boundary = `----check${Date.now()}`;
      const head = Buffer.from(`--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="huge.png"\r\ncontent-type: image/png\r\n\r\n`);
      const status = await new Promise((resolve) => {
        const req = httpRequest(
          `${BASE}/api/photos`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': `multipart/form-data; boundary=${boundary}`,
              'content-length': 4 * 1024 * 1024 + 1024,
              expect: '100-continue', // like curl: the refusal arrives before any body is sent
            },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode);
            req.destroy();
          },
        );
        req.on('error', (e) => resolve(`no response: ${e.code ?? e}`));
        req.on('continue', () => req.write(head));
        setTimeout(() => req.destroy(), 5000).unref();
      });
      check('photo: request body over 4 MB is 413', status === 413, String(status));
    });

    // ------------------------------------------------------------------ Step 2: create a road report
    let roadReport = null;
    await section('create report', async () => {
      if (!firstPhoto) throw new Error('no photo from step 1');
      const r = await createReport({ category: 'road', lng: demo.lng, lat: demo.lat, photo_ids: [firstPhoto] });
      roadReport = r.json?.report?.id ? uuid(r.json.report.id) : null;
      check('report: road is 201 pending_review', r.status === 201 && r.json?.report?.status === 'pending_review' && !!roadReport, JSON.stringify(r));
      if (!roadReport) return;
      const row = psql(
        `select (public_location = location), (place_name is not distinct from public.area_name_at(
                 extensions.st_x(location::extensions.geometry), extensions.st_y(location::extensions.geometry)))
           from public.reports where id = '${roadReport}'`,
      );
      check('report: road keeps its true point and place_name matches area_name_at', row === 't|t', row);
      const res = await fetch(`${BASE}/sb/rest/v1/public_reports?select=id&id=eq.${roadReport}`, { headers: { apikey: anon, authorization: `Bearer ${anon}` } });
      check('report: pending report is not in public_reports for anon', (await res.json()).length === 0);
      const mine = await api('/me/reports', { token });
      const found = mine.json?.reports?.find((x) => x.id === roadReport);
      check('report: /me/reports lists it', mine.status === 200 && !!found, JSON.stringify(mine.json));
      if (found?.thumb_url) {
        const t = await fetch(found.thumb_url.startsWith('/') ? `${BASE}${found.thumb_url}` : found.thumb_url);
        check('report: /me/reports thumb_url loads as image/webp', t.status === 200 && t.headers.get('content-type') === 'image/webp', `${t.status} ${t.headers.get('content-type')}`);
      } else {
        check('report: /me/reports thumb_url loads as image/webp', false, `thumb_url=${found?.thumb_url}`);
      }
      const again = await createReport({ category: 'road', lng: demo.lng, lat: demo.lat, photo_ids: [firstPhoto] });
      const count = psql(`select count(*) from public.reports where author_id = '${uid}'`);
      check('report: resubmitting the same photo_ids is 400 invalid_photos with one report in the DB', again.status === 400 && again.json?.error?.code === 'invalid_photos' && count === '1', JSON.stringify([again, count]));
    });

    // ------------------------------------------------------------------ Step 3 + 5a: hazards (third has a rude title)
    await section('hazard reports', async () => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const photo = await newPhoto();
        const body = { category: 'hazard', lng: 100.5018 + i * 0.01, lat: 13.7563 + i * 0.01, photo_ids: [photo] };
        if (i === 2) body.title = 'this road is bullshit';
        const r = await createReport(body);
        if (r.status !== 201) throw new Error(`hazard ${i} not created: ${JSON.stringify(r)}`);
        ids.push(uuid(r.json.report.id));
      }
      const rows = ids.map((id) =>
        psql(
          `select (extensions.st_distance(location, public_location) <= 150), (place_name is not distinct from public.area_name_at(
                   extensions.st_x(public_location::extensions.geometry), extensions.st_y(public_location::extensions.geometry))),
                  profanity_flag
             from public.reports where id = '${id}'`,
        ),
      );
      check('hazard: all 3 are within 150 m of the true point and place_name comes from the shifted point', rows.every((r) => r.startsWith('t|t|')), rows.join(' ; '));
      check('hazard: only the rude title is flagged (profanity_flag), and it was still accepted', rows[2] === 't|t|t' && rows[0].endsWith('|f') && rows[1].endsWith('|f'), rows.join(' ; '));
      const mine = await api('/me/reports', { token });
      const text = JSON.stringify(mine.json);
      check(
        '/me/reports exposes no lng/lat or location',
        mine.status === 200 && mine.json.reports.length >= 4 && mine.json.reports.every((r) => !('lng' in r) && !('lat' in r)) && !/location|"lng"|"lat"/.test(text),
        text.slice(0, 300),
      );
    });

    // ------------------------------------------------------------------ Step 5: profanity and display name
    await section('profanity', async () => {
      const before = psql(`select comment_count from public.reports where id = '${demo.id}'`);
      const rude = await api(`/reports/${demo.id}/comments`, { method: 'POST', token, body: { body: 'what the fuck' } });
      const after = psql(`select comment_count from public.reports where id = '${demo.id}'`);
      check('profanity: rude comment is 422 profanity and comment_count is unchanged', rude.status === 422 && rude.json?.error?.code === 'profanity' && before === after, JSON.stringify([rude, before, after]));

      const bad = await api('/me', { method: 'PATCH', token, body: { display_name: 'bitch ass' } });
      check('profanity: PATCH /me with a rude name is 422', bad.status === 422 && bad.json?.error?.code === 'profanity', JSON.stringify(bad));
      const short = await api('/me', { method: 'PATCH', token, body: { display_name: 'ก' } });
      check('profanity: PATCH /me with a 1-character name is 400', short.status === 400 && short.json?.error?.code === 'invalid_display_name', JSON.stringify(short));
      const good = await api('/me', { method: 'PATCH', token, body: { display_name: 'เพื่อนบ้านทดสอบ' } });
      const stored = psql(`select display_name from public.profiles where id = '${uid}'`);
      check('profanity: PATCH /me with a good name is 200 and profiles.display_name changes', good.status === 200 && stored === 'เพื่อนบ้านทดสอบ', JSON.stringify([good, stored]));
      const direct = await fetch(`${BASE}/sb/rest/v1/profiles?id=eq.${uid}`, {
        method: 'PATCH',
        headers: { apikey: anon, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ display_name: 'แก้ตรง' }),
      });
      const afterDirect = psql(`select display_name from public.profiles where id = '${uid}'`);
      check('profanity: editing display_name straight through PostgREST is refused', direct.status >= 400 && afterDirect === 'เพื่อนบ้านทดสอบ', `${direct.status} ${afterDirect}`);
    });

    // ------------------------------------------------------------------ Step 6: duplicates and merge
    await section('duplicates and merge', async () => {
      const dup = (body) => api('/reports/check-duplicate', { method: 'POST', token, body });
      const here = await dup({ lng: demo.lng, lat: demo.lat, category: 'road' });
      check('duplicates: finds the open demo road report at its point', here.status === 200 && here.json.duplicates.some((d) => d.id === demo.id), JSON.stringify(here));
      check('duplicates: does not return the pending_review report from step 2', !here.json?.duplicates?.some((d) => d.id === roadReport));
      const moved = await dup({ lng: demo.lng, lat: demo.lat + 200 / 111320, category: 'road' });
      check('duplicates: 200 m away finds nothing', moved.status === 200 && !moved.json.duplicates.some((d) => d.id === demo.id), JSON.stringify(moved));
      const other = await dup({ lng: demo.lng, lat: demo.lat, category: 'waste' });
      check('duplicates: another category finds nothing', other.status === 200 && !other.json.duplicates.some((d) => d.id === demo.id), JSON.stringify(other));
      const zero = await dup({ lng: 0, lat: 0, category: 'road' });
      check('duplicates: (0,0) is 400 invalid_location', zero.status === 400 && zero.json?.error?.code === 'invalid_location', JSON.stringify(zero));

      const [c0, m0] = psql(`select confirm_count, comment_count from public.reports where id = '${demo.id}'`).split('|').map(Number);
      const photo = await newPhoto();
      const merge = await api(`/reports/${demo.id}/merge`, { method: 'POST', token, body: { photo_ids: [photo] } });
      const photoPath = merge.json?.comment?.photo_path ?? '';
      check(
        'merge: new photo is 200, confirm_count +1, comment photo_path under the report id, comment_count +1',
        merge.status === 200 && merge.json.report?.confirm_count === c0 + 1 && merge.json.report?.comment_count === m0 + 1 && photoPath.startsWith(`${demo.id}/`),
        JSON.stringify(merge),
      );
      const pub = photoPath ? await fetch(`${BASE}/sb/storage/v1/object/public/photos-public/${photoPath}`) : { status: 0, headers: new Headers() };
      check('merge: public URL of the merged photo is 200', pub.status === 200, `status ${pub.status}`);
      const dbNow = psql(`select confirm_count, comment_count from public.reports where id = '${demo.id}'`);
      check('merge: counters in the DB agree', dbNow === `${c0 + 1}|${m0 + 1}`, dbNow);

      const photo2 = await newPhoto();
      const merge2 = await api(`/reports/${demo.id}/merge`, { method: 'POST', token, body: { photo_ids: [photo2] } });
      check('merge: second merge by the same user keeps confirm_count (no un-confirm)', merge2.status === 200 && merge2.json.report?.confirm_count === c0 + 1 && merge2.json.confirmed === true, JSON.stringify(merge2));

      if (resolvedRoad) {
        const photo3 = await newPhoto();
        const res = await api(`/reports/${uuid(resolvedRoad)}/merge`, { method: 'POST', token, body: { photo_ids: [photo3] } });
        check('merge: resolved report is 409', res.status === 409, JSON.stringify(res));
      } else {
        check('merge: resolved report is 409', false, 'no resolved road report in the seed');
      }
    });

    // ------------------------------------------------------------------ Step 4: concurrent quota
    await section('quotas', async () => {
      // Make earlier reports old enough to drop out of the 24 h window, so exactly REPORT_LIMIT remain.
      psql(`update public.reports set created_at = now() - interval '3 days' where author_id = '${uid}'`);
      const photos = [];
      for (let i = 0; i < REPORT_LIMIT + 1; i++) photos.push(await newPhoto());
      const results = await Promise.all(
        photos.map((p, i) => createReport({ category: 'other', lng: 100.5 + i * 0.001, lat: 13.7, photo_ids: [p] })),
      );
      const ok = results.filter((r) => r.status === 201).length;
      const limited = results.filter((r) => r.status === 429 && r.json?.error?.code === 'rate_limited').length;
      const inDb = psql(`select count(*) from public.reports where author_id = '${uid}' and created_at > now() - interval '24 hours'`);
      check(
        `quota: ${REPORT_LIMIT + 1} parallel POST /reports give ${REPORT_LIMIT}x 201 and 1x 429`,
        ok === REPORT_LIMIT && limited === 1 && inDb === String(REPORT_LIMIT),
        JSON.stringify({ ok, limited, inDb, statuses: results.map((r) => r.status) }),
      );

      // Comments: leave exactly one of the daily quota.
      const used = Number(psql(`select count(*) from public.comments where author_id = '${uid}' and created_at > now() - interval '24 hours'`));
      const fill = COMMENT_LIMIT - 1 - used;
      if (fill > 0) {
        psql(`insert into public.comments (report_id, author_id, body) select '${demo.id}', '${uid}', 'quota filler' from generate_series(1, ${fill})`);
      }
      const c1 = await api(`/reports/${demo.id}/comments`, { method: 'POST', token, body: { body: 'ความคิดเห็นสุดท้ายของวัน' } });
      const c2 = await api(`/reports/${demo.id}/comments`, { method: 'POST', token, body: { body: 'ความคิดเห็นเกินโควตา' } });
      check(
        'quota: with 1 comment left the API accepts one (201) then answers 429 rate_limited',
        c1.status === 201 && c2.status === 429 && c2.json?.error?.code === 'rate_limited',
        JSON.stringify([c1.status, c2.status, c2.json]),
      );
    });

    // ------------------------------------------------------------------ Step 7: orphan sweeper
    await section('orphan sweeper', async () => {
      const oldId = crypto.randomUUID();
      const newId = crypto.randomUUID();
      psql(
        `insert into public.report_photos (id, report_id, uploader_id, kind, storage_path, width, height, created_at) values
           ('${oldId}', null, '${uid}', 'before', '${uid}/${oldId}.webp', 10, 10, now() - interval '2 days'),
           ('${newId}', null, '${uid}', 'before', '${uid}/${newId}.webp', 10, 10, now() - interval '1 hour')`,
      );
      execFileSync('docker', ['compose', 'restart', 'api'], { cwd: ROOT, stdio: 'ignore' });
      let healthy = false;
      for (let i = 0; i < 60 && !healthy; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        healthy = await fetch(`${BASE}/api/health`).then((r) => r.ok, () => false);
      }
      check('sweeper: api is healthy again after the restart', healthy);
      let oldGone = false;
      for (let i = 0; i < 20 && !oldGone; i++) {
        oldGone = psql(`select count(*) from public.report_photos where id = '${oldId}'`) === '0';
        if (!oldGone) await new Promise((r) => setTimeout(r, 500));
      }
      const newLeft = psql(`select count(*) from public.report_photos where id = '${newId}'`);
      check('sweeper: the 2-day-old orphan is deleted and the 1-hour-old one stays', oldGone && newLeft === '1', JSON.stringify({ oldGone, newLeft }));
    });

    // ------------------------------------------------------------------ Step 8: search with special characters
    await section('search', async () => {
      const bbox = async (q) => {
        const res = await fetch(`${BASE}/sb/rest/v1/rpc/reports_in_bbox`, {
          method: 'POST',
          headers: { apikey: anon, authorization: `Bearer ${anon}`, 'content-type': 'application/json' },
          body: JSON.stringify({ min_lng: -180, min_lat: -90, max_lng: 180, max_lat: 90, q }),
        });
        const json = await res.json();
        return json?.features ?? [];
      };
      const all = await bbox(null);
      check('search: whole-world baseline returns the demo reports', all.length > 1, `${all.length}`);
      for (const ch of ['%', '_']) {
        const hits = await bbox(ch);
        check(
          `search: q='${ch}' is literal, not a wildcard`,
          hits.length < all.length && hits.every((f) => f.properties.title.includes(ch)),
          `${hits.length} of ${all.length}`,
        );
      }
      const mid = await bbox('โรง');
      check('search: middle of a tag/title (โรง) finds the hazard near the school', mid.some((f) => f.properties.category === 'hazard' && f.properties.title.includes('โรงเรียน')), mid.map((f) => f.properties.title).join(' | '));
    });
  } finally {
    // Cleanup: files first (rows tell us the paths), then the user, whose delete cascades rows.
    try {
      const paths = psql(`select storage_path from public.report_photos where uploader_id = '${uid}'`).split('\n').filter(Boolean);
      const withThumbs = paths.flatMap((p) => [p, p.replace(/\.webp$/, '_thumb.webp')]);
      for (const bucket of ['photos-private', 'photos-public']) {
        let names = withThumbs;
        if (bucket === 'photos-private') {
          const listed = await fetch(`${BASE}/sb/storage/v1/object/list/${bucket}`, {
            method: 'POST',
            headers: { ...svcHeaders, 'content-type': 'application/json' },
            body: JSON.stringify({ prefix: uid, limit: 1000 }),
          });
          const items = listed.ok ? await listed.json() : [];
          names = [...names, ...items.map((i) => `${uid}/${i.name}`)];
        }
        await fetch(`${BASE}/sb/storage/v1/object/${bucket}`, {
          method: 'DELETE',
          headers: { ...svcHeaders, 'content-type': 'application/json' },
          body: JSON.stringify({ prefixes: [...new Set(names)] }),
        });
      }
      const left = await fetch(`${BASE}/sb/storage/v1/object/list/photos-private`, {
        method: 'POST',
        headers: { ...svcHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ prefix: uid, limit: 10 }),
      }).then((r) => r.json());
      check('cleanup: test user storage objects removed', Array.isArray(left) && left.length === 0, JSON.stringify(left));
    } catch (e) {
      check('cleanup: test user storage objects removed', false, String(e));
    }
    try {
      const del = await fetch(`${BASE}/sb/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: svcHeaders });
      check('cleanup: test user deleted', del.ok, `status ${del.status}`);
      const rows = psql(
        `select (select count(*) from public.profiles where id = '${uid}') + (select count(*) from public.reports where author_id = '${uid}')
              + (select count(*) from public.comments where author_id = '${uid}') + (select count(*) from public.report_photos where uploader_id = '${uid}')`,
      );
      check('cleanup: cascade left no rows of the test user', rows === '0', rows);
      if (demo && demoBefore) {
        const now = userDbCounts();
        check('cleanup: demo report counters are back to their starting values', now === demoBefore, `${demoBefore} -> ${now}`);
      }
    } catch (e) {
      check('cleanup: test user deleted', false, String(e));
    }
  }
}

try {
  await main();
  await plan4();
} catch (e) {
  console.error(e);
  failed++;
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
