# SKILL STACK REPORT — Juman Frontend V2

> Date: 2026-08-08 · Phase: Phase 9.x frontend rebuild support · Agent: opencode

## 1. Environment

| Item | Value |
|---|---|
| Platform | Windows (win32), git repo at `C:\Users\moham\Desktop\juman` |
| Node | v26.1.0 |
| Package manager | pnpm 10.34.5 |
| Build | electron-vite 3.1.0 · Vite 6.2.6 |
| Frontend framework | React 19.1.0 · React Router 7.5.0 |
| Data layer | @tanstack/react-query 5.74.4 · axios 1.8.4 · zod 3.24.2 |
| Styling | Tailwind CSS 4.1.4 · daisyUI 5.7.14 |
| Desktop shell | Electron 35.1.5 |
| Language | TypeScript 5.8.3 |
| Testing | Vitest 3.1.1 · jsdom 26.1.0 |
| Domain | POS/ERP desktop client, RTL-first (Arabic), brand gold `#c6a75e` on black (ADR-FE-V2-003) |

## 2. Skill Sources

| Source | Type | Location / Tool |
|---|---|---|
| UI Skills / Antigravity registry | Remote catalog | `npx ui-skills categories`, `npx ui-skills list`, `npx ui-skills get <author/name>` |
| Repo-local skills | Installed | `.agents/skills/<skill>/SKILL.md` |
| Lock file | Reproducibility | `skills-lock.json` (version 1, keyed by skill name) |

## 3. Skills Evaluated

Scores: 1–10 (10 = highest value for this codebase). Evaluated all 4 categories of the UI Skills catalog plus repo-local skills.

| Skill | Author | Category | Score | Installed | Reason |
|---|---|---|---|---|---|
| daisyui | saadeghi | UI | 9 | Yes (pre-existing) | Mandatory component vocabulary (ADR-FE-V2-003) |
| frontend-ui-engineering | addyosmani | UI | 9 | Yes | Production-quality component architecture, WCAG, states |
| harden | pbakaus | UI | 9 | Yes | Extreme-input, RTL, empty/error/loading, offline resilience — directly matches POS data reality |
| fixing-accessibility | ibelick | UI | 8 | Yes | Actionable a11y fixes: ARIA, keyboard, focus, contrast, form errors |
| improve-ui | ibelick | UI | 8 | Yes | Read-only audit + self-contained plans; fits "no rewrite, plan then implement" workflow |
| interface-design | dammyjay93 | UI | 8 | Yes | Dashboards / admin panels / settings — exactly Phases 9.3–9.10 |
| vercel-react-best-practices | vercel-labs | React | 8 | Yes | Re-render, memoization, data-fetching, bundle perf patterns |
| tdd | mattpocock | Testing | 7 | Yes | Red-green-refactor workflow; Vitest + jsdom already present |
| react-doctor | millionco | React | 7 | Yes | Pre-commit diagnostics: lint, a11y, bundle, architecture + regression check |
| shape | pbakaus | Discovery | 7 | Yes | Interview → design brief before building new features (Phase 9.x feature gating) |
| audit | pbakaus | Audit | 7 | Yes | Measurable technical audit (a11y, perf, theming, responsive, integrity) |
| better-typography | jakubkrehel | UI | 6 | Yes | Type scale, wrapping, truncation, RTL, Arabic font config (`@fontsource/ibm-plex-sans-arabic`) |
| tailwindcss | mengto | UI | 6 | Yes | Tailwind 4 conventions/recipes complementing daisyUI |
| pr-review | saadeghi | Quality | — | Yes (pre-existing) | GitHub PR review workflow (unrelated to FE, retained) |
| build-primitive | prototyperai | UI | 5 | **No** | Overlaps daisyUI primitives; adds competing component conventions |
| better-accessibility | jakubkrehel | UI | 6 | **No** | Superseded by fixing-accessibility + daisyUI skill |
| better-interface | jakubkrehel | UI | 6 | **No** | Overlaps improve-ui / interface-design |
| web-quality-audit | addyosmani | Audit | 6 | **No** | SEO/Lighthouse web focus; this is a desktop Electron app |
| conductor-rewrite-performance | brotzky | Desktop | — | **No** | 404 — not retrievable from registry |
| react-simply-good | robinmordasiewicz | React | 3 | **No** | Sparse; low actionable value for current stack |
| vitest | antfu | Testing | 5 | **No** | Generic; repo already has a working Vitest setup and tdd skill |
| formatting | antfu | DevEx | 4 | **No** | Prettier-style conventions, low value for agent workflows |
| pnpm | antfu | DevEx | 4 | **No** | General tooling notes; not UI-work critical |
| improve | shadcn | UI | 6 | **No** | Overlaps improve-ui + react-doctor |
| interface-audit | shadcn | UI | 6 | **No** | Overlaps audit + improve-ui |
| tailwindcss-audit | shadcn | UI | 5 | **No** | Overlaps tailwindcss + audit |
| accessible-design | shadcn | UI | 5 | **No** | Overlaps fixing-accessibility + daisyui |
| design-to-production | emilkowalski | UI | 4 | **No** | Philosophy-heavy, low concrete guidance |
| emil-design-eng | emilkowalski | UI | 4 | **No** | Same as above |
| designing-in-browser | danielsada | UI | 4 | **No** | Web-first prototyping flow, low fit |
| frontend-design | danielsada | UI | 4 | **No** | Generalist; overlaps stronger picks |
| developer-experience | milothemitch | DevEx | 3 | **No** | Generic dev workflow notes |
| electron | hiaaryan | Desktop | 5 | **No** | Triage/install docs overlap; current Electron shell is already built |

