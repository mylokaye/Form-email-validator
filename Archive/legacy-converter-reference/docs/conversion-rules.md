# Conversion rules

Practical rules for transforming third-party HTML emails into Dynamics 365 Customer Insights - Journeys compatible HTML.

## Purpose

The converter should preserve the original email layout while adding enough Dynamics markup for predictable editing in Customer Insights - Journeys.

The main intent is:

- Keep rendering stable across email clients.
- Add editable regions only where useful.
- Preserve existing Dynamics attributes and blocks.
- Prefer warnings and review notes over destructive rewrites.
- Avoid undocumented Dynamics attributes or generated internals.

## Rule Types

- **Preserve:** Keep source HTML unchanged unless a documented Dynamics wrapper is required.
- **Wrap:** Add a documented Dynamics wrapper around a safe, editable region.
- **Convert:** Replace a small, simple source pattern with a documented Dynamics design block.
- **Warn:** Report a risky or unsupported pattern without rewriting it.
- **Skip:** Leave content as-is when conversion would risk layout or behavior.

## Container Detection

### Rule: Add editable containers around safe regions

**Purpose**

Make selected parts of an imported email accept dragged Dynamics design elements without changing the rest of the layout.

**Detection logic**

- Find stable block-level regions inside `<body>` that should become editable.
- Prefer wrapping content inside a `<td>`, existing `<div>`, or existing section-like block.
- Do not insert a `<div>` directly under `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, or `<colgroup>`.
- If the region already has `data-container="true"`, preserve it.

**Input HTML example**

```html
<td>
  <h2>Monthly update</h2>
  <p>Here is the latest news.</p>
</td>
```

**Output HTML example**

```html
<td>
  <div data-container="true">
    <h2>Monthly update</h2>
    <p>Here is the latest news.</p>
  </div>
</td>
```

**Notes**

- `data-container="true"` marks where users can drag and drop design elements.
- Content outside containers is not editable in the drag-and-drop Designer.
- If the output relies on containers, the document must also include the designer meta tag in `<head>`.

**Edge cases**

- If wrapping would split a table, conditional comment, VML block, or Outlook-specific structure, warn and skip.
- If the source has deeply nested tables, wrap only the smallest safe cell content.
- If a region is visual-only or legal/footer content, leave it outside containers unless editability is explicitly wanted.

### Rule: Preserve locked or protected Dynamics regions

**Purpose**

Avoid removing authoring controls from templates that already contain Dynamics markup.

**Detection logic**

- Preserve existing `data-container`, `data-locked`, `data-editorblocktype`, `data-protected`, `property-reference`, `data-msdyn-tracking-id`, and `data-msdyn-tracking`.
- Preserve `data-block-datatype` when present on existing content blocks.
- Do not remove `data-protected="true"` as cleanup.

**Input HTML example**

```html
<div data-container="true" data-locked="hard">
  <div data-editorblocktype="Text" data-protected="true">
    <p>Approved legal copy.</p>
  </div>
</div>
```

**Output HTML example**

```html
<div data-container="true" data-locked="hard">
  <div data-editorblocktype="Text" data-protected="true">
    <p>Approved legal copy.</p>
  </div>
</div>
```

**Notes**

- `data-locked="hard"` locks the whole container in Designer.
- `data-protected="true"` protects an individual design element in Designer.
- These are Designer controls, not email-client or security controls.

**Edge cases**

- Users with HTML-tab access may still edit locked or protected code.
- Do not add `data-locked="hard"` automatically; it can make nested element settings unreachable in Designer.

## Text Blocks

### Rule: Convert simple editable copy to `Text`

**Purpose**

Expose simple text content as a Dynamics text design element while preserving readable HTML.

**Detection logic**

- Convert simple copy blocks such as standalone paragraphs or short heading-plus-paragraph groups.
- Keep the general short-text filter for incidental labels, but allow short text when it sits inside a Stripo text-block context such as `esd-block-text` or `es-text-*`.
- Use `data-editorblocktype="Text"`.
- Convert only when the text block is inside, or will be wrapped by, a safe editable container.
- Preserve inline formatting such as `<strong>`, `<em>`, `<a>`, and simple spans.

**Input HTML example**

```html
<p>Thanks for joining us.</p>
```

**Output HTML example**

```html
<div data-editorblocktype="Text">
  <p>Thanks for joining us.</p>
