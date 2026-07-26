# Project Deployment Policy

- Treat a successful public deployment as part of the default completion criteria for this repository.
- After each requested site change, run the relevant validation, create a focused Git commit, and deploy the verified build to the configured public site.
- Do not stop at a local preview or private deployment unless the user explicitly requests local-only or private work.
- Preserve each deployable state as a commit so a faulty release can be reverted cleanly.
- Never deploy a build that fails its required validation.