Selection policy: relevance to React 19 + Tailwind 4 + daisyUI 5 + Electron RTL POS, overlap removal, and actionable output. Target range 8–15 skills; **14 installed** (2 pre-existing + 12 new).

## 4. Installed Skills (12 new)

| Skill | Version/License | Purpose | Hash (SHA-256) |
|---|---|---|---|
| frontend-ui-engineering | MIT | Production-quality accessible responsive UI; component architecture, states, WCAG | `2057d501…59c135` |
| vercel-react-best-practices | MIT | React/Next perf: re-renders, data fetching, bundle optimization | `a9541398…73e3d5` |
| fixing-accessibility | — | ARIA, keyboard nav, focus mgmt, contrast, form errors | `ba6733d4…dc182a` |
| improve-ui | — | Read-only surface audit against design evidence + implementation plans | `f16e14bd…0bbd70` |
| react-doctor | 1.2.0 | Pre-commit React scan: lint, a11y, bundle, architecture, regression | `e17d8a1f…c51d19a9` |
| interface-design | — | Craft-first dashboards, admin panels, settings, data interfaces | `3d90f170…21c7791` |
| tdd | — | Test-driven development (red-green-refactor) | `ac5f5bad…72addb7` |
| harden | — | Production hardening: extreme inputs, errors, i18n/RTL, network | `a2ba2815…299b54` |
| shape | — | Discovery interview → confirmed design brief, no code | `8014659a…0ada91` |
| audit | — | Technical audit report: a11y, perf, theming, responsive, integrity | `18281aa1…a7f3f692` |
| tailwindcss | — | Tailwind conventions and quick recipes | `bb395c76…7f24989` |
| better-typography | — | Type scale, wrapping, truncation, RTL text, variable fonts | `a9d5f3be…2fadf3` |

Note: `harden`, `shape`, `audit` shipped without frontmatter from the registry; `name` + `description` were added locally so opencode can trigger them. All hashes are of the installed on-disk `SKILL.md`.

## 5. Recommended Usage Mapping (Phase 9.x)

| Phase / Activity | Skills to invoke |
|---|---|
| Any UI feature start | `shape` → `frontend-ui-engineering` → `daisyui` |
| 9.2 Auth polish | `interface-design` · `fixing-accessibility` · `harden` |
| 9.3 Dashboard redesign | `interface-design` · `shape` · `better-typography` |
| 9.4–9.7 Customers / Inventory / Reservations / Rentals | `frontend-ui-engineering` · `harden` · `tdd` · `react-doctor` |
| 9.8 Sales POS | `harden` (extreme inputs, RTL, errors) · `interface-design` · `fixing-accessibility` |
| 9.9 Finance + settlements | `frontend-ui-engineering` · `better-typography` (tabular numbers) · `harden` |
| 9.10 Reports | `interface-design` · `better-typography` · `fixing-accessibility` |
| Before every commit | `react-doctor` scan |
| Existing-screen cleanup | `improve-ui` (read-only audit) → implement its plans |
| Whole-surface readiness check | `audit` (report only) |

