# Dynamics template attributes

Developer reference for converting external email HTML into markup that works in the Dynamics 365 Customer Insights - Journeys email designer.

Source: Microsoft Learn, "Use custom attributes to enable designer features in emails, pages, and forms."

## Purpose

Dynamics 365 Customer Insights - Journeys uses custom meta tags and HTML attributes to decide whether imported HTML opens in the drag-and-drop designer, which regions accept dropped blocks, which blocks are editable, and which document-level style settings appear in the **Styles** tab.

Without the designer document meta tag, pasted HTML opens in a simplified full-page rich text editor instead of the full designer with **Toolbox**, **Properties**, and **Styles** tabs.

Microsoft does not provide support for custom HTML in emails.

## Supported use cases

- Enable drag-and-drop editing for imported HTML.
- Mark specific regions as containers where users can drop design elements.
- Lock complete containers or individual design elements.
- Identify common Dynamics design elements such as text, image, divider, and form blocks.
- Add extra fonts to the text editor toolbar.
- Expose document-wide style settings in the **Styles** tab.
- Bind style settings to CSS values or selected HTML attributes.
- Control link tracking behavior on links and VML button shapes.
- Import externally created HTML through the **HTML** tab, then inspect it in the **Designer** tab.

## Core attributes

### `<meta type="xrm/designer/setting" name="type" value="marketing-designer-content-editor-document">`

Enables the drag-and-drop designer for the document.

Use this in the `<head>` of imported email HTML when the converted output should open in the full Dynamics designer.

```xml
<meta type="xrm/designer/setting" name="type" value="marketing-designer-content-editor-document">
```

### `data-container="true"`

Marks an editable container where users can drag and drop design elements.

Content outside `data-container="true"` regions is locked on the **Designer** tab. If non-element content is placed inside a container, it becomes a non-editable spacer between draggable drop zones.

```xml
<div data-container="true">
    <!-- DRAG HERE -->
</div>
```

```xml
<table aria-role="presentation">
    <tbody>
        <tr>
            <td>LOCKED</td>
            <td>
                <div data-container="true">
                    <!-- DRAGGABLE -->
                </div>
            </td>
        </tr>
    </tbody>
</table>
```

```xml
<div data-container="true">
    <!-- DRAG HERE -->
    <p>LOCKED</p>
    <!-- DRAG HERE -->
</div>
```

### `data-locked="hard"`

Locks an entire container and makes all content inside it read-only.

This overrides individual element lock settings inside the container.

```xml
<div data-container="true" data-locked="hard">
    <!-- All content here is locked -->
</div>
```

### `data-editorblocktype="<element-type>"`

Identifies a Dynamics design element.

Wrap design elements in `<div>` tags with `data-editorblocktype`. Microsoft warns not to edit the content between the opening and closing `<div>` tags of a design element on the **HTML** tab because changes are unpredictable and likely to be overwritten. Use the **Designer** tab for edits.

```xml
<div data-editorblocktype="Text">
    ...
</div>
```

Supported values from the source:

| Design element | `data-editorblocktype` value |
|---|---|
| Text | `Text` |
| Image | `Image` |
| Divider | `Divider` |
| Button | `Button` |
| Content block | `Content` |
| Marketing page | `Marketing Page` |
| Event | `Event` |
| Survey | `Survey` |
| Form | `FormBlock` |
| Field | `Field-<field-name>` |
| Subscription list | `SubscriptionListBlock` |
| Forward to a friend | `ForwardToFriendBlock` |
| Checkbox | `Field-checkbox` |
| Submit button | `SubmitButtonBlock` |
| Reset button | `ResetButtonBlock` |
| Captcha | `CaptchaBlock` |

Example field block value:

```xml
<div data-editorblocktype="Field-email">
    ...
</div>
```

### `data-protected="true"`

Locks an individual design element in the **Designer** tab.

