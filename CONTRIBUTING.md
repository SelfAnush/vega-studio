# Contributing

Use Node.js 22.22.2 (`.nvmrc`) and npm. Clone or download this repository,
then run `npm ci` and `npm run dev`. No backend or credentials are needed.
See [README](README.md) for editing workflows and [UI patterns](docs/ui-patterns.md)
before adding controls or elements.

## Changes and checks

1. Keep changes focused and describe the user-visible problem in your pull request.
2. Preserve project-file migrations, compiler/preview parity, undo semantics,
   locked-layer protection, keyboard editing, and both themes.
3. Add regression coverage for behavior changes. Use synthetic fixtures only.
4. Run `npm run typecheck`, `npm run test:coverage`, and `npm run build`.
5. Install Chromium with `npx playwright install chromium`, then run
   `npm run test:e2e`. On Linux, use `npx playwright install --with-deps chromium`.
6. If models, examples, or compilation change, run `npm run samples` and review
   all generated sample changes. Update relevant docs and `CHANGELOG.md`.
7. Run `npm run test:production` against the built assets. After dependency
   changes, run `npm run notices` and review the third-party license changes.

Finish editing files before browser tests run: Vite can reload open pages when
files or configuration change. Do not run generators during a browser suite.

Browser checks cover Chromium. Review screenshots in `test-results/` after UI
changes at 1024, 1366, and 1920 pixels, including narrow/wide Properties panels.
Do not lower coverage thresholds to make a change pass. Do not commit generated
builds, test reports, local tool configuration, conversations, or credentials.

## Reporting problems

Open an issue with reproduction steps, expected/actual behavior, browser/OS,
application version, and a minimal synthetic project when possible. Remove
private dataset names, query contents, and records before sharing a saved file.
For security concerns, see [SECURITY.md](SECURITY.md).

Plans are tracked in [the roadmap](docs/roadmap.md). Checked items require working
code and verification; partially implemented features remain unchecked and must
state their missing scope. Release numbers are not evidence of publication.
