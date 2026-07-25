# AGENTS.md — Pattens Email Tools

Guidelines for AI coding agents working on this repository. Respect these standards in every change.

---

## 1. Project Identity

Pattens is a **browser‑only toolkit** for email operations. Four tools share one page:

| Tool | Namespace | Source |
|------|-----------|--------|
| Email Validator | `Pattens.validator` | `src/validator/validator.js` |
| Dynamics Email Converter | `Pattens.converter` | `app.js` |
| Generate (campaigns / links / surveys) | `Pattens.generator` | `generate.js` |
| Logic (country FetchXML) | `Pattens.logic` | `src/logic/logic.js` |
| Theme toggle | `Pattens.theme` | `src/theme/theme.js` |

**No server, no build step, no framework.** Everything is vanilla JS loaded via `<script>` tags in `index.html`.

### 1.1 Logic Tool Rules

- Use `assets/countries.csv` as the only country master source. Its header must be exactly `nor_countryid,nor_name`.
- Do not generate FetchXML unless every entered country is valid and unique.
- Match country input case-, punctuation-, and diacritic-insensitively, but generate with the canonical master-list name and GUID.
- Verify every master GUID and normalized country name before enabling validation.
- XML-escape canonical country names and GUIDs before writing FetchXML.
- Keep the action order **Validate → Generate → Copy**. Only the next available action may use the primary-button treatment.
- Put Logic loading errors in the bottom of the Logic Summary panel, not near the page footer.

---

## 2. Design System — Respect These Exactly

### 2.1 Color Palette (Tailwind custom theme)

These colors are defined in the Tailwind config inside `index.html` and must not be redefined or overridden:

| Token | Value | Usage |
|-------|-------|-------|
| `ink` | `#f8fafc` | Primary text on dark backgrounds |
| `muted` | `#cbd5e1` | Secondary text, placeholders |
| `line` | `rgba(255,255,255,0.12)` | Borders, dividers |
| `panel` | `rgba(8,13,25,0.72)` | Card / panel backgrounds |
| `accent` | `#67e8f9` | Primary action color (cyan) |
| `accentSoft` | `rgba(103,232,249,0.10)` | Active tab / hover state |

**Never introduce new named colors without discussion.** Use the existing tokens.

### 2.2 Typography

- **Headings & UI**: `Plus Jakarta Sans` (weight 500–800)
- **Code & data**: `JetBrains Mono` (weight 400–500)
- Fonts are loaded from Google Fonts via `<link>` tags
- Use `font-sans` and `font-mono` Tailwind classes — the custom config maps them correctly

### 2.3 Themes, Background & Visual Atmosphere

The site has a **dark, cinematic background** composed of:

1. **Radial gradient** at the bottom (`rgba(20,184,166,0.18)` teal glow)
2. **Linear gradient** body (`#070a12 → #111827 → #1a1024`)
3. **Five animated gradient orbs** (`gradient-orb-1` through `gradient-orb-5`) — teal, indigo, amber, pink, sky — blending with `mix-blend-mode: screen` and a `blur(72px)` filter
4. **Bottom glow orb** — large blurred teal circle
5. **Bottom gradient** — linear fade from teal to transparent

**Rules:**
- In dark mode, never remove or alter the background orbs, their colors, or their animation
- The `background-container` div must remain the first child of `<body>`
- All tool panels sit on top via `relative z-10`
- New UI must use `bg-panel` with `backdrop-blur-[18px]` and `border border-line` for cards
- Preserve the dark/light theme toggle. It is icon-only, placed at the far right of the main navigation, and must retain an accurate `aria-label`.
- In light mode, keep the existing warm off-white canvas (`#F5F4F1`), white rounded cards, a single accent color, monochrome outlined icons, and no gradients.

### 2.4 Panel / Card Pattern

Every tool panel follows this exact structure:

```html
<section class="rounded-lg border border-line bg-panel shadow-soft backdrop-blur-[18px]">
  <!-- header bar -->
  <div class="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
    <h2 class="px-2 text-sm font-extrabold text-white">Title</h2>
  </div>
  <!-- scrollable body -->
  <div class="min-h-0 flex-1 overflow-auto p-4">
    <!-- content -->
  </div>
</section>
```

**Reuse this pattern.** Do not invent new panel styles.

Logic input/output panel headers use a `h-14` header for the same vertical rhythm as the main navigation. Keep their content areas padded with `p-4`.

### 2.5 Button Styles

Three button tiers exist — always use one of these:

