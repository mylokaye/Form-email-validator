# AGENTS.md — Pattens

## Architecture

- Build with Next.js, TypeScript, Tailwind CSS, and the local shadcn components.
- The Sites build runs through `npm run build`; `scripts/build-site.js` produces the static app and `dist/server/index.js` worker.
- Keep interactions client-side unless a hosted worker endpoint is essential. The MX lookup uses `/api/mx`.
- Never put secrets in client-side code.

## Data

- `assets/countries.csv` is the country master source. Preserve its exact headers.
- `assets/states.csv` is the state master source. Ambiguous state names must block generation.
- `public/countries.csv` and `public/states.csv` are active development symlinks; retain them.

## UX

- Reuse the established components in `components/ui`, especially `floating-field.tsx` for form fields.
- Inputs are 50px high and labels float into the border on focus or when filled.
- Preserve the warm-neutral workspace, responsive two-column tool layout, and full-width bottom footer.
- Use concise, singular button labels.

## Validation

- Run `npm test` and `npm run build` after source changes.
- Sanitise client input and keep errors user-friendly.
- MX validation is a domain-level signal only; do not describe it as mailbox verification.
