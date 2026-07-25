# Review notes: Dynamics template attributes

Review date: 2026-05-28

Live source checked: https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/custom-template-attributes

Microsoft Learn page date shown: 2026-04-10

Compared against: `docs/dynamics-template-attributes.md`

## Missing attributes, settings, warnings, or examples

1. Missing attribute: `data-block-datatype="<block-type>"`

   The live page says `Content` design elements also include `data-block-datatype="<block-type>"`, where `<block-type>` is either `text` or `image`.

   Impact: our cleaned doc lists `Content` but does not document the extra attribute. A converter must preserve `data-block-datatype` on existing content blocks and must not generate content blocks without knowing whether the block is `text` or `image`.

2. Missing warning: full-page editor disables drag-and-drop and ignores `data-container`

   The live page says that when the full-page editor is enabled, all drag-and-drop features are disabled, all Designer-tab content can be edited, and `data-container` div tags have no effect.

   Impact: our doc says content outside containers is locked, but that is only true in the drag-and-drop designer. Without the designer meta tag, `data-container` is not an editing boundary.

3. Missing warning: container locks hide element properties

   The live page says a `data-locked="hard"` container keeps all content and settings for nested design elements locked, and the **Properties** tab is never shown for those elements.

   Impact: our doc says the content is read-only, but should also warn that nested element settings become unreachable in Designer.

4. Missing warning: HTML-tab access can defeat locks

   The live page says both container locking and element protection can be bypassed by users who can access the **HTML** tab; Microsoft suggests limiting HTML-tab access to enforce locks.

   Impact: our doc treats locks as designer behavior, but should explicitly say they are not a security boundary if HTML editing is available.

5. Missing `data-protected` behavior for content blocks

   The live page says `data-protected="true"` is always included for the content-block element.

   Impact: a converter should preserve `data-protected` on `Content` blocks and should not remove it as cleanup.

6. Missing direct-placement behavior for pasted design elements

   The live page says design elements placed directly in HTML do not support drag-and-drop, but do provide settings in the **Properties** panel on the **Designer** tab.

   Impact: our doc should distinguish between dropped elements inside containers and pasted elements inserted directly into HTML.

7. Missing direct-placement limit

   The live page says only text, image, divider, and button elements can be placed directly in code by using the table examples. Other element types should be added by creating containers and using drag-and-drop.

   Impact: our doc is directionally safe because it avoids generating undocumented internals, but it should explicitly state this live-page limit.

8. Missing image-editing notes

   The live page says image source/link changes should preferably be made in Designer, but direct HTML edits are allowed for:

   - `<a href>`
   - `<a title>`
   - `<img src>`

   To remove an image link, clear `href` and `title` but keep the attributes and quotes, such as `href=""`. Do not edit any other image block code.

   Impact: these are concrete converter rules for imported image blocks and should be captured.

9. Missing text-editing note

   The live page says text content can be entered between the pasteable text block's `<p>` tags directly, or edited in Designer with the rich-text editor.

   Impact: this is a narrow documented exception to the general "do not edit design element internals" warning.

10. Missing divider-editing note

    The live page says not to edit divider block code directly in the HTML editor; use Designer and the **Properties** panel.

    Impact: our doc includes the divider example but should make this edit restriction explicit near the example.

11. Button example changed in the live page

    The live page now includes a `Button` paste-code row beginning with:

    ```html
    <div data-editorblocktype="Button"><!--[if mso]><div align="center"><v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
    ```

    The captured Learn text appears truncated, but the live page also says not to edit the button code directly and to use Designer and the **Properties** panel.

    Impact: our doc says the source does not provide pasteable button HTML. That is stale against the live page. For converter safety, do not use the partial captured snippet as a template; preserve existing button blocks and rely on Designer-generated button code unless the full Microsoft table code is verified.

12. Missing style-setting visibility rule

    The live page says a style setting created with `<meta type="xrm/designer/setting" ...>` only appears on the **Styles** tab when referenced by at least one actual style or HTML tag.

    Impact: a converter should not emit unused style-setting meta tags and expect them to be visible.

13. Missing CSS style-marker constraints

    The live page says CSS setting comment pairs can only be used in styles and classes defined within `<style>` tags in the `<head>`, and there must be only one set of `<style>` tags with all CSS styles there.

    Impact: third-party email HTML often has multiple `<style>` tags, inline styles, and conditional Outlook styles. A converter that adds style markers without consolidating carefully may create Dynamics settings that do not work.

