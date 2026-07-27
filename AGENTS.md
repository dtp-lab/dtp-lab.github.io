# Project Deployment Policy

- Treat a successful deployment to `https://dtp-lab.github.io/` as part of the default completion criteria for this repository.
- After each requested site change, run the relevant validation, create a focused Git commit, push the verified state to GitHub `main`, and confirm the GitHub Pages workflow succeeds.
- Do not stop at a local preview or private deployment unless the user explicitly requests local-only or private work.
- Preserve each deployable state as a commit so a faulty release can be reverted cleanly.
- Never deploy a build that fails its required validation.
- Do not substitute another hosting provider or deployment URL unless the user explicitly requests it.

# Content Visual Alignment Policy

- Use `$visual-layout-qa` after every addition, edit, removal, or reorder of visible content, including JSON-only content changes.
- Treat rendered visual QA as a required completion gate, not an optional polish pass.
- Before deployment, run `npm run validate`, inspect affected pages at 1440x900, 1024x768, and 390x844, and run the noindex `alignment-lab.html` diagnostic.
- For Projects, Publications, and Seminars, require zero alignment failures over 1.5 px, zero clipping failures, zero degraded SVG measurements, and zero page overflow.
- Confirm that every new or edited Projects, Publications, or Seminars record is rendered as an actual-data specimen in the alignment lab.
- When a content change introduces a new visual component pattern, add a production-renderer diagnostic specimen before accepting it.
- Fix alignment through shared component structure, typography, or SVG geometry. Never add record-specific, text-specific, keyword-count-specific, device-model-specific, or user-agent-specific corrections.
- After the public deployment, verify the affected production pages and public alignment lab in Windows Chromium. The required responsive evidence is the 1440x900, 1024x768, and 390x844 viewport matrix; successful completion does not require separate iPhone or iPad evidence.
- Treat real iPhone Safari and iPad Safari checks as optional follow-up. Do not ask the user to perform them unless the user explicitly requests actual-device verification or the change introduces a material Safari-specific risk that browser emulation cannot cover.
- Mark the content change complete when validation, the required viewport matrix, alignment diagnostics, GitHub Pages workflow, and Windows production checks pass. Never claim that an optional platform was checked without direct evidence from that platform.
