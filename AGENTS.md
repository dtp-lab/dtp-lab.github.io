# Project Deployment Policy

- Treat a successful deployment to `https://dtp-lab.github.io/lab-website/` as part of the default completion criteria for this repository.
- After each requested site change, run the relevant validation, create a focused Git commit, push the verified state to GitHub `main`, and confirm the GitHub Pages workflow succeeds.
- Do not stop at a local preview or private deployment unless the user explicitly requests local-only or private work.
- Preserve each deployable state as a commit so a faulty release can be reverted cleanly.
- Never deploy a build that fails its required validation.
- Do not substitute another hosting provider or deployment URL unless the user explicitly requests it.