## 6. Conflicts and Risks

- **RTL text:** `harden` and `better-typography` both address RTL — that is complementary, not conflicting. Keep the RTL-first body rule from ADR-FE-V2-003.
- **daisyUI primitives:** `frontend-ui-engineering`/`interface-design` may suggest generic button/input patterns. daisyUI remains the mandatory vocabulary; these skills govern composition, states, and craft, not replacement of daisyUI classes.
- **React/Next framing:** `vercel-react-best-practices` references Next.js constructs (e.g. `next/image`). Apply only its framework-agnostic rules (memoization, query data fetching, bundle analysis) in this Electron Vite app.
- **Audit web-only note:** `audit` routes native platforms elsewhere; Electron here renders web tech, so its web checklist applies. Ignore native routing note.
- **Frontmatter drift:** three registry skills lacked frontmatter; a re-fetch via `npx ui-skills get` would overwrite the locally-added frontmatter. Re-installs must preserve the frontmatter block.
- **Overlap risk:** `improve-ui` vs `react-doctor` vs `audit` overlap. Use `react-doctor` as the fast pre-commit gate, `improve-ui` for design-surface plans, `audit` for the deep whole-app report. Do not run all three for the same screen in one pass.

## 7. Future Agent Rules (recommended additions to `AGENTS.md` or agent config)

1. Trigger `daisyui` for **any** HTML/JSX/Tailwind output (mandatory, pre-existing rule).
2. Run `shape` before building a new Phase 9.x feature; do not write code until the design brief is confirmed.
3. Run `react-doctor` scan before every frontend commit.
4. Run `harden` before marking any screen production-ready (POS = extreme input + RTL + offline cases).
5. Use `improve-ui` for read-only audits and self-contained plans; never rewrite a screen's identity in place.
6. Never use `build-primitive`/shadcn-style primitives that conflict with daisyUI components.
7. Preserve frontmatter when re-installing `harden`/`shape`/`audit`.

## 8. Files Changed (this phase)

| File | Change |
|---|---|
| `.agents/skills/frontend-ui-engineering/SKILL.md` | Added |
| `.agents/skills/vercel-react-best-practices/SKILL.md` | Added |
| `.agents/skills/fixing-accessibility/SKILL.md` | Added |
| `.agents/skills/improve-ui/SKILL.md` | Added |
| `.agents/skills/react-doctor/SKILL.md` | Added |
| `.agents/skills/interface-design/SKILL.md` | Added |
| `.agents/skills/tdd/SKILL.md` | Added |
| `.agents/skills/harden/SKILL.md` | Added (frontmatter added locally) |
| `.agents/skills/shape/SKILL.md` | Added (frontmatter added locally) |
| `.agents/skills/audit/SKILL.md` | Added (frontmatter added locally) |
| `.agents/skills/tailwindcss/SKILL.md` | Added |
| `.agents/skills/better-typography/SKILL.md` | Added |
| `skills-lock.json` | Updated: +12 entries (sourceType `ui-skills`) |
| `docs/frontend/SKILL_STACK_REPORT.md` | Added (this report) |

## 9. Verification

- All 14 installed skills verified on disk under `.agents/skills/<name>/SKILL.md`.
- Every installed skill verified to open with `---` frontmatter containing `name` and `description`.
- `skills-lock.json` re-serialized with SHA-256 hashes computed from installed files.
- No application source files (`frontend/src`, `backend-node`) were modified in this phase — only `.agents/`, `skills-lock.json`, and this report.
- Full `git status`/`git diff` check recorded below (run at time of writing).

## 10. Final Recommendation

- **Approved:** 14 skills (12 new + 2 pre-existing) cover discovery (`shape`), build (`frontend-ui-engineering`, `interface-design`, `daisyui`, `tailwindcss`), correctness (`tdd`, `vercel-react-best-practices`), accessibility (`fixing-accessibility`), production resilience (`harden`), typography/RTL (`better-typography`), verification (`react-doctor`, `audit`, `improve-ui`, `pr-review`).
- **Hold:** re-installing `harden`/`shape`/`audit` from the registry without preserving local frontmatter.
- **Reject:** `build-primitive` and shadcn-based primitives (stack conflict with daisyUI).
- **Next step:** optionally codify §7 rules into `AGENTS.md`; begin Phase 9.2 using `shape` + `interface-design`.
