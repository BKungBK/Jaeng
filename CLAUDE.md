# Jaeng (แจ้ง)

Community issue-reporting web app: reports show on a Thai map as beams; neighbours confirm ("เจอเหมือนกัน"), comment, and track fixes. Owner chats in Thai.

Source of truth: `docs/superpowers/specs/2026-10-16-jaeng-design.md`. Roadmap and per-plan docs: `docs/superpowers/plans/`. UI design system: `DESIGN.md`, `PRODUCT.md`, `.impeccable/`.

## Layout

- `apps/web/` Angular 22 + Ionic 9 + Capacitor, MapLibre GL. Code in `src/app/`:
  - `core/` services (api, auth, supabase, realtime, categories, device) and guards
  - `features/` `map`, `report-new`, `report-detail`, `auth`, `me`, `admin`
  - `shared/`, `theme/`; specs (`*.spec.ts`, Vitest) sit next to the code
- `apps/api/` Elysia on Bun. `src/routes/` (reports, photos, me, moderation, admin, dev), `src/photos/` (pipeline, privacy, storage, sweeper), `src/moderation/`, `store.ts` + `supabase-store.ts`. Tests in `apps/api/test/` (`bun test`).
- `packages/shared/` types and logic used by both apps (`api.ts`, `report.ts`, `levels.ts`, `beam.ts`, `admin.ts`, `categories.ts`). `database.types.ts` is generated; never edit it by hand.
- `supabase/` `migrations/`, pgTAP `tests/`, `seed/`, `config.toml`.
- `scripts/` every dev task (below). `infra/Caddyfile` reverse proxy. `docker-webui/` is a separate tool, not part of the app.

## Commands (run in WSL, at /mnt/d/Project/Jaeng)

Always `export PATH="$HOME/.local/node/bin:$PATH"` first (Linux Node 22, never Windows node).

- `bash scripts/dev-up.sh` / `bash scripts/dev-down.sh` start and stop the stack. App: http://localhost:8000, Mailpit: :54324
- `bash scripts/test.sh` runs everything: shared, api, web (inside the `web` container), db (pgTAP), seed, api live, comment race
- `bash scripts/reset-db.sh` resets the DB and reloads the 40 demo reports (not `supabase db reset`)
- `bash scripts/mail-mode.sh resend|mailpit|status` where login codes go: Resend (real inboxes, key in `supabase/.env`, git-ignored) or Mailpit (:54324); edits `enabled` under `[auth.email.smtp]` in `supabase/config.toml`, then `bash scripts/dev-up.sh`. Commit it as `resend`.
- `bash scripts/gen-types.sh` regenerates `packages/shared/database.types.ts` after a migration
- Run one suite only when possible, e.g. api: `docker run --rm --dns 1.1.1.1 --dns 8.8.8.8 --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/repo -w /repo/apps/api oven/bun:1 bun test` (same as `bun_in` in `scripts/test.sh`)

## Gotchas

- From PowerShell, put bash in a scratchpad script (path as `/mnt/c/...`) and run it with `wsl`; inline `bash -c` gets mangled.
- Never read/write Thai text with PowerShell 5.1 `Get-Content`/`Set-Content`; use the Read/Write/Edit tools.
- Web Vitest from `/mnt/d` times out; run web tests through `scripts/test.sh` (container).
- Docker containers need `--dns 1.1.1.1 --dns 8.8.8.8`.
- After a checkout that recreates `apps/` or `packages/`: `docker compose up -d --force-recreate api web caddy`.
- WSL shuts down with no attached process; keep a background `wsl -e bash -c "sleep 86400"` while the stack runs.
- WSL is capped at 4 GB RAM; avoid running extra heavy processes alongside `test.sh`.

## Working rules

- Reply to the owner in Thai.
- Never use `prefers-reduced-motion`.
- Implement plans inline; do not hand implementation to subagents.
- Keep changes scoped; read only the files a task needs.
