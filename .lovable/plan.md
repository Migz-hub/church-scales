## Goal

Eliminate the 3 critical security findings by replacing the localStorage mock backend with real Supabase Auth + Postgres tables guarded by Row-Level Security (RLS). All authentication, authorization, and data persistence move server-side.

## Why this is large

The current app keeps every entity (users, ministries, members, schedules, assignments, chat, notifications, announcements, unavailabilities, history, join requests) in a single `localStorage` JSON blob via `src/services/db.ts`. Sessions and roles are also there, so anyone can edit `localStorage` to impersonate or escalate privileges. Fixing this requires:

- A full Supabase schema (~13 tables) with RLS.
- Replacing `authService` with Supabase Auth.
- Rewriting all 9 service files to query Supabase instead of the mock DB.
- Removing the mock DB entirely.

## Phased plan (each phase = one approval/checkpoint)

### Phase 1 — Database schema + RLS (single migration)

Create tables in `public`:

- `profiles` (id = auth.users.id, name, email, created_at) — auto-created by trigger on `auth.users` insert.
- `app_role` enum: `owner | admin | leader | member`.
- `user_roles` (user_id, ministry_id, role) — separate table, never on profile (security best practice).
- `ministries` (name, invite_code, invites_enabled, owner_id, created_at).
- `ministry_members` (ministry_id, user_id, joined_at) — membership presence; role lives in `user_roles`.
- `ministry_join_requests` (ministry_id, user_id, status, decided_by, timestamps).
- `ministry_functions`, `ministry_teams`, `ministry_team_functions` (M2M), `ministry_defaults`, `member_permissions`.
- `schedules`, `schedule_agenda_items`, `schedule_assignments`.
- `chat_messages`.
- `notifications`.
- `announcements`, `announcement_reads`.
- `unavailabilities`.
- `schedule_history`.

Security primitives:

- `has_role(_user_id uuid, _ministry_id uuid, _role app_role) returns boolean` — `SECURITY DEFINER`, `SET search_path = public`. Used in policies to avoid recursion.
- `is_member_of(_user_id uuid, _ministry_id uuid) returns boolean` — same pattern.
- Trigger `handle_new_user()` on `auth.users` insert → creates `profiles` row.
- Trigger to auto-create `user_roles(role='owner')` and `ministry_members` row when a ministry is inserted.
- `update_updated_at_column()` trigger function for any tables that need it.

RLS shape (applied per table):

- `profiles`: readable by any authenticated user (needed to render names/emails in member lists, schedules, chat); update only own row.
- `ministry_members`, `user_roles`: readable by members of the same ministry; insert/delete gated by `has_role(auth.uid(), ministry_id, 'owner'|'admin')`.
- `ministries`: readable by members; update/delete by owner/admin.
- `schedules`, `assignments`, `agenda`, `chat_messages`, `notifications`, `announcements`, `unavailabilities`, `history`, `functions`, `teams`, `defaults`, `permissions`: readable by ministry members; write actions gated by `has_role(...)` matching the existing permission matrix in `src/lib/permissions.ts`.
- `notifications`: each user sees only their own rows.
- `ministry_join_requests`: requester can read own; admins/owner of target ministry can read all and update status.

### Phase 2 — Auth migration

- Replace `src/services/authService.ts` to call `supabase.auth.signUp / signInWithPassword / signOut / resetPasswordForEmail / updateUser`.
- Update `src/contexts/AuthContext.tsx` to use `supabase.auth.onAuthStateChange` (subscribe FIRST, then call `getSession()`), per Supabase guidance.
- `signUp` passes `emailRedirectTo: window.location.origin`.
- Add `/redefinir-senha` (reset password) page that calls `supabase.auth.updateUser({ password })`.
- `ForgotPassword` calls `resetPasswordForEmail` with `redirectTo: ${origin}/redefinir-senha`.
- Profile editing (`updateProfile`, `changePassword`, `deleteAccount`) routed through Supabase Auth + `profiles` table.
- Delete `hashPassword`, `Session` interface, all localStorage session reads.

### Phase 3 — Data services rewrite

Rewrite each service to use the Supabase client (RLS enforces access; no service-role usage on the client):

- `ministryService` — list/create/get + invite-code lookup, join, leave, role changes, join requests.
- `ministryAdminService` — functions/teams/defaults/permissions CRUD.
- `scheduleService` — schedules + agenda + assignments + confirm/decline + attendance.
- `chatService` — messages list/send + Supabase Realtime subscription.
- `notificationService` — list/mark-read.
- `announcementService` — announcements + reads.
- `unavailabilityService` — CRUD + overlap queries used by scheduling.
- `scheduleHistoryService` — history insert/list.

### Phase 4 — Cleanup + removal

- Delete `src/services/db.ts` and `STORAGE_KEYS.db`, `STORAGE_KEYS.session`.
- Keep `STORAGE_KEYS.activeMinistry` (UI preference only — safe in localStorage).
- Remove all `Pick<User,...>` snapshots from types where they were workarounds for the mock DB; resolve names via `profiles` joins instead.
- Verify `MinistryContext` still works (now driven by `user_roles` + `ministry_members`).
- Run security scan again to confirm the 3 critical findings clear.

### Out of scope for this migration

- The 2 Supabase linter warnings about `rls_auto_enable` (you asked to leave them open).
- Visual/UX changes — pages keep their current layout and copy.
- Email branding/templates — Supabase defaults are used.

## Important notes

- **You will need to enable Email auth in Supabase** (Authentication → Providers → Email) and likely disable email confirmation for testing, or confirm via the link Supabase sends. I'll remind you when we get there.
- **Existing localStorage data is lost.** The mock data does not migrate — users will need to sign up again and re-create ministries. There is no production data to preserve since this was a prototype.
- Each phase ends with a checkpoint so you can test before moving on. Phase 1 is database-only (no UI breakage); Phases 2–4 progressively swap behavior.

## Approval gate

If you approve, I'll start with **Phase 1**: I'll call the migration tool with the full schema + RLS + triggers, you approve it in the Supabase prompt, then I move to Phase 2. Phases 2–4 are code edits I'll batch and ask you to test after each.