14. Missing datatype details

    The live page gives stricter datatype meanings:

    - `color`: hash values such as `#000` or `#1a32bf`
    - `font`: a font-family name, and font stacks can use comma-separated names
    - `number`: numeric value with no unit
    - `picture`: image source URL
    - `text`: text and numbers; use for numeric values that include units such as `px` or `em`

    Impact: our doc should not imply `number` can contain units. Use `text` for values with units.

15. Missing label localization warning

    The live page says custom style labels may appear in square brackets, such as `[My Style]`, when no translation is available. Out-of-box labels such as `Color 1` may already have translations.

    Impact: not critical for conversion, but useful if generated labels appear unexpectedly bracketed in Dynamics.

16. `property-reference` support is broader than our TODO says

    The live page says `property-reference` can be placed in any HTML tag in the `<body>` and can create multiple attributes separated by semicolons in one `property-reference` attribute.

    Impact: our TODO says the source does not define the complete list of supported body tags or attributes. The live page now documents "any HTML tag" for tags, though it still leaves practical email-client safety to the converter.

17. Missing resolved-output example for `property-reference`

    The live page says:

    ```xml
    <img property-reference="src:@hero-image;height:@hero-image-height;">
    ```

    resolves to something like:

    ```xml
    <img src="picture.jpg" height="100px">
    ```

    Impact: this clarifies that `property-reference` creates controlled attributes, not just metadata alongside existing attributes.

18. Missing tracking consequence

    The live page says `data-msdyn-tracking="false"` means the link is not tracked and you cannot see whether a user clicked it.

    Impact: our doc says tracking is disabled, but should include the analytics consequence.

## Undocumented assumptions in our docs

1. Creating a `<head>` when missing is an app policy, not documented Microsoft behavior.

   Our conversion rule says to create a `<head>` if one is missing. That is a reasonable HTML-normalization step, but the live page only says to add meta tags to the `<head>`.

2. App-owned templates derived from Microsoft examples are an app policy.

   Our doc says generated `Text`, `Image`, and `Divider` internals can come from app-owned templates derived from the documented examples. Microsoft documents pasteable snippets, but does not document compatibility guarantees for modified derivatives.

3. Preserving all existing Dynamics wrappers is an app policy.

   The live page warns not to edit design-element internals because edits may be overwritten. It does not explicitly say a converter must preserve every wrapper. Preservation is still the safest converter behavior.

4. Treating email-only conversion as the app boundary is an app policy.

   The Microsoft page covers emails, pages, and forms. Our doc narrows converter behavior to email unless page/form conversion is explicitly added.

5. Avoiding generated `Button` internals is an app policy.

   The live page includes a button paste-code row, but captured text is incomplete and Microsoft says not to edit button code directly. Avoiding generation remains safer, but the doc should no longer say the live source has no button paste code.

## Dynamics-specific behaviours that could break email compatibility

1. Wrapper `<div>` elements can disturb table-based email layouts if inserted in invalid locations.

   Dynamics examples place containers inside table cells. A converter should not insert `<div data-container="true">` or `<div data-editorblocktype="...">` directly under `<table>`, `<tbody>`, or `<tr>`.

2. Drag-and-drop mode changes edit boundaries.

   Adding the designer meta tag changes the Designer from full-page editing to drag-and-drop editing. Content outside containers becomes locked in the drag-and-drop Designer, which can surprise users importing third-party HTML for simple edits.

3. Full-page mode ignores containers.

   If the designer meta tag is omitted, `data-container` does not protect or structure editing. A converted template that depends on containers for edit boundaries must include the meta tag.

4. Directly pasted design elements are not draggable.

   Microsoft says directly inserted text, image, divider, and button elements provide Properties-panel settings but do not support drag-and-drop. If users expect to move those blocks by dragging, they should be added inside containers through Designer instead.

5. `property-reference` can omit normal attributes until Dynamics resolves settings.

   The documented hero image example has only `property-reference` on the `<img>` source before resolution. That can break non-Dynamics previews or downstream processing that expects a normal `src` attribute before Dynamics processes the template.

