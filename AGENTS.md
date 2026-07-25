# AGENTS.md — Pattens

## Architecture

- Build with Next.js, TypeScript, Tailwind CSS, and the local shadcn components.
- The Sites build runs through `npm run build`; `scripts/build-site.js` produces the static app and `dist/server/index.js` worker.
- Keep interactions client-side unless a hosted worker endpoint is essential. The MX lookup uses `/api/mx`; Simulation generation uses `/api/simulate`.
- Never put secrets in client-side code.
- The production DeepSeek credential is managed only in Sites as the `deepseek` secret. The worker may also accept `DEEPSEEK_API_KEY` for compatibility; never add either value to source or local client configuration.

## Data

- `assets/countries.csv` is the country master source. Preserve its exact headers.
- `assets/states.csv` is the state master source. Ambiguous state names must block generation.
- `public/countries.csv` and `public/states.csv` are active development symlinks; retain them.

## UX

- Reuse the established components in `components/ui`, especially `floating-field.tsx` for form fields.
- Inputs are 50px high and labels float into the border on focus or when filled.
- Preserve the warm-neutral workspace, responsive two-column tool layout, and full-width bottom footer.
- Use concise, singular button labels.
- Simulation must remain a responsive two-column setup-and-debate workspace. Keep its audience panel, debate timeline, and final response visible as separate states.

## Validation

- Run `npm test` and `npm run build` after source changes.
- Sanitise client input and keep errors user-friendly.
- MX validation is a domain-level signal only; do not describe it as mailbox verification.
- Simulation is a proposal-grounded scenario exercise, not a forecast or observed audience research. The supplied proposal is the only factual source: generated personas may give opinions or ask open questions, but must not introduce facts, figures, dates, policies, research, or external context.
- Simulation input is capped at 3,000 characters. Accept only the supported 1, 6, and 24 round durations and exactly three validated personas.
