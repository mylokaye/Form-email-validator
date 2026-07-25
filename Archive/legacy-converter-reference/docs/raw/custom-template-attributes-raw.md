# Custom Template Attributes for Emails, Pages, and Forms

> **Source:** [Use custom attributes to enable designer features in emails, pages, and forms](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/custom-template-attributes) — Microsoft Learn

This guide covers how to mark up HTML in email, page, and form templates to enable drag-and-drop editing, style controls, and other designer features in Dynamics 365 Customer Insights — Journeys.

---

## Table of Contents

1. [Tag and Attribute Summary](#tag-and-attribute-summary)
2. [Enable Drag-and-Drop Editing](#enable-drag-and-drop-editing)
3. [Create a Container for Design Elements](#create-a-container-for-design-elements)
4. [Lock a Container](#lock-a-container)
5. [Identify Design Elements](#identify-design-elements)
6. [Lock Elements in Designer View](#lock-elements-in-designer-view)
7. [Import Externally Created HTML](#import-externally-created-html)
8. [Add New Fonts to the Toolbar](#add-new-fonts-to-the-toolbar)
9. [Add Settings to the Styles Tab](#add-settings-to-the-styles-tab)
10. [Use Attributes on Links and Buttons](#use-attributes-on-links-and-buttons)

---

## Tag and Attribute Summary

| Custom Attribute / Meta Tag | Description |
|---|---|
| `<meta type="xrm/designer/setting" name="type" value="marketing-designer-content-editor-document">` | Enables drag-and-drop on the **Designer** tab. Without this, the simplified full-page editor is shown. |
| `<meta type="xrm/designer/setting" name="additional-fonts" datatype="font" value="<font-list>">` | Adds fonts (semicolon-separated) to the text-element font menu. |
| `<div data-container="true"> … </div>` | Marks a container where users can drag and drop design elements. |
| `<div data-editorblocktype="<element-type>"> … </div>` | Marks a design element (text, image, button, etc.). |
| `<meta type="xrm/designer/setting" name="<name>" value="<initial-value>" datatype="<data-type>" label="<label>">` | Defines a document-wide style setting shown on the **Styles** tab. |
| `/* @<tag-name> */ … /* @<tag-name> */` | CSS comment pair that links a CSS value to a style setting. |
| `property-reference="<attr>:@<tag-name>;..."` | Applies style settings to attribute values on body HTML tags. |

---

## Enable Drag-and-Drop Editing

Add the following to the `<head>` section to switch from the full-page editor to the drag-and-drop designer:

```xml
<meta type="xrm/designer/setting" name="type" value="marketing-designer-content-editor-document">
```

Without this tag, pasted HTML renders in a simplified rich-text editor without the **Toolbox**, **Properties**, or **Styles** tabs.

---

## Create a Container for Design Elements

Users can only drag new elements into `data-container` regions. Content outside these containers is locked on the **Designer** tab.

```xml
<div data-container="true">
    <!-- DRAG HERE -->
</div>
```

Example with locked and unlocked areas:

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

If you nest non-element content inside a container, it becomes a non-editable spacer between draggable zones:

```xml
<div data-container="true">
    <!-- DRAG HERE -->
    <p>LOCKED</p>
    <!-- DRAG HERE -->
</div>
```

---

## Lock a Container

Add `data-locked="hard"` to a container to make all content read-only. This overrules individual element lock settings.

```xml
<div data-container="true" data-locked="hard">
    <!-- All content here is locked -->
</div>
```

---

## Identify Design Elements

Design elements are wrapped in `<div>` tags with `data-editorblocktype`:

```xml
<div data-editorblocktype="Text">
    ...
</div>
```

### Element Types

| Design Element | `data-editorblocktype` Value |
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
| Field | `Field-<field-name>` (e.g., `Field-email`) |
| Subscription list | `SubscriptionListBlock` |
| Forward to a friend | `ForwardToFriendBlock` |
| Checkbox | `Field-checkbox` |
| Submit button | `SubmitButtonBlock` |
| Reset button | `ResetButtonBlock` |
| Captcha | `CaptchaBlock` |

> **Important:** Do not edit content between the `<div>` tags of design elements on the **HTML** tab — changes are unpredictable and likely overwritten. Use the **Designer** tab instead.

---

## Lock Elements in Designer View

Add `data-protected="true"` to an element's opening `<div>`:

```xml
<div data-editorblocktype="Divider" data-protected="true">
    ...
</div>
```

Protected elements cannot be edited on the **Designer** tab. They appear shaded on the **HTML** tab. Remove the attribute or set it to `"false"` to unlock.

---

## Import Externally Created HTML

### Basic Import

1. Create a new marketing email, page, or form.
2. Go to **Design** > **HTML** tab.
3. Clear and paste your HTML.
4. Switch to the **Designer** tab to inspect.
5. For emails, use [assist edit](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/dynamic-email-content#personalization) to add required links.

### Enable Drag-and-Drop After Import

1. On the **HTML** tab, add the meta tag from [Enable Drag-and-Drop Editing](#enable-drag-and-drop-editing).
2. Insert `data-container="true"` divs where you want draggable regions.
3. Optionally paste in element code directly (see the table below).

### Pasteable Element Code

| Element | HTML |
|---|---|
| **Text** | `<div data-editorblocktype="Text"><p>Enter your text here</p></div>` |
| **Image** | `<div data-editorblocktype="Image"><div align="Center" class="imageWrapper"><a href="example.com" title="example.com"><img alt="Some alt text" height="50" src="about:blank" width="50"></a></div></div>` |
| **Divider** | ```<div data-editorblocktype="Divider"><div align="center" class="dividerWrapper"><table aria-role="presentation" style="padding:0;margin:0;width:100%"><tbody><tr style="padding:0"><td style="margin:0;padding:5px 0 5px 0;vertical-align:top"><p style="margin:0;padding:0;border-bottom:3px solid #000;line-height:0;width:100%"><span>&nbsp;</span></p></td></tr></tbody></table></div></div>``` |
| **Button** | Use the **Designer** tab. Do not paste manually. |

---

## Add New Fonts to the Toolbar

Add a meta tag to `<head>`:

```xml
<meta type="xrm/designer/setting" name="additional-fonts" datatype="font" value="Arial;Georgia;Courier New">
```

---

## Add Settings to the Styles Tab

### Step 1 — Meta Tag

```xml
<meta type="xrm/designer/setting" name="<name>" value="<initial-value>" datatype="<data-type>" label="<label>">
```

| Datatype | Description |
|---|---|
| `color` | Color picker |
| `font` | Font family input |
| `number` | Numeric input with up/down |
| `picture` | Image URL input |
| `text` | Text input (supports units like `px`) |

### Step 2a — Apply to CSS in `<head>`

Use CSS comment markers:

```css
/* @<tag-name> */ /* @<tag-name> */
```

Example:

```xml
<head>
    <meta type="xrm/designer/setting" name="color1" value="#ff0000" datatype="color" label="Color 1">
    <style>
        h1 { color: /* @color1 */ #ff0000 /* @color1 */; }
    </style>
</head>
```

### Step 2b — Apply to Body HTML Attributes

Use `property-reference`:

```xml
<img property-reference="src:@hero-image;height:@hero-image-height;">
```

Full example:

```xml
<head>
    <meta type="xrm/designer/setting" name="hero-image" value="picture.jpg" datatype="picture" label="Hero image">
    <meta type="xrm/designer/setting" name="hero-image-height" value="100px" datatype="text" label="Hero image height">
</head>
<body>
    <img property-reference="src:@hero-image;height:@hero-image-height;">
</body>
```

---

## Use Attributes on Links and Buttons

### `data-msdyn-tracking-id`

Merges multiple physical links into a single tracked link for analytics.

```html
<!--[if gte mso 9]>
<v:shape xmlns:v="urn:schemas-microsoft-com:vml" data-msdyn-tracking-id="a50219d489b91583158608851" href="https://www.microsoft.com">LINK TEXT</v:shape>
<![endif]-->
<!--[if !mso]>
<a class="buttonClass" data-msdyn-tracking-id="a50219d489b91583158608851" href="https://www.microsoft.com">LINK TEXT</a>
<![endif]-->
```

### `data-msdyn-tracking`

Set to `"false"` to disable link click tracking for a specific link.

---

> **Note:** Microsoft does not provide support for custom HTML in emails.
