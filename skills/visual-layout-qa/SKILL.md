---
name: visual-layout-qa
description: Perform strict browser-based visual QA for responsive websites. Use for redesigns, layout regressions, icon/text alignment, clipped or overflowing content, mode toggles, image resampling, thumbnail quality, and cross-viewport consistency before deployment.
---

# Visual Layout QA

Audit the rendered product, not only its CSS. Treat visible misalignment, clipping, unintended density, weak hierarchy, and poor image sampling as defects.

## Required workflow

1. Build the current source and serve the generated site through its normal local HTTP flow.
2. Inspect every affected page at 1440×900, 1024×768, and 390×844. Add 1920×1080 or 360×800 when wide or narrow behavior is suspect.
3. Exercise every layout mode, filter, disclosure, and navigation state affected by the change.
4. Capture screenshots and inspect computed DOM geometry. Do not infer visual correctness from source code.
5. Record defects with page, viewport, selector, measured evidence, severity, and a concrete correction.
6. After fixes, repeat the full affected matrix. Do not accept “looks close” without remeasurement.

## Non-negotiable checks

### Alignment

- Compare icon and adjacent text centerlines using `getBoundingClientRect()`. Flag center differences above 1.5 px.
- Compare tag text, tag boxes, superscripts, links, and headings for shared baseline or intentional center alignment.
- Check multi-line wrapping separately; the first line must not pull the icon upward.
- Verify spacing between semantic groups such as date, presenter, keywords, venue, citation, and external links.

### Overflow and rhythm

- Assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- Flag descendants extending more than 1 px beyond their intended container.
- Test longest news, publication, author, venue, keyword, seminar, and project records.
- Verify that compact lists keep stable row rhythm without collisions or illegible density.
- Check both legacy and redesigned modes when a comparison toggle exists.

### Images

- Confirm the source has enough natural pixels for its maximum rendered size.
- Use browser interpolation (`image-rendering: auto`) unless pixel art is intentional.
- Flag stretched ratios, unintended cropping, fractional transforms, blurred upscaling, jagged thumbnails, and inconsistent focal points.
- Inspect 1× and high-density thumbnail rendering. Prefer high-resolution sources plus stable CSS dimensions.
- For mixed-ratio galleries, verify balanced centering and full-width visual composition rather than left-clustered rows.

### Responsive behavior

- Ensure title backgrounds, overlays, navigation, cards, and media do not collide.
- Confirm desktop compositions intentionally collapse for tablet and mobile.
- Verify touch targets, keyboard focus, `aria-pressed` or equivalent state, and readable line lengths.

## Severity

- P0: unusable page, broken navigation, inaccessible content.
- P1: horizontal scroll, clipping, overlap, broken toggle, severe image distortion, or clearly misaligned repeated UI.
- P2: visible baseline drift, inconsistent spacing, poor anti-aliasing, weak hierarchy, or awkward wrapping.
- P3: polish opportunity without a visible functional or compositional defect.

Do not approve deployment with any P0 or P1. Resolve repeated P2 defects before approval.

## Audit output

Return:

- a viewport/page coverage matrix;
- a defect table with measured evidence;
- screenshots or selectors that reproduce each issue;
- a final pass/fail verdict;
- any remaining P2/P3 limitations.

Remain read-only unless the task explicitly authorizes implementation.