| Tier | Classes | When to use |
|------|---------|-------------|
| **Primary** | `rounded-lg border border-accent bg-accent text-[#061014] shadow-control` | Main action (Validate, Convert, Generate, Copy) |
| **Secondary** | `rounded-lg border border-white/15 bg-white/10 text-white` | Supporting actions (Upload, Clear, Refresh, CSV) |
| **Tab** | `rounded-md bg-accentSoft text-accent` (active) / `rounded-md text-muted` (inactive) | Navigation tabs |

**Rules:**
- Primary buttons always have `hover:bg-cyan-200`
- Secondary buttons always have `hover:border-accent hover:text-accent`
- Disabled state: `disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none`
- All action buttons are `h-11` tall with `text-sm font-bold`
- Never use `onclick` attributes — use `addEventListener` in JS

### 2.6 Form Inputs

```html
<input class="h-11 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 transition focus:border-accent focus:ring-2 focus:ring-accent/20">
```

Selects use `bg-[#111827]` instead of `bg-black/20`.

### 2.7 Icons

Lucide icons are loaded via CDN. Use them with:
```html
<i data-lucide="icon-name" class="h-4 w-4"></i>
```
After DOM changes call `window.lucide.createIcons()` to re-render.

### 2.8 Status & Error Messaging

- **Status**: `<p id="..." class="hidden text-xs text-muted" role="status">` — toggle `hidden` to show/hide
- **Errors**: `<div id="..." class="hidden rounded-lg border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100">` — toggle `hidden`
- Always clear errors before starting a new operation
- Error messages must be user‑friendly, never expose internals
- Keep errors inside their associated tool's Summary panel whenever one exists; never render tool errors above the global footer.

---

## 3. Code Standards

These reinforce `.github/copilot-instructions.md`. Critical rules:

### 3.1 JavaScript
- **IIFE pattern** for all source modules — no global scope pollution
- **`var` for module‑level variables** (not `let`/`const` — consistency with existing code)
- **Attach to `window.Pattens.{module}`** — every module exposes its API under this namespace
- **Single quotes**, always semicolons
- **JSDoc** on every exported function
- **No ES modules** (`import`/`export`) — the project uses `<script>` tags, no bundler

### 3.2 HTML
- **Minimal inline `<script>` blocks** — pure logic lives in `src/` files
- **Tailwind only** for styling — custom CSS only for animations (`@keyframes`), defined inline in `index.html`
- **Use `addEventListener` for new controls; do not add new `onclick` attributes.**

### 3.3 File Placement

| What | Where |
|------|-------|
| New tool logic | `src/{tool}/` |
| Tests | `__tests__/` (mirror `src/` structure) |
| Test data | `test-fixtures/` |
| Documentation | `docs/` |
| Agent skills | `skills/` |
| Static assets | `assets/` |

---

## 4. Testing Standards

- **Framework**: Jest + jsdom
- **Run**: `npm test`
- **Coverage**: `npm run test:coverage`
- **Pattern**: Load real source via `fs.readFileSync` + `(0, eval)(code)`, access via `Pattens.{module}` namespace
- **Never copy‑paste source code into test files**
- Test both success and failure cases, edge cases, and sanitization

---

## 5. Privacy & Security — Non‑Negotiable

- **All processing is client‑side.** No data ever leaves the browser.
- **Sanitize all user input** — strip `<`, `>`, `"`, `'`, `;`, `\`, newlines, tabs
- **Never log or store email addresses** — not in `console`, not in `localStorage`, not anywhere
- **No tracking, no telemetry, no analytics**
- **No new network requests** — the only fetches are for local bundled assets (including the Logic country CSV), local sample files, and CDN assets (Tailwind, Lucide, fonts)
- If you add a feature that needs a network call, flag it for review

---

## 6. Before Making Changes

1. **Read the relevant docs** in `docs/` (especially `conversion-rules.md` and `dynamics-template-attributes.md` for converter work)
2. **Check `skills/`** for any agent‑skill definitions that apply
3. **Run `npm test`** before and after — all tests must pass
4. **Respect the design system** (section 2 above) — don't invent new colors, panel styles, or button patterns
5. **Keep the single‑page architecture** — don't add new HTML pages or routing

---

## 7. Don'ts

- ❌ Don't add server‑side dependencies (Express, APIs, databases)
- ❌ Don't introduce build steps or bundlers (webpack, vite, etc.)
- ❌ Don't use `console.log()` — use `console.error()` for errors only
- ❌ Don't change the background orbs, colors, or typography
- ❌ Don't copy‑paste source code into tests
- ❌ Don't add new HTML pages — everything lives in `index.html`
- ❌ Don't commit credentials, keys, or secrets
- ❌ Don't remove existing tests unless they're provably invalid