6. Link tracking attributes change analytics behavior.

   `data-msdyn-tracking-id` can merge multiple physical links into one insights link. `data-msdyn-tracking="false"` removes click visibility. Incorrect preservation, duplication, or deletion can change analytics without changing visual rendering.

7. Outlook/non-Outlook conditional button or link markup must remain paired.

   The live tracking example uses VML for Outlook and an HTML link for non-Outlook clients with the same `data-msdyn-tracking-id`. Rewriting only one side can create rendering or analytics divergence between Outlook and Gmail-like clients.

8. CSS setting markers are constrained to one `<style>` block in `<head>`.

   Third-party email HTML may use multiple head style blocks, media queries, conditional comments, or inlined CSS. Adding Dynamics CSS markers without preserving email-client-specific CSS structure could degrade rendering.

9. Locking is not a send-time or security feature.

   `data-locked` and `data-protected` affect Designer behavior. Users with HTML-tab access can still edit code, and email clients ignore these attributes.

## Safer conversion rules for imported third-party HTML

1. Default to preserving third-party HTML structure.

   Do not wrap every block automatically. Insert Dynamics wrappers only at explicit editable boundaries, preferably inside existing table cells or safe block containers.

2. Make drag-and-drop opt-in per region.

   Add the designer meta tag only when the output should use drag-and-drop editing. Add `data-container="true"` only around regions intended to accept new design elements.

3. Preserve valid email table hierarchy.

   Never insert Dynamics `<div>` wrappers as direct children of `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<colgroup>`, or `<select>`-like structures. Prefer wrapping content inside `<td>` or an existing block-level area.

4. Preserve existing Dynamics attributes exactly.

   Preserve `data-container`, `data-locked`, `data-editorblocktype`, `data-block-datatype`, `data-protected`, `property-reference`, `data-msdyn-tracking-id`, and `data-msdyn-tracking`.

5. Preserve design-element internals unless the converter generated the block.

   Microsoft warns HTML-tab edits inside design-element wrappers are unpredictable and likely overwritten. Only modify internals for app-owned generated `Text`, documented image attributes, or other documented exceptions.

6. For `Content` blocks, preserve both `data-editorblocktype="Content"` and `data-block-datatype`.

   Do not generate new content blocks unless the converter knows the correct content block type and internal structure.

7. For images, restrict direct edits to documented attributes.

   For a Dynamics image block, edit only `<a href>`, `<a title>`, and `<img src>` when needed. To remove an image link, set `href=""` and `title=""`; keep the attributes and quotes.

8. For dividers and buttons, prefer Designer-owned settings.

   Do not rewrite divider or button internals. Preserve existing code or require configuration in Designer.

9. Treat the live button paste-code row as not enough for generation.

   Because the captured live page text exposes only a partial VML fragment, do not create a converter button template from it. Use an existing verified Dynamics button block or Designer-created output as the source of truth.

10. Only generate Styles-tab settings when there is a real reference.

    Emit a style-setting meta tag only when the converter also emits a matching CSS marker or `property-reference`.

11. Keep CSS markers inside one `<style>` block in `<head>`.

    If the input has multiple style blocks, do not blindly merge them. Email CSS can depend on order, media queries, and conditional comments. Prefer preserving CSS and skipping generated style settings unless a safe consolidation path exists.

12. Use the right setting datatype.

    Use `number` only for unitless numbers. Use `text` for values with units such as `px` or `em`. Use `font` for font names or comma-separated stacks. Use `picture` for image source URLs.

13. Keep normal fallback attributes when practical.

    If adding `property-reference` to an existing tag, preserve or emit the corresponding normal attribute value where it is safe to do so, so non-Dynamics previews and validators are less likely to break. Validate in Dynamics because the live page's example resolves attributes from `property-reference`.

14. Preserve paired conditional links.

    When Outlook VML and non-Outlook HTML links represent the same click target, preserve both branches and keep matching `data-msdyn-tracking-id` values.

15. Do not auto-disable tracking.

    Preserve existing `data-msdyn-tracking="false"`, but do not add it unless the user explicitly wants a link excluded from click analytics.

16. Validate in Dynamics after conversion.

    Paste into the **HTML** tab, switch to **Designer**, inspect whether full-page or drag-and-drop mode is active, verify editable regions, and check required email content such as subscription-center link and physical sender address.
