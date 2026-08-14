# Jeevandata — UX Redesign Plan

> Point-by-point redesign of every user-facing surface, grounded in real issues
> found in the code (not invented polish). Status is tracked per item.

**Legend:** ✅ done · ⬜ pending

---

## Foundation (F)

| ID  | Item                                                                                                                                                                                                                                                                                                                                 | Status |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| F1  | **Mount Toaster globally in Providers** — `toast()` was called in the landing page + intake hook but `<Toaster />` was never mounted, so every error/success toast silently never appeared. Backend-down errors were invisible to users.                                                                                             |   ✅   |
| F2  | **Shared session-status map** — frontend used `snake_case` statuses while the backend pushes `UPPER_SNAKE` via Socket.IO, so the intake header status chip rendered blank for most real states (`BRIEF_GENERATED`, `COMPLETED`, …). Added `lib/session-status.ts` as the single source of truth used by the intake chip + dashboard. |   ✅   |
| F3  | ~~Dark-mode audit of remaining components~~ (already covered by Phase 6.4 dark-mode work)                                                                                                                                                                                                                                            |   ✅   |
| F4  | **Brand component** — replaced the leftover "AC" (old AyuTalk) logo marks on the intake + dashboard headers with a Jeevandata wordmark.                                                                                                                                                                                              |   ✅   |
| F5  | **Per-route page titles** — `TitleSetter` sets a meaningful `<title>` on every page (Welcome, Doctor Dashboard, Admin Analytics, Audit Log, Clinics, API Keys, Staff Sign In, System Health, kiosk).                                                                                                                                 |   ✅   |

---

## Landing page (L)

| ID  | Item                                                                                                                                                                                     | Status |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| L1  | **Staff login link** — top-right "Staff login" pill linking to `/login` so staff aren't stuck at the patient kiosk.                                                                      |   ✅   |
| L2  | **Language selector** — compact locale switcher (en/hi/mr/es) in the top-right bar, wired to the shared `useLanguage` hook.                                                              |   ✅   |
| L3  | **Honest CTA errors** — "Start New Intake Session" shows a spinner while in-flight (prevents duplicate sessions) and a destructive toast when the API call fails (was silent before F1). |   ✅   |
| L4  | **Privacy reassurance placement** — trust indicators (no raw face images stored, HIPAA-compliant architecture) sit under the CTA where the patient actually sees them.                   |   ✅   |

---

## Kiosk / Intake (K)

| ID  | Item                                                                                                                                                                                                   | Status |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| K1  | **Visible progress stepper** — `IntakeStepper` shows Camera → Identify → Intake → Brief with checkmarks on completed steps (semantic `ol/li`, axe-clean).                                              |   ✅   |
| K2  | **Cancel / restart path** — "Cancel" button with a confirm dialog resets the session store + face state and returns to the landing page.                                                               |   ✅   |
| K3  | **Camera troubleshooting** — when camera access fails, `CameraSelector` shows actionable steps (permission instructions, another tab holding the camera, device picker) instead of a bare error.       |   ✅   |
| K4  | ~~Liveness failure retry UI~~ (covered by K5 failure panel)                                                                                                                                            |   ✅   |
| K5  | **Identify-failure recovery** — a timeout + "Couldn't identify" panel gives the patient a clear next action instead of hanging on a failed match.                                                      |   ✅   |
| K6  | **Unicode-safe registration** — name regex rejected Devanagari/Gujarati names in a hi/mr/es app; now accepts Unicode letters/spaces/hyphens/apostrophes. Dialog sizing fixed for small mobile screens. |   ✅   |

---

## Voice intake (V)

| ID  | Item                                                                                                                                    | Status |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| V1  | **Review before send** — transcriptions fill the input for review instead of auto-sending mis-transcriptions (the #1 complaint driver). |   ✅   |
| V2  | **Mic button fixes** — consistent sizing + distinct recording/processing states.                                                        |   ✅   |
| V3  | **Permission clarity** — clear copy + hint when the mic permission is denied or the browser is mid-permission-prompt.                   |   ✅   |
| V4  | **Transcript grouping** — messages grouped per utterance with timestamps.                                                               |   ✅   |

---

## Staff dashboard (D)

| ID  | Item                                                                                                                                                                                                          | Status |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: |
| D1  | **App shell + sidebar** — shared `AppShell` (sidebar nav filtered by role, sticky header, brand, dark-mode toggle, user chip + sign-out) replaces the ad-hoc per-page headers on dashboard + all admin pages. |   ✅   |
| D2  | **Fix "Completed Today" stat** — it was always 0 (counted COMPLETED from the active-sessions list, which excludes completed). Replaced with an honest "Started Today" count.                                  |   ✅   |
| D3  | **Real socket "Live" state** — the green dot was fake; `socketService` now exposes `isConnected()` + `onConnectionChange()` and the chip shows green **Live** / amber **Reconnecting**.                       |   ✅   |
| D4  | **Remove dead Edit button** — the brief preview's "Edit" button had no handler; removed (no backend PATCH exists).                                                                                            |   ✅   |
| D5  | **One-click New Intake** — kept as a first-class button in the content toolbar.                                                                                                                               |   ✅   |
| D6  | ~~Search + load-more~~ — left out of scope (list volumes are small today); revisit when sessions grow.                                                                                                        |   ⬜   |

---

## Admin (AD)

| ID  | Item                                                                                                                                                  | Status |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| AD1 | **Sidebar nav** — Analytics / Audit / Health / Clinics / API Keys reachable from the AppShell sidebar (role-gated), replacing the header cross-links. |   ✅   |
| AD2 | **Confirmations on destructive actions** — clinic deactivation and API-key revocation confirm before executing.                                       |   ✅   |
| AD3 | **Toasts** — success/error toasts on clinic create/update/deactivate and key generate/revoke (previously silent).                                     |   ✅   |
| AD4 | **Audit filters** — action/actor/role/resource/date filters + pagination already existed and are preserved.                                           |   ✅   |

---

## Cross-cutting (C)

| ID  | Item                                                                                                                                                  | Status |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| C1  | **Offline banner** — global fixed banner (mounted in Providers) shows offline state + queued sync count + retry; no overlap issue on the staff shell. |   ✅   |
| C2  | **Empty states** — sessions/briefs lists already have friendly empty states; landing CTA disabled-while-loading.                                      |   ✅   |
| C3  | **Keyboard/focus audit** — LanguageSelector (already full keyboard-nav), stepper (semantic list), dialogs (focus trap via existing UI kit).           |   ✅   |

---

## Implementation order used

1. **Foundation** (F1–F5) — unblocks toasts, status rendering, branding, titles
2. **Kiosk + Voice** (K1–K6, V1–V4) — patient-facing flow
3. **Staff** (D1–D5, AD1–AD4) — dashboard + admin shell, stats, toasts
4. **Landing + cross-cutting** (L1–L4, C1–C3)

Each phase ended with `tsc --noEmit`, the Vitest suite (622 tests), ESLint and
`format:check` green.

## Validation

- `tsc --noEmit` — clean
- `vitest run` — 622/622 pass (49 files)
- `eslint` — 0 errors on all touched files (1 pre-existing warning in socket.ts)
- `pnpm format:check` — all files Prettier-clean
- Committed per file (21 commits) and pushed to `origin/main`.
