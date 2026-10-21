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

  // 1b (plan 8) the installable build on :8100: index.html is revalidated also when it answers a deep link
  const deep = await fetch('http://localhost:8100/r/check-cache').catch(() => null);
  if (deep) {
    check(':8100 deep link answers index.html', deep.status === 200 && (deep.headers.get('content-type') ?? '').includes('text/html'));
    check(':8100 deep link is Cache-Control: no-cache', /no-cache/.test(deep.headers.get('cache-control') ?? ''), deep.headers.get('cache-control') ?? 'none');
  }

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
  // Metadata a phone would add, with literal markers so a leak into the output is detectable:
  // an eXIf chunk (TIFF header, then "Exif\0\0" + marker standing in for a GPS tag) and a tEXt chunk.
  if (exif) {
    const tiff = Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0]);
    parts.push(chunk('eXIf', Buffer.concat([tiff, Buffer.from(`Exif\0\0${META_MARKER}\0GPSLatitude=13.7563`)])));
    parts.push(chunk('tEXt', Buffer.from(`Comment\0Exif\0\0${META_MARKER}`)));
  }
  parts.push(chunk('IDAT', deflateSync(raw, { level: noise ? 0 : 6 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

const META_MARKER = 'JAENG-GPS-MARKER';

/** True when the bytes carry no metadata: no marker or "Exif" text, no EXIF/XMP/ICCP chunk, VP8X EXIF flag clear. */
function hasNoMetadata(b) {
  if (b.includes('Exif') || b.includes(META_MARKER)) return false;
  if (b.length < 12 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return false;
  for (let off = 12; off + 8 <= b.length; ) {
    const cc = b.toString('ascii', off, off + 4);
    if (cc === 'EXIF' || cc === 'XMP ' || cc === 'ICCP') return false;
    if (cc === 'VP8X' && (b[off + 8] & 0x08) !== 0) return false; // EXIF flag
    off += 8 + b.readUInt32LE(off + 4) + (b.readUInt32LE(off + 4) & 1);
  }
  return true;
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
      const input = makePng(2400, 1800, { exif: true });
      check('photo: the metadata check fails on the raw input (it can detect a leak)', !hasNoMetadata(input) && input.includes(META_MARKER) && input.includes('Exif'));
      const ok = await upload(token, input);
      firstPhoto = ok.json?.photo_id ? uuid(ok.json.photo_id) : null;
      check('photo: 2400x1800 PNG uploads as 201', ok.status === 201 && !!firstPhoto, JSON.stringify(ok));
      if (!firstPhoto) return;
      const [w, h, blurred, path] = psql(`select width, height, blurred, storage_path from public.report_photos where id = '${firstPhoto}'`).split('|');
      check('photo: row is 1600x1200 and blurred=false', w === '1600' && h === '1200' && blurred === 'f', [w, h, blurred].join(','));
      const full = await svcGet('photos-private', path);
      const size = webpSize(full.bytes);
      check(
        'photo: stored file is image/webp, long side 1600, no marker/Exif/EXIF chunk/VP8X EXIF flag',
        full.status === 200 && full.type === 'image/webp' && size?.w === 1600 && hasNoMetadata(full.bytes),
        JSON.stringify([full.status, full.type, size, hasNoMetadata(full.bytes)]),
      );
      const anonPriv = await fetch(`${BASE}/sb/storage/v1/object/photos-private/${path}`, { headers: { apikey: anon, authorization: `Bearer ${anon}` } });
      check('photo: anon cannot read the photos-private object', anonPriv.status !== 200, `status ${anonPriv.status}`);
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
        `select (public_location = location), (place_name is not null and place_name = public.area_name_at(
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
          `select (extensions.st_distance(location, public_location) between 0.001 and 150), (place_name is not null and place_name = public.area_name_at(
                   extensions.st_x(public_location::extensions.geometry), extensions.st_y(public_location::extensions.geometry))),
                  profanity_flag
             from public.reports where id = '${id}'`,
        ),
      );
      check('hazard: all 3 are within 150 m of the true point and place_name comes from the shifted point', rows.every((r) => r.startsWith('t|t|')), rows.join(' ; '));
      check('hazard: only the rude title is flagged (profanity_flag), and it was still accepted', rows[2] === 't|t|t' && rows[0].endsWith('|f') && rows[1].endsWith('|f'), rows.join(' ; '));
      const mine = await api('/me/reports', { token });
      const allowed = ['id', 'title', 'category', 'danger_level', 'status', 'reject_reason', 'place_name', 'confirm_count', 'comment_count', 'created_at', 'thumb_url'].sort().join();
      const badKeys = (mine.json?.reports ?? []).map((r) => Object.keys(r).sort().join()).filter((k) => k !== allowed);
      check(
        '/me/reports objects have exactly the allowed keys (no lng/lat/location)',
        mine.status === 200 && Array.isArray(mine.json?.reports) && mine.json.reports.length >= 4 && badKeys.length === 0,
        badKeys[0] ?? JSON.stringify(mine.json).slice(0, 300),
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
      const ids = (r) => (r.status === 200 && Array.isArray(r.json?.duplicates) ? r.json.duplicates.map((d) => d.id) : null);
      check('duplicates: finds the open demo road report at its point', ids(here)?.includes(demo.id) === true, JSON.stringify(here));
      check('duplicates: does not return the pending_review report from step 2', ids(here) !== null && !ids(here).includes(roadReport));
      const moved = await dup({ lng: demo.lng, lat: demo.lat + 200 / 111320, category: 'road' });
      check('duplicates: 200 m away finds nothing', ids(moved) !== null && !ids(moved).includes(demo.id), JSON.stringify(moved));
      const other = await dup({ lng: demo.lng, lat: demo.lat, category: 'waste' });
      check('duplicates: another category finds nothing', ids(other) !== null && !ids(other).includes(demo.id), JSON.stringify(other));
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
      // Tag-only match: a middle slice of a tag that the report's title does not contain.
      const tagRow = psql(
        `select r.id, substr(t.name, 2, 2) from public.reports r
           join public.report_tags rt on rt.report_id = r.id join public.tags t on t.id = rt.tag_id
          where r.status in ('open','fix_claimed') and char_length(t.name) >= 4
            and position(substr(t.name, 2, 2) in lower(r.title)) = 0
          order by r.id limit 1`,
      );
      const [tagReportId, tagSlice] = tagRow.split('|');
      if (!tagReportId) {
        check('search: a tag-only middle slice finds the report through its tag', false, 'no demo report with a tag that its title lacks');
      } else {
        const hits = await bbox(tagSlice);
        const hit = hits.find((f) => f.properties.id === tagReportId);
        check('search: a tag-only middle slice finds the report through its tag', !!hit && !hit.properties.title.toLowerCase().includes(tagSlice), `${tagSlice}: ${hits.length} hits`);
      }
    });
  } finally {
    // Cleanup: files first (rows tell us the paths), then the user, whose delete cascades rows.
    try {
      const paths = psql(`select storage_path from public.report_photos where uploader_id = '${uid}'`).split('\n').filter(Boolean);
      // Photos that merge promoted to photos-public (comment photos of this user), listed explicitly.
      const commentPaths = psql(
        `select ph.storage_path from public.comments cm join public.report_photos ph on ph.id = cm.photo_id where cm.author_id = '${uid}'`,
      ).split('\n').filter(Boolean);
      const withThumbs = [...new Set([...paths, ...commentPaths])].flatMap((p) => [p, p.replace(/\.webp$/, '_thumb.webp')]);
      const promoted = commentPaths.flatMap((p) => [p, p.replace(/\.webp$/, '_thumb.webp')]);
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
      const leftover = [];
      for (const p of promoted) {
        const slash = p.lastIndexOf('/');
        const listed = await fetch(`${BASE}/sb/storage/v1/object/list/photos-public`, {
          method: 'POST',
          headers: { ...svcHeaders, 'content-type': 'application/json' },
          body: JSON.stringify({ prefix: p.slice(0, slash), search: p.slice(slash + 1), limit: 10 }),
        }).then((r) => r.json());
        if (!Array.isArray(listed)) leftover.push(`list failed for ${p}`);
        else if (listed.some((o) => o.name === p.slice(slash + 1))) leftover.push(p);
      }
      check(`cleanup: ${promoted.length} promoted photos removed from photos-public`, promoted.length > 0 && leftover.length === 0, JSON.stringify(leftover));
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

// ---------------------------------------------------------------------------------------------
// Plan 5: review, fix claims, flags with auto-hide, hide/restore, bans, admin reads, quotas.
// Three throwaway users (a, b, c) and the demo admin; the demo data is never touched.
// ---------------------------------------------------------------------------------------------

async function plan5() {
  const env = readDotEnv();
  const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
  const PASSWORD = env.DEMO_PASSWORD;
  if (!SERVICE || !PASSWORD) throw new Error('.env needs SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD');
  const FLAG_LIMIT = Number(env.RATE_LIMIT_FLAGS_PER_DAY) || 20;
  const CLAIM_LIMIT = Number(env.RATE_LIMIT_FIX_CLAIMS_PER_DAY) || 10;
  const svcHeaders = { apikey: SERVICE, authorization: `Bearer ${SERVICE}` };
  const anon = (await api('/config')).json?.supabaseAnonKey;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuid = (v) => {
    if (!UUID.test(String(v))) throw new Error(`not a uuid: ${v}`);
    return v;
  };
  const section = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      check(`${label} ran without an error`, false, String(e?.stack ?? e));
    }
  };
  const sb = async (path) => {
    const res = await fetch(`${BASE}/sb/rest/v1/${path}`, { headers: { apikey: anon, authorization: `Bearer ${anon}` } });
    return res.json();
  };
  const fetchStatus = async (url) => (await fetch(url.startsWith('http') ? url : `${BASE}${url}`)).status;
  const PUB = `${BASE}/sb/storage/v1/object/public/photos-public/`;
  const thumbOf = (p) => p.replace(/\.webp$/, '_thumb.webp');

  const ts = Date.now();
  const users = {};
  for (const k of ['a', 'b', 'c']) {
    const email = `check-api5-${ts}-${k}@jaeng.local`;
    const created = await fetch(`${BASE}/sb/auth/v1/admin/users`, {
      method: 'POST',
      headers: { ...svcHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
    });
    const json = await created.json().catch(() => null);
    if (!created.ok || !json?.id) throw new Error(`could not create test user ${k}: ${created.status}`);
    users[k] = { id: uuid(json.id), email };
  }

  try {
    for (const u of Object.values(users)) {
      const login = await fetch(`${BASE}/sb/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: anon, 'content-type': 'application/json' },
        body: JSON.stringify({ email: u.email, password: PASSWORD }),
      });
      u.token = (await login.json().catch(() => null))?.access_token;
    }
    const adminToken = (await api('/dev/quick-login', { method: 'POST', body: { who: 'admin' } })).json?.access_token;
    const adminId = psql(`select id from auth.users where email = 'admin@jaeng.local'`);
    check('plan 5: three test users and the admin can sign in', !!(users.a.token && users.b.token && users.c.token && adminToken));
    if (!users.a.token || !users.b.token || !users.c.token || !adminToken) return;
    const { a, b, c } = users;

    // Each report sits at its own point near the demo area, 400 m apart, so no duplicate check interferes.
    let n = 0;
    const point = () => ({ lng: 100.40 + 0.004 * ++n, lat: 13.60 });
    const photo = async (u) => {
      const form = new FormData();
      form.append('file', new Blob([makePng(320, 240)], { type: 'image/png' }), 'p.png');
      const res = await fetch(`${BASE}/api/photos`, { method: 'POST', headers: { authorization: `Bearer ${u.token}` }, body: form });
      const json = await res.json().catch(() => null);
      if (res.status !== 201) throw new Error(`photo upload failed: ${res.status}`);
      return uuid(json.photo_id);
    };
    const report = async (u, category = 'road') => {
      const r = await api('/reports', { method: 'POST', token: u.token, body: { category, ...point(), photo_ids: [await photo(u)], title: `check-api5 ${category} ${n}` } });
      if (r.status !== 201) throw new Error(`report failed: ${r.status} ${JSON.stringify(r.json)}`);
      return uuid(r.json.report.id);
    };
    const admin = (path, body = {}) => api(`/admin${path}`, { method: 'POST', token: adminToken, body });
    const adminGet = (path) => api(`/admin${path}`, { token: adminToken });
    const pathOf = (photoId) => psql(`select storage_path from public.report_photos where id = '${photoId}'`);
    const coverOf = (reportId) => psql(`select storage_path from public.report_photos where report_id = '${reportId}' and kind = 'before' order by created_at limit 1`);
    const isPublic = async (reportId) => (await sb(`public_reports?select=id&id=eq.${reportId}`)).length === 1;

    let rA1, rA3, rB1;

    // ------------------------------------------------------------------ Step 1: review
    await section('plan 5 review', async () => {
      rA1 = await report(a);
      const asMember = await api(`/admin/reports/${rA1}/approve`, { method: 'POST', token: b.token, body: { location: 'keep' } });
      check('review: a member cannot approve (403 forbidden)', asMember.status === 403 && asMember.json?.error?.code === 'forbidden', JSON.stringify(asMember));

      const queue = await adminGet('/queue?type=reports');
      const item = queue.json?.items?.find((i) => i.id === rA1);
      check('review: the new report is in the review queue', !!item, JSON.stringify(queue.json).slice(0, 300));
      check('review: the queue shows the reporter e-mail', item?.author?.email === a.email, item?.author?.email);
      const signed = item?.photos?.[0]?.url ?? '';
      const img = await fetch(`${BASE}${signed}`);
      check('review: the signed photo URL loads as webp', img.status === 200 && img.headers.get('content-type') === 'image/webp', `${img.status} ${signed}`);

      const race = await Promise.all([admin(`/reports/${rA1}/approve`, { location: 'keep' }), admin(`/reports/${rA1}/approve`, { location: 'keep' })]);
      const statuses = race.map((r) => r.status).sort();
      check('review: two approvals at once: one 200, one 409 invalid_state', statuses[0] === 200 && statuses[1] === 409 &&
        race.find((r) => r.status === 409)?.json?.error?.code === 'invalid_state', JSON.stringify(race));
      check('review: one approve_report log row', psql(`select count(*) from public.moderation_log where action = 'approve_report' and target_id = '${rA1}'`) === '1');
      check('review: approved report is public', await isPublic(rA1));
      const cover = coverOf(rA1);
      check('review: photo moved to the report folder', cover.startsWith(`${rA1}/`), cover);
      check('review: public photo and thumbnail load', (await fetchStatus(`${PUB}${cover}`)) === 200 && (await fetchStatus(`${PUB}${thumbOf(cover)}`)) === 200);
      check('review: the old signed private URL no longer loads', (await fetchStatus(signed)) !== 200);

      const rA2 = await report(a);
      const rej = await admin(`/reports/${rA2}/reject`, { reason: 'other', note: 'พิกัดไม่ชัด' });
      check('review: reject answers ok', rej.status === 200 && rej.json?.ok === true, JSON.stringify(rej));
      const mine = await api('/me/reports', { token: a.token });
      check('review: the reporter sees the note as the reason', mine.json?.reports?.find((r) => r.id === rA2)?.reject_reason === 'พิกัดไม่ชัด');

      rB1 = await report(b, 'hazard');
      await admin(`/reports/${rB1}/approve`, { location: 'exact' });
      check('review: hazard approved as exact shows the true point',
        psql(`select extensions.st_equals(location::extensions.geometry, public_location::extensions.geometry) from public.reports where id = '${rB1}'`) === 't');

      rA3 = await report(a);
      await admin(`/reports/${rA3}/approve`, { location: 'keep', category: 'hazard' });
      const d = Number(psql(`select extensions.st_distance(location, public_location) from public.reports where id = '${rA3}'`));
      check('review: road changed to hazard with keep is moved 0-150 m', d > 0 && d <= 150, String(d));
    });

    // ------------------------------------------------------------------ Step 2: fix claims
    await section('plan 5 fix claims', async () => {
      const p1 = await photo(b);
      const claim = await api(`/reports/${rA1}/fix-claims`, { method: 'POST', token: b.token, body: { note: 'ซ่อมแล้ว', photo_id: p1 } });
      check('claim: 201 with fix_claimed', claim.status === 201 && claim.json?.report?.status === 'fix_claimed', JSON.stringify(claim));
      const claimPath = pathOf(p1);
      check('claim: the claim photo stays private', claimPath.startsWith(`${b.id}/`) && (await fetchStatus(`${PUB}${claimPath}`)) !== 200, claimPath);
      const pr = (await sb(`public_reports?select=photos,days_open&id=eq.${rA1}`))[0];
      check('claim: the claim photo is not in public_reports', !JSON.stringify(pr?.photos ?? []).includes(p1));
      const again = await api(`/reports/${rA1}/fix-claims`, { method: 'POST', token: c.token, body: {} });
      check('claim: a second claim is 409 claim_pending', again.status === 409 && again.json?.error?.code === 'claim_pending', JSON.stringify(again));

      const claimId = claim.json?.claim_id;
      const no = await admin(`/fix-claims/${claimId}/reject`);
      check('claim: reject returns the report to open', no.status === 200 && no.json?.report?.status === 'open', JSON.stringify(no));
      const pr2 = (await sb(`public_reports?select=days_open&id=eq.${rA1}`))[0];
      check('claim: days_open did not restart', pr2?.days_open === pr?.days_open, `${pr?.days_open} -> ${pr2?.days_open}`);

      const p2 = await photo(b);
      const claim2 = await api(`/reports/${rA1}/fix-claims`, { method: 'POST', token: b.token, body: { photo_id: p2 } });
      const yes = await admin(`/fix-claims/${claim2.json?.claim_id}/approve`);
      check('claim: approve resolves the report', yes.status === 200 && yes.json?.report?.status === 'resolved', JSON.stringify(yes));
      const afterPath = pathOf(p2);
      const pr3 = (await sb(`public_reports?select=photos&id=eq.${rA1}`))[0];
      check('claim: the after photo is public', pr3?.photos?.some((x) => x.path === afterPath && x.kind === 'after') && (await fetchStatus(`${PUB}${afterPath}`)) === 200, afterPath);
      const late = await api(`/reports/${rA1}/fix-claims`, { method: 'POST', token: c.token, body: {} });
      check('claim: a resolved report is 409 already_resolved', late.status === 409 && late.json?.error?.code === 'already_resolved', JSON.stringify(late));
    });

    // ------------------------------------------------------------------ Step 3: flags, auto-hide, ban
    await section('plan 5 flags', async () => {
      const cover = coverOf(rA3);
      const flag = (u, body) => api('/flags', { method: 'POST', token: u.token, body });
      for (let i = 0; i < 3; i++) await flag(a, { target_type: 'report', target_id: rA3, reason: 'spam' });
      check('flags: one person flagging three times does not hide', await isPublic(rA3));
      await flag(b, { target_type: 'report', target_id: rA3, reason: 'false' });
      const third = await flag(c, { target_type: 'report', target_id: rA3, reason: 'privacy', note: 'มีหน้าคน' });
      check('flags: the third person hides it', third.status === 201 && third.json?.hidden === true, JSON.stringify(third));
      check('flags: hidden report leaves the public map', !(await isPublic(rA3)));
      check('flags: hidden photo no longer loads publicly', (await fetchStatus(`${PUB}${cover}`)) !== 200);
      const mine = await api('/me/reports', { token: a.token });
      const thumb = mine.json?.reports?.find((r) => r.id === rA3)?.thumb_url;
      check('flags: the reporter still sees the thumbnail (signed)', !!thumb && (await fetchStatus(thumb)) === 200, thumb);

      const q = await adminGet('/queue?type=flags');
      const item = q.json?.items?.find((i) => i.target_id === rA3);
      check('flags: one queue item with three flags, hidden', item?.flags?.length === 3 && item?.hidden === true, JSON.stringify(item).slice(0, 300));
      const dz = await admin(`/flags/${item?.flag_id}/resolve`, { action: 'dismiss' });
      check('flags: dismiss restores the report', dz.status === 200 && (await isPublic(rA3)), JSON.stringify(dz));
      check('flags: the photo loads publicly again', (await fetchStatus(`${PUB}${cover}`)) === 200);

      const cm = await api(`/reports/${rB1}/comments`, { method: 'POST', token: b.token, body: { body: 'check-api5 ความเห็น' } });
      const commentId = cm.json?.comment?.id;
      await flag(a, { target_type: 'comment', target_id: commentId, reason: 'personal_attack' });
      const cq = await adminGet('/queue?type=flags');
      const citem = cq.json?.items?.find((i) => i.target_id === commentId);
      check('flags: the comment owner is b', citem?.author?.id === b.id, JSON.stringify(citem?.author));
      const ban = await admin(`/flags/${citem?.flag_id}/resolve`, { action: 'ban' });
      check('flags: ban answers 200', ban.status === 200, JSON.stringify(ban));
      check('flags: the comment leaves public_comments', (await sb(`public_comments?select=id&id=eq.${commentId}`)).length === 0);
      const blocked = await api(`/reports/${rB1}/comments`, { method: 'POST', token: b.token, body: { body: 'ยังอยู่ไหม' } });
      check('flags: a banned user cannot comment (403 banned)', blocked.status === 403 && blocked.json?.error?.code === 'banned', JSON.stringify(blocked));
      await admin(`/users/${b.id}/unban`);
      const back = await api(`/reports/${rB1}/comments`, { method: 'POST', token: b.token, body: { body: 'กลับมาแล้ว' } });
      check('flags: after unban b can comment', back.status === 201, JSON.stringify(back));
      const self = await admin(`/users/${adminId}/ban`);
      check('flags: banning the admin is 409 cannot_ban_admin', self.status === 409 && self.json?.error?.code === 'cannot_ban_admin', JSON.stringify(self));
    });

    // ------------------------------------------------------------------ Step 4: hide/restore, reads, guards
    await section('plan 5 admin reads', async () => {
      await admin('/hide', { target_type: 'report', target_id: rB1 });
      const hidden = await adminGet('/queue?type=hidden');
      check('hide: the report is in the hidden list', hidden.json?.items?.some((i) => i.target_id === rB1));
      await admin('/restore', { target_type: 'report', target_id: rB1 });
      check('restore: the report is public again', await isPublic(rB1));

      const counts = await adminGet('/counts');
      const [r, cl, f] = psql(`select (select count(*) from public.reports where status = 'pending_review'),
        (select count(*) from public.fix_claims fc join public.reports r on r.id = fc.report_id where fc.status = 'pending' and r.status = 'fix_claimed'),
        (select count(*) from (select distinct target_type, target_id from public.flags where status = 'open') s)`).split('|').map(Number);
      check('reads: counts match the database', counts.json?.reports === r && counts.json?.claims === cl && counts.json?.flags === f, JSON.stringify([counts.json, r, cl, f]));
      const found = await adminGet(`/users?q=check-api5-${ts}`);
      check('reads: user search finds the three test users', found.json?.users?.length === 3, JSON.stringify(found.json).slice(0, 200));
      const log = await adminGet('/log');
      const actions = new Set((log.json?.entries ?? []).map((e) => e.action));
      const want = ['approve_report', 'reject_report', 'approve_claim', 'reject_claim', 'auto_hide', 'dismiss_flags', 'hide', 'restore', 'ban', 'unban'];
      check('reads: the log has every action', want.every((x) => actions.has(x)), [...actions].join(','));
      check('reads: auto_hide is by the system', (log.json?.entries ?? []).some((e) => e.action === 'auto_hide' && e.target_id === rA3 && e.admin_name === null));

      const routes = [['GET', '/admin/counts'], ['GET', '/admin/queue?type=reports'], ['GET', '/admin/users'], ['GET', '/admin/log'],
        ['POST', `/admin/reports/${rB1}/approve`], ['POST', '/admin/hide'], ['POST', `/admin/users/${a.id}/ban`]];
      let bad = [];
      for (const [method, path] of routes) {
        const m = await api(path, { method, token: a.token, body: method === 'POST' ? {} : undefined });
        const none = await api(path, { method, body: method === 'POST' ? {} : undefined });
        if (m.status !== 403 || none.status !== 401) bad.push(`${method} ${path}: ${m.status}/${none.status}`);
      }
      check('guards: every /admin route is 403 for members and 401 without a token', bad.length === 0, bad.join('; '));
    });

    // ------------------------------------------------------------------ Step 5: quotas
    await section('plan 5 quotas', async () => {
      const used = Number(psql(`select count(*) from public.flags where reporter_id = '${c.id}' and created_at > now() - interval '24 hours'`));
      psql(`insert into public.flags (target_type, target_id, reporter_id, reason, status)
            select 'report', gen_random_uuid(), '${c.id}', 'spam', 'dismissed' from generate_series(1, ${FLAG_LIMIT - used - 1})`);
      const last = await api('/flags', { method: 'POST', token: c.token, body: { target_type: 'report', target_id: rB1, reason: 'spam' } });
      const over = await api('/flags', { method: 'POST', token: c.token, body: { target_type: 'report', target_id: rA3, reason: 'spam' } });
      check(`quota: flag ${FLAG_LIMIT} is 201, the next 429`, last.status === 201 && over.status === 429, `${last.status} ${over.status}`);

      const cUsed = Number(psql(`select count(*) from public.fix_claims where claimant_id = '${c.id}' and created_at > now() - interval '24 hours'`));
      psql(`insert into public.fix_claims (report_id, claimant_id, status)
            select '${rA1}', '${c.id}', 'rejected' from generate_series(1, ${CLAIM_LIMIT - cUsed - 1})`);
      const lastClaim = await api(`/reports/${rB1}/fix-claims`, { method: 'POST', token: c.token, body: {} });
      const overClaim = await api(`/reports/${rA3}/fix-claims`, { method: 'POST', token: c.token, body: {} });
      check(`quota: fix claim ${CLAIM_LIMIT} is 201, the next 429`, lastClaim.status === 201 && overClaim.status === 429, `${lastClaim.status} ${overClaim.status}`);
    });
  } finally {
    // Cleanup: files of the test users' photos in both buckets, their private folders, the log rows
    // about their things, then the users (everything else cascades).
    try {
      const ids = Object.values(users).map((u) => `'${u.id}'`).join(',');
      const paths = psql(`select storage_path from public.report_photos ph
                          where ph.uploader_id in (${ids}) or ph.report_id in (select id from public.reports where author_id in (${ids}))`)
        .split('\n').filter(Boolean);
      const names = paths.flatMap((p) => [p, thumbOf(p)]);
      for (const bucket of ['photos-private', 'photos-public']) {
        let all = names;
        if (bucket === 'photos-private') {
          for (const u of Object.values(users)) {
            const listed = await fetch(`${BASE}/sb/storage/v1/object/list/${bucket}`, {
              method: 'POST',
              headers: { ...svcHeaders, 'content-type': 'application/json' },
              body: JSON.stringify({ prefix: u.id, limit: 1000 }),
            });
            const items = listed.ok ? await listed.json() : [];
            all = [...all, ...items.map((i) => `${u.id}/${i.name}`)];
          }
        }
        if (all.length > 0) {
          await fetch(`${BASE}/sb/storage/v1/object/${bucket}`, {
            method: 'DELETE',
            headers: { ...svcHeaders, 'content-type': 'application/json' },
            body: JSON.stringify({ prefixes: [...new Set(all)] }),
          });
        }
      }
      psql(`delete from public.moderation_log where target_id in (
              select id from public.reports where author_id in (${ids})
              union select id from public.comments where author_id in (${ids})
              union select unnest(array[${ids}]::uuid[]))`);
      for (const u of Object.values(users)) {
        await fetch(`${BASE}/sb/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: svcHeaders });
      }
      const rows = psql(`select (select count(*) from public.profiles where id in (${ids})) + (select count(*) from public.reports where author_id in (${ids}))`);
      check('plan 5 cleanup: no rows of the test users left', rows === '0', rows);
    } catch (e) {
      check('plan 5 cleanup ran', false, String(e));
    }
  }
}

// Plan 6: the place finder and the profile language.
async function plan6() {
  const started = Date.now();
  const found = await api(`/places?q=${encodeURIComponent('เชียงใหม่')}`);
  const took = Date.now() - started;
  check(
    'plan 6: GET /places finds a local district or province within 6 s',
    found.status === 200 && found.json?.places?.some((p) => p.source === 'local') && took < 6000,
    `${found.status} ${took} ms ${JSON.stringify(found.json)?.slice(0, 200)}`,
  );
  check('plan 6: GET /places?q=x -> 400', (await api('/places?q=x')).status === 400);
  const moreStarted = Date.now();
  const more = await api(`/places?q=${encodeURIComponent('ท่าแพ')}&more=1`);
  const moreTook = Date.now() - moreStarted;
  check(
    'plan 6: GET /places?more=1 answers within 5 s (OpenStreetMap or online:false)',
    more.status === 200 && Array.isArray(more.json?.places) && typeof more.json?.online === 'boolean' && moreTook < 5000,
    `${more.status} ${moreTook} ms`,
  );

  const reporter = (await api('/dev/quick-login', { method: 'POST', body: { who: 'reporter' } })).json;
  if (!reporter?.access_token) {
    check('plan 6: quick login as reporter', false);
    return;
  }
  const me = `(select id from auth.users where email='reporter@jaeng.local')`;
  try {
    const res = await api('/me', { method: 'PATCH', token: reporter.access_token, body: { locale: 'en' } });
    check('plan 6: PATCH /me {locale:en} -> 200', res.status === 200 && res.json?.locale === 'en', JSON.stringify(res));
    check('plan 6: profiles.locale is en', psql(`select locale from public.profiles where id = ${me}`) === 'en');
  } finally {
    psql(`update public.profiles set locale = 'th' where id = ${me}`);
  }
}

// Plan 7: the Android app runs at http://localhost and calls this server across origins.
async function plan7() {
  const APP = 'http://localhost';
  for (const site of ['http://localhost:8000', 'http://localhost:8100']) {
    const pre = await fetch(`${site}/api/reports`, {
      method: 'OPTIONS',
      headers: { origin: APP, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, content-type' },
    });
    const h = (name) => pre.headers.get(name) ?? '';
    check(`plan 7: ${site} preflight for the app -> 204`, pre.status === 204, String(pre.status));
    check(`plan 7: ${site} preflight allows the app origin, methods and headers`,
      h('access-control-allow-origin') === APP &&
        ['GET', 'POST', 'PATCH'].every((m) => h('access-control-allow-methods').includes(m)) &&
        ['authorization', 'content-type'].every((x) => h('access-control-allow-headers').toLowerCase().includes(x)),
      JSON.stringify([...pre.headers]));
    const own = await fetch(`${site}/api/health`, { headers: { origin: APP } });
    check(`plan 7: ${site} /api answers the app with its origin`, own.headers.get('access-control-allow-origin') === APP);
    const evil = await fetch(`${site}/api/health`, { headers: { origin: 'http://evil.example' } });
    check(`plan 7: ${site} /api gives another origin no CORS header`, evil.headers.get('access-control-allow-origin') === null);
  }
  // supabase-js (sign-in, storage, realtime setup) calls /sb with its own headers; two values would be refused
  const sbPre = await fetch(`${BASE}/sb/auth/v1/token`, {
    method: 'OPTIONS',
    headers: { origin: 'http://localhost', 'access-control-request-method': 'POST', 'access-control-request-headers': 'apikey, content-type, x-client-info' },
  });
  const allowOrigin = sbPre.headers.get('access-control-allow-origin') ?? '';
  check('plan 7: /sb preflight has exactly one allowed origin', /^(\*|http:\/\/localhost)$/.test(allowOrigin), `${sbPre.status} "${allowOrigin}"`);
}

try {
  await main();
  await plan4();
  await plan5();
  await plan6();
  await plan7();
} catch (e) {
  console.error(e);
  failed++;
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
