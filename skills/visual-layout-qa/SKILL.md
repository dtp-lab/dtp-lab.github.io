---
name: visual-layout-qa
description: Gate responsive website changes with rendered visual evidence. Use after every visible content addition or edit, and before deployment, especially for Projects, Publications, and Seminars metadata, icon-text alignment, wrapping, overflow, typography, images, and cross-platform consistency on Windows, iPhone, and iPad.
---

# Visual Layout QA

Audit the rendered product, not only its source or computed CSS. Treat content-dependent alignment, clipping, unintended wrapping, weak hierarchy, and poor image sampling as defects.

## Mandatory trigger

Run this skill whenever a change adds, edits, removes, or reorders visible website content. This includes JSON-only edits because new text lengths, author lists, dates, institutions, keywords, images, and titles can expose layout defects without changing CSS.

Also run it after changes to renderers, templates, SVG icons, fonts, typography, spacing, breakpoints, or responsive behavior.

## Required workflow

1. Identify every affected page, record type, and component pattern.
2. Run the repository's content validation and production build.
3. Serve the generated site through its normal local HTTP flow.
4. Inspect every affected page at:
   - 1440x900 desktop;
   - 1024x768 tablet;
   - 390x844 mobile.
5. Exercise affected filters, searches, disclosures, navigation states, and long-content cases.
6. Capture screenshots and inspect rendered DOM geometry. Do not infer visual correctness from source code.
7. Run the repository's alignment diagnostic against all production records and stress specimens.
8. Fix failures at the shared component or layout-contract level. Do not add selectors for a particular record, keyword count, title, device model, or user agent.
9. Repeat the full affected matrix after each fix.
10. Record the three-platform acceptance state before declaring completion.

## DTPLab metadata contract

For this repository, use the noindex `alignment-lab.html` page. It must reuse the production renderers, SVGs, fonts, and CSS for Projects, Publications, and Seminars.

Read `window.__alignmentReport` after fonts finish loading and measurements settle. Require all of the following:

- `alignmentFailures === 0`;
- `clippingFailures === 0`;
- `degradedMeasurements === 0`;
- `overflow === 0`;
- every new or edited record appears among the actual-data specimens;
- every icon-to-content pair and same-row first-control spread is at most 1.5 px.

Check these semantic pairs:

- Projects: institution icon/text, date icon/text, keyword icon/first keyword;
- Publications: authors icon/first author line, venue icon/first venue line, keyword icon/first keyword;
- Seminars: date icon/text, speaker icon/text, keyword icon/first keyword.

Measure the SVG's painted geometry and the adjacent text's first rendered line. Wrapper-box centers alone are insufficient because SVG viewBox whitespace and font metrics differ.

Ensure multiline text and wrapped tags grow downward from the shared first baseline. A tall keyword group must not move the institution, date, author, venue, speaker, or neighboring icon.

If a new component pattern is not represented in the diagnostic page, add a production-renderer specimen before accepting the content change.

## Platform evidence

Use two evidence stages:

### Pre-deployment

- Run the full Windows browser viewport matrix.
- Save the alignment report and representative screenshots.
- Do not deploy when automated validation, geometry, overflow, clipping, or SVG measurement fails.

### Post-deployment acceptance

- Open the deployed production page and public noindex alignment lab on Windows, iPhone Safari, and iPad Safari.
- Accept an actual-device screenshot, copied alignment report, or explicit user confirmation as device evidence. A confirmation must identify the deployed URL or commit, device and browser, affected page, and orientation; do not reuse evidence from an older deployment.
- If iPhone or iPad cannot be inspected by the agent, report `DEVICE CHECK PENDING`; do not claim cross-platform verification.
- A deployment made for device inspection is not final acceptance. Fix and redeploy if device evidence exposes a defect.

## Other visual checks

### Alignment and rhythm

- Compare intentional baselines or centerlines for icons, tags, superscripts, links, and headings.
- Verify spacing between date, presenter, institution, venue, citation, keywords, and external links.
- Test the longest real record, not only a convenient short example.
- Reject repeated visible drift even when a single measurement is marginally within tolerance.

### Overflow and responsive behavior

- Assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- Flag descendants extending more than 1 px beyond their intended container.
- Confirm desktop compositions intentionally collapse for tablet and mobile.
- Verify touch targets, keyboard focus, active state, and readable line lengths.

### Images

- Confirm each source has enough natural pixels for its maximum rendered size.
- Preserve the source ratio unless intentional cropping is part of the design.
- Use normal browser interpolation unless the asset is pixel art.
- Inspect both standard-density and high-density rendering.

## Severity and acceptance

- P0: unusable page, broken navigation, or inaccessible content.
- P1: horizontal scroll, clipping, overlap, broken interaction, severe distortion, or clearly misaligned repeated UI.
- P2: visible baseline drift, inconsistent spacing, poor sampling, weak hierarchy, or awkward wrapping.
- P3: polish opportunity without a visible functional or compositional defect.

Do not approve with any P0 or P1. Resolve repeated P2 defects. A small residual difference may be accepted only when it is within the 1.5 px contract and the user has explicitly accepted the actual-device appearance.

## Required report

Return:

- affected pages and content records;
- viewport and platform coverage matrix;
- alignment report totals and maximum delta;
- defect list with selectors, measurements, and severity;
- screenshots or reproducible URLs;
- final state: `PREDEPLOY PASS`, `DEVICE CHECK PENDING`, or `THREE-PLATFORM ACCEPTED`;
- any explicitly accepted residual P2 or P3 limitation.

Never report a platform as checked without direct evidence from that platform.