</div>
```

**Notes**

- Text block content can be edited in Designer.
- Keep the internal HTML simple.
- Do not rewrite tracked links or personalization tokens inside text.

**Edge cases**

- If a text region contains complex nested tables, forms, scripts, or VML, warn and skip conversion.
- If the text is inside an existing `data-editorblocktype`, preserve the existing block instead of nesting another block.
- If text is legal or compliance copy, consider leaving it protected only when explicitly requested.
- Short Stripo status labels such as `Assigned` are still editable text when their enclosing cell carries Stripo text-block classes.

### Rule: Preserve existing text blocks

**Purpose**

Avoid unpredictable Designer behavior from editing Dynamics-owned internals.

**Detection logic**

- Detect `<div data-editorblocktype="Text">`.
- Preserve the wrapper and attributes.
- Only normalize whitespace if it does not change rendered output.

**Input HTML example**

```html
<div data-editorblocktype="Text">
  <p>Existing Dynamics copy.</p>
</div>
```

**Output HTML example**

```html
<div data-editorblocktype="Text">
  <p>Existing Dynamics copy.</p>
</div>
```

**Notes**

- Microsoft warns that HTML-tab edits inside design elements can be overwritten.
- Treat existing Dynamics blocks as owned by Dynamics unless this converter generated them.

**Edge cases**

- If an existing text block has `data-protected="true"`, preserve it.
- Do not wrap a text block in another `data-editorblocktype`.

## Image Blocks

### Rule: Convert simple images to `Image`

**Purpose**

Make a simple third-party image editable in Dynamics while keeping the rendered image and link.

**Detection logic**

- Detect a standalone `<img>` or a simple `<a><img></a>` pattern.
- Use `data-editorblocktype="Image"`.
- Preserve `src`, `alt`, `width`, `height`, link `href`, and link `title` when present.
- Convert only inside a safe editable container.

**Input HTML example**

```html
<a href="https://example.com" title="Example">
  <img src="hero.jpg" alt="Hero" width="600">
</a>
```

**Output HTML example**

```html
<div data-editorblocktype="Image">
  <div align="Center" class="imageWrapper">
    <a href="https://example.com" title="Example">
      <img alt="Hero" src="hero.jpg" width="600">
    </a>
  </div>
</div>
```

**Notes**

- Dynamics image examples use an `imageWrapper` container.
- Prefer preserving source dimensions rather than recalculating them.
- Direct edits to existing Dynamics image blocks should be limited to documented image URL and link attributes.

**Edge cases**

- If an image uses VML, background images, `srcset`, `<picture>`, or complex conditional comments, warn and skip conversion.
- If the source image has no `alt`, keep it empty only if the source was empty; otherwise warn for human review.
- If removing a link from an existing Dynamics image block, keep `href=""` and `title=""` rather than deleting the attributes.

### Rule: Preserve existing image blocks

**Purpose**

Avoid breaking Dynamics image editing behavior.

**Detection logic**

- Detect `<div data-editorblocktype="Image">`.
- Preserve wrapper structure and all unknown attributes.
- Only update documented image fields when the converter is explicitly asked to do so.

**Input HTML example**

```html
<div data-editorblocktype="Image">
  <div align="Center" class="imageWrapper">
    <a href="https://example.com" title="Example">
      <img alt="Hero" height="50" src="about:blank" width="50">
    </a>
  </div>
</div>
```

**Output HTML example**

```html
<div data-editorblocktype="Image">
  <div align="Center" class="imageWrapper">
    <a href="https://example.com" title="Example">
      <img alt="Hero" height="50" src="about:blank" width="50">
    </a>
  </div>
</div>
```

**Notes**

- Do not remove wrapper classes or alignment attributes from existing Dynamics image blocks.
- Preserve `property-reference` if present.

**Edge cases**

- If both normal attributes and `property-reference` target the same field, preserve both and warn for review.
- If a tracked link wraps the image, preserve `data-msdyn-tracking-id` and `data-msdyn-tracking`.

## Button Blocks

### Rule: Preserve third-party buttons by default

**Purpose**

Avoid breaking Outlook VML, conditional comments, or table-based bulletproof button rendering.

**Detection logic**

- Detect button-like patterns:
  - `<a>` styled as a button.
  - Table-based buttons.
  - Conditional VML plus HTML button pairs.
- Preserve the source structure unless a verified Dynamics button template is available.
- Preserve tracking attributes on all link variants.
- Exception: Stripo button exports may be wrapped as a Dynamics `Button` block when the non-Outlook `<a>` is clearly in a Stripo button context and the paired Outlook/VML branch can remain unchanged.

**Input HTML example**

```html
<table role="presentation">
  <tr>
    <td>
      <a href="https://example.com" style="background:#0057ff;color:#fff;">Read more</a>
    </td>
  </tr>