Protected elements cannot be edited in the designer and appear shaded on the **HTML** tab. Remove the attribute or set it to `"false"` to unlock the element.

```xml
<div data-editorblocktype="Divider" data-protected="true">
    ...
</div>
```

### `data-msdyn-tracking-id`

Groups multiple physical links into one tracked link for analytics.

The source shows the same `data-msdyn-tracking-id` on alternate representations of the same link: a VML shape for Outlook and an HTML `<a>` for other clients.

```html
<!--[if gte mso 9]>
<v:shape xmlns:v="urn:schemas-microsoft-com:vml" data-msdyn-tracking-id="a50219d489b91583158608851" href="https://www.microsoft.com">LINK TEXT</v:shape>
<![endif]-->
<!--[if !mso]>
<a class="buttonClass" data-msdyn-tracking-id="a50219d489b91583158608851" href="https://www.microsoft.com">LINK TEXT</a>
<![endif]-->
```

### `data-msdyn-tracking`

Controls click tracking for a specific link.

Set `data-msdyn-tracking="false"` to disable link click tracking for that link.

```html
<a href="https://www.microsoft.com" data-msdyn-tracking="false">LINK TEXT</a>
```

## Designer settings

### `<meta type="xrm/designer/setting" name="additional-fonts" datatype="font" value="<font-list>">`

Adds fonts to the text element font menu.

Use a semicolon-separated font list in the `value` attribute.

```xml
<meta type="xrm/designer/setting" name="additional-fonts" datatype="font" value="Arial;Georgia;Courier New">
```

### `<meta type="xrm/designer/setting" name="<name>" value="<initial-value>" datatype="<data-type>" label="<label>">`

Creates a document-wide setting in the **Styles** tab.

The `name` identifies the setting, `value` provides the initial value, `datatype` controls the editor UI, and `label` is the human-readable label shown in Dynamics.

```xml
<meta type="xrm/designer/setting" name="<name>" value="<initial-value>" datatype="<data-type>" label="<label>">
```

Supported `datatype` values:

| `datatype` | Plain-English meaning |
|---|---|
| `color` | Shows a color picker. |
| `font` | Shows a font family input. |
| `number` | Shows a numeric input with up/down controls. |
| `picture` | Shows an image URL input. |
| `text` | Shows a text input. The source says this supports units such as `px`. |

### `/* @<tag-name> */ ... /* @<tag-name> */`

Binds a CSS value in `<head>` styles to a **Styles** tab setting.

The same marker appears before and after the editable CSS value.

```css
/* @<tag-name> */ /* @<tag-name> */
```

```xml
<head>
    <meta type="xrm/designer/setting" name="color1" value="#ff0000" datatype="color" label="Color 1">
    <style>
        h1 { color: /* @color1 */ #ff0000 /* @color1 */; }
    </style>
</head>
```

### `property-reference="<attr>:@<tag-name>;..."`

Binds document-wide style settings to HTML attribute values in the body.

The source example binds settings to `src` and `height` on an `<img>` tag.

```xml
<img property-reference="src:@hero-image;height:@hero-image-height;">
```

```xml
<head>
    <meta type="xrm/designer/setting" name="hero-image" value="picture.jpg" datatype="picture" label="Hero image">
    <meta type="xrm/designer/setting" name="hero-image-height" value="100px" datatype="text" label="Hero image height">
</head>
<body>
    <img property-reference="src:@hero-image;height:@hero-image-height;">
</body>
```

TODO: The source does not define the complete list of supported body tags or attributes for `property-reference`.

## Example patterns

### Minimal designer-enabled document

```xml
<head>
    <meta type="xrm/designer/setting" name="type" value="marketing-designer-content-editor-document">
</head>
<body>
    <div data-container="true">
        <div data-editorblocktype="Text">
            <p>Enter your text here</p>
        </div>
    </div>
</body>
```

### Pasteable text element

```xml
<div data-editorblocktype="Text"><p>Enter your text here</p></div>
```

### Pasteable image element

