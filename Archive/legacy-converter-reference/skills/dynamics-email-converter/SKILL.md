---
name: dynamics-email-converter
description: Analyze third-party HTML emails and plan safe conversion to Dynamics 365 Customer Insights - Journeys compatible HTML. Use when reviewing email HTML, identifying editable regions, classifying blocks, adding documented Dynamics attributes, or producing warnings for risky conversion cases.
---

# Dynamics Email Converter

## Purpose

Use this skill to build and maintain a helper for converting third-party HTML emails into Dynamics 365 Customer Insights - Journeys compatible HTML.

The converter improves editability and highlights risks. It must not claim perfect Dynamics or email-client compatibility.

## When To Use

Use this skill when:

- Reviewing or changing converter architecture.
- Designing parser rules for imported email HTML.
- Classifying email blocks as text, image, button-like, preserved, or unsupported.
- Adding documented Dynamics attributes to improve Designer editability.
- Writing warning output for risky structures.
- Updating docs, fixtures, schemas, or tests for conversion behavior.

Do not use this skill as proof that generated HTML will render perfectly in all email clients or Dynamics environments.

## Input Expectations

Expected inputs may include:

- Raw third-party HTML email.
- Existing Dynamics email HTML.
- Parser output or block classification data.
- Proposed conversion diffs.
- Warnings, fixtures, schemas, or documentation updates.

Before changing behavior, read:

- `../../docs/dynamics-template-attributes.md`
- `../../docs/conversion-rules.md`

Use `../../docs/review-notes.md` for live-source review context and known gaps. Use `../../docs/raw/custom-template-attributes-raw.md` only when comparing against the captured Microsoft source.

## Conversion Workflow

1. Analyze the source email HTML.
2. Identify layout boundaries, especially tables, table cells, conditional comments, VML, and tracked links.
3. Identify safe editable regions. Prefer stable content inside `<td>` or existing block containers.
4. Classify blocks conservatively:
   - `Text`: simple headings, paragraphs, and inline formatting.
   - `Image`: simple standalone `<img>` or `<a><img></a>` patterns.
   - `Button-like`: styled links, table buttons, VML/HTML button pairs.
   - `Existing Dynamics block`: any block with `data-editorblocktype`.
   - `Unsupported`: forms, scripts, widgets, unknown custom elements, or structures crossing table boundaries.
5. Add only documented Dynamics attributes where allowed by the conversion rules.
6. Preserve layout-critical markup before improving editability.
7. Produce warnings instead of destructive rewrites when the safe conversion is unclear.
8. Validate converted output before presenting it as copy-ready HTML.

Keep implementation stages separated:

- `src/analyser/` classifies source structure.
- `src/converter/` performs conservative wrapper insertion.
- `src/validator/` checks converted output and reports issues.

## Use Of Project Docs

Use `../../docs/dynamics-template-attributes.md` to confirm documented Dynamics attributes, designer settings, examples, and limitations.

Use `../../docs/conversion-rules.md` as the source of truth for parser and rewrite behavior. Follow its rule structure: purpose, detection logic, input example, output example, notes, and edge cases.

When docs and code disagree, stop and update the docs or add a warning before changing converter behavior.

## Required Output Format

For plans, reviews, and parser output, prefer this shape:

- **Summary:** What the converter can safely improve.
- **Detected regions:** Candidate editable regions and why they are safe or risky.
- **Block classifications:** Text, image, button-like, existing Dynamics block, unsupported, or warning-only.
- **Proposed changes:** Minimal HTML changes or rule references.
- **Warnings:** Risks, skipped conversions, and manual review needs.
- **Validation:** Tests or checks run, plus anything not verified.

For generated HTML, keep output minimal and readable. Preserve original layout and include warnings separately from the HTML.

## Warning Rules

Warn instead of rewriting when:

- A wrapper would alter nested table structure.
- A conversion would insert a `<div>` directly under `<table>`, `<tbody>`, or `<tr>`.
- A button uses Outlook VML or conditional comments.
- A block already appears to be Dynamics-generated.
- A change might remove tracking, personalization, compliance content, or required links.
- Source HTML uses forms, scripts, widgets, unsupported media, or unknown custom elements.
- The safe editable boundary is unclear.

Warnings must state what was detected, why it is risky, what was preserved or skipped, and what manual Dynamics Designer action may be needed.

## Things Not To Do

- Do not invent undocumented Microsoft attributes or behavior.
- Do not claim complete Dynamics compatibility or universal email-client rendering safety.
- Do not rewrite whole templates to make them cleaner.
- Do not flatten nested tables unless explicitly required and tested.
- Do not generate Dynamics button internals from ordinary links.
- Do not edit existing `data-editorblocktype` internals unless the converter owns that block.
- Do not remove `data-protected="true"`, `data-locked="hard"`, tracking attributes, or `property-reference` as cleanup.
- Do not disable tracking with `data-msdyn-tracking="false"` unless explicitly requested.

## Testing Expectations

For converter code changes:

- Add focused parser or transformation tests for each changed rule.
- Include minimal before/after HTML fixtures.
- Include warning expectations for skipped or risky structures.
- Test preservation of existing Dynamics attributes.
- Test table-boundary safety for container insertion.
- Test button-like HTML preservation, especially VML and conditional comments.
- Test validator warnings and errors for converted output.
- Run the repo's available test and lint commands when present.

For docs-only changes, verify links, examples, and attribute names against the project docs.