</table>
```

**Output HTML example**

```html
<table role="presentation">
  <tr>
    <td>
      <a href="https://example.com" style="background:#0057ff;color:#fff;">Read more</a>
    </td>
  </tr>
</table>
```

**Notes**

- Button HTML is high risk in email clients, especially Outlook.
- Prefer preserving a known-good third-party button over generating undocumented Dynamics button internals.
- A preserved HTML button may not become a Dynamics `Button` design element.
- Stripo source-editor button classes include `esd-block-button`, `es-button-border`, and `es-button`.
- Stripo exported/minified button markup may use a `span.msohide` non-Outlook branch with a styled link such as `a.c.u`; treat this as a Stripo button context when button styling/text are present.
- Do not classify decorative icons inside a detected Stripo button as standalone Image blocks.

**Edge cases**

- If VML and HTML branches represent the same link, keep both branches paired.
- If `data-msdyn-tracking-id` appears on one branch, do not duplicate or change it without understanding the paired link.
- If a button must be editable as a Dynamics button, require a verified Dynamics button block source or Designer-created output.
- Empty `href=""` is common while a template button is still being authored; Stripo button context can still mark the block as a Button candidate.

### Rule: Preserve existing Dynamics button blocks

**Purpose**

Keep Designer-created button behavior intact.

**Detection logic**

- Detect `<div data-editorblocktype="Button">`.
- Preserve the full block internals.
- Do not normalize conditional comments, VML, or nested table code inside the block.

**Input HTML example**

```html
<div data-editorblocktype="Button">
  <!-- Existing Dynamics-generated button code -->
</div>
```

**Output HTML example**

```html
<div data-editorblocktype="Button">
  <!-- Existing Dynamics-generated button code -->
</div>
```

**Notes**

- Use `data-editorblocktype="Button"` only for existing or verified Dynamics button blocks.
- Do not generate a partial button block from a link.

**Edge cases**

- If the button block has `data-protected="true"`, preserve it.
- If the button contains paired Outlook and non-Outlook markup, keep both branches unchanged.

## Warnings

### Nested table complexity

- Email layouts often depend on exact table hierarchy. Adding `<div>` wrappers in the wrong place can break rendering.
- Warn when editable regions cross table boundaries.
- Warn when a proposed wrapper would become a direct child of `<table>`, `<tbody>`, or `<tr>`.
- Prefer wrapping content inside one `<td>` at a time.

### Unsupported structures

- Do not convert scripts, forms, embedded widgets, unsupported media, or unknown custom elements into Dynamics blocks.
- Do not generate internals for undocumented `data-editorblocktype` values.
- Preserve existing `Content`, `FormBlock`, `Field-<field-name>`, `SubscriptionListBlock`, `SubmitButtonBlock`, and related blocks without rewriting their internals.
- Warn when a structure needs manual Designer work.

### Possible rendering risks

- Extra `<div>` wrappers can affect spacing in some email clients.
- Outlook VML and conditional comments are fragile; preserve them unless a verified replacement exists.
- `property-reference` can make Dynamics resolve attributes later, which may affect non-Dynamics previews.
- `data-locked` and `data-protected` affect Designer behavior only; email clients ignore them.
- Disabling tracking with `data-msdyn-tracking="false"` removes click analytics for that link.

## Output Requirements

- Output valid, minimal HTML suitable for pasting into the Dynamics **HTML** tab.
- Include the designer document meta tag only when drag-and-drop editing is intended:

  ```html
  <meta type="xrm/designer/setting" name="type" value="marketing-designer-content-editor-document">
  ```

- Preserve existing Dynamics attributes exactly.
- Preserve visual layout before adding editability.
- Add `data-container="true"` only to safe editable regions.
- Add `data-editorblocktype` only for documented block types.
- Preserve `data-protected="true"` and `data-locked="hard"` when present.
- Do not rewrite existing Dynamics block internals unless the converter owns the block.
- Emit warnings for skipped conversions, risky table structures, unsupported blocks, and possible rendering changes.
- Keep examples and generated HTML readable enough for Codex, parser development, future plugin logic, and human review.