```xml
<div data-editorblocktype="Image">
    <div align="Center" class="imageWrapper">
        <a href="example.com" title="example.com">
            <img alt="Some alt text" height="50" src="about:blank" width="50">
        </a>
    </div>
</div>
```

### Pasteable divider element

```xml
<div data-editorblocktype="Divider">
    <div align="center" class="dividerWrapper">
        <table aria-role="presentation" style="padding:0;margin:0;width:100%">
            <tbody>
                <tr style="padding:0">
                    <td style="margin:0;padding:5px 0 5px 0;vertical-align:top">
                        <p style="margin:0;padding:0;border-bottom:3px solid #000;line-height:0;width:100%">
                            <span>&nbsp;</span>
                        </p>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
```

### Button element

Use the **Designer** tab for buttons. The source explicitly says not to paste button element code manually.

TODO: The source does not provide pasteable button HTML.

## Conversion rules for our app

1. Insert the designer document meta tag into `<head>` when the output should support drag-and-drop editing:

   ```xml
   <meta type="xrm/designer/setting" name="type" value="marketing-designer-content-editor-document">
   ```

   If the input document has no `<head>`, create one before inserting the tag.

2. Wrap only the regions that should accept dropped design elements in `<div data-container="true">`.

3. Do not expect content outside `data-container="true"` to be editable in the **Designer** tab.

4. Preserve non-element content inside a container as non-editable spacer content unless the converter intentionally wraps it in a documented design element.

5. Use `data-locked="hard"` only when the whole container must be read-only.

6. Wrap converter-generated Dynamics elements in `<div data-editorblocktype="...">` using only documented values.

7. Generate `Text`, `Image`, and `Divider` block internals only from the documented pasteable examples in this file, or from app-owned templates derived from those examples.

8. Do not synthesize manual `Button` block internals. The source says to create buttons in the **Designer** tab and not to paste button code manually.

9. Preserve existing `Button`, `Content`, `Marketing Page`, `Event`, `Survey`, `FormBlock`, `Field-<field-name>`, `SubscriptionListBlock`, `ForwardToFriendBlock`, `Field-checkbox`, `SubmitButtonBlock`, `ResetButtonBlock`, and `CaptchaBlock` wrappers, but do not generate their inner HTML from undocumented assumptions.

10. Preserve existing `data-msdyn-tracking-id`, `data-msdyn-tracking`, `property-reference`, `data-protected`, `data-locked`, `data-container`, and `data-editorblocktype` attributes when transforming HTML.

11. Preserve CSS setting markers in the form `/* @<tag-name> */ ... /* @<tag-name> */`.

12. Preserve `property-reference` values exactly unless the converter is intentionally rewriting the referenced attributes and matching style setting names.

13. Do not edit the internal HTML of known Dynamics design elements unless the app owns the generated block. Microsoft says HTML-tab edits inside design element wrappers are unpredictable and likely overwritten.

14. If adding custom style settings, emit a matching `<meta type="xrm/designer/setting" ...>` entry and either CSS comment markers or `property-reference` bindings.

15. For imported emails, leave required Dynamics email links to a separate personalization or assist-edit step.

16. After conversion, validate by pasting the output into the **HTML** tab and switching to the **Designer** tab to inspect the result.

TODO: The source mentions using assist edit to add required email links but does not specify the complete required-link set.

## Risks / limitations

- Microsoft does not support custom HTML in emails.
- Content outside `data-container="true"` cannot be edited in the **Designer** tab.
- `data-locked="hard"` locks every element inside the container, even if individual elements are otherwise editable.
- HTML-tab edits inside `data-editorblocktype` wrappers are unpredictable and likely to be overwritten.
- Manual button block HTML is not documented in the source.
- `property-reference` support is documented by example, but the source does not list every supported target tag or attribute.
- The source covers emails, pages, and forms. This app should apply only the parts relevant to email conversion unless page or form conversion is explicitly added.
