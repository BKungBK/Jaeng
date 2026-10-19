import {
  LOCATION_MODES,
  REJECT_NOTE_MAX,
  type FlagAction,
  type FlagTarget,
  type LocationMode,
  type ModerationEffect,
  type RejectReason,
} from '@jaeng/shared/admin';
import { CATEGORY_SLUGS, type CategorySlug } from '@jaeng/shared/categories';
import { inThailand, REJECT_REASONS, TITLE_MAX } from '@jaeng/shared/report';
import { Elysia } from 'elysia';
import { requireAdmin } from '../auth';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { applyEffect } from '../moderation/effects';
import { parseNote, parseTargetId } from './moderation';
import { asObject, type Raw, UUID } from './reports';

function parseItemId(id: string): string {
  if (!UUID.test(id)) throw new ApiError('item_not_found');
  return id;
}

function parseTarget(raw: Raw): { type: FlagTarget; id: string } {
  const type = raw.target_type;
  if (type !== 'report' && type !== 'comment') throw new ApiError('invalid_request');
  return { type, id: parseTargetId(type, raw.target_id) };
}

/** Absent or null = keep the current value. */
function parseEdits(raw: Raw) {
  const location = raw.location;
  if (typeof location !== 'string' || !(LOCATION_MODES as readonly string[]).includes(location)) {
    throw new ApiError('invalid_request');
  }
  let lng: number | null = null;
  let lat: number | null = null;
  if (location === 'point') {
    if (typeof raw.lng !== 'number' || typeof raw.lat !== 'number' || !Number.isFinite(raw.lng) || !Number.isFinite(raw.lat) ||
        !inThailand(raw.lng, raw.lat)) {
      throw new ApiError('invalid_location');
    }
    lng = raw.lng;
    lat = raw.lat;
  }
  let category: CategorySlug | null = null;
  if (raw.category !== undefined && raw.category !== null) {
    if (typeof raw.category !== 'string' || !(CATEGORY_SLUGS as readonly string[]).includes(raw.category)) {
      throw new ApiError('invalid_report');
    }
    category = raw.category as CategorySlug;
  }
  let danger: number | null = null;
  if (raw.danger_level !== undefined && raw.danger_level !== null) {
    const d = raw.danger_level;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 3) throw new ApiError('invalid_report');
    danger = d;
  }
  let title: string | null = null;
  if (raw.title !== undefined && raw.title !== null) {
    if (typeof raw.title !== 'string') throw new ApiError('invalid_report');
    const t = raw.title.trim();
    if ([...t].length > TITLE_MAX) throw new ApiError('invalid_report');
    title = t.length === 0 ? null : t;
  }
  return { category, danger, title, location: location as LocationMode, lng, lat };
}

// Admin actions (spec 3.10). Every route checks the admin role again; the database decides the
// state, and the API only moves the files it listed and broadcasts afterwards.
export function adminRoutes(deps: AppDeps) {
  const admin = (authorization: string | undefined) => requireAdmin(authorization, deps.verify, deps.store);
  const done = async (effect: ModerationEffect) => {
    await applyEffect(deps, effect);
    return { report: effect.report };
  };

  return new Elysia({ prefix: '/admin' })
    .post('/reports/:id/approve', async ({ params, headers, body }) => {
      const me = await admin(headers.authorization);
      const id = parseTargetId('report', params.id);
      return done(await deps.store.approveReport(me.id, id, parseEdits(asObject(body))));
    })
    .post('/reports/:id/reject', async ({ params, headers, body }) => {
      const me = await admin(headers.authorization);
      const id = parseTargetId('report', params.id);
      const raw = asObject(body);
      if (typeof raw.reason !== 'string' || !(REJECT_REASONS as readonly string[]).includes(raw.reason)) {
        throw new ApiError('invalid_request');
      }
      const note = parseNote(raw.note, REJECT_NOTE_MAX);
      await applyEffect(deps, await deps.store.rejectReport(me.id, id, raw.reason as RejectReason, note));
      return { ok: true };
    })
    .post('/fix-claims/:id/approve', async ({ params, headers }) => {
      const me = await admin(headers.authorization);
      return done(await deps.store.reviewFixClaim(me.id, parseItemId(params.id), true));
    })
    .post('/fix-claims/:id/reject', async ({ params, headers }) => {
      const me = await admin(headers.authorization);
      return done(await deps.store.reviewFixClaim(me.id, parseItemId(params.id), false));
    })
    .post('/flags/:id/resolve', async ({ params, headers, body }) => {
      const me = await admin(headers.authorization);
      const id = parseItemId(params.id);
      const action = asObject(body).action;
      if (action !== 'dismiss' && action !== 'hide' && action !== 'ban') throw new ApiError('invalid_request');
      return done(await deps.store.resolveFlags(me.id, id, action as FlagAction));
    })
    .post('/hide', async ({ headers, body }) => {
      const me = await admin(headers.authorization);
      const t = parseTarget(asObject(body));
      return done(await deps.store.hide(me.id, t.type, t.id));
    })
    .post('/restore', async ({ headers, body }) => {
      const me = await admin(headers.authorization);
      const t = parseTarget(asObject(body));
      return done(await deps.store.restore(me.id, t.type, t.id));
    })
    .post('/users/:id/ban', async ({ params, headers }) => {
      const me = await admin(headers.authorization);
      await applyEffect(deps, await deps.store.setBan(me.id, parseItemId(params.id), true));
      return { ok: true };
    })
    .post('/users/:id/unban', async ({ params, headers }) => {
      const me = await admin(headers.authorization);
      await applyEffect(deps, await deps.store.setBan(me.id, parseItemId(params.id), false));
      return { ok: true };
    });
}
