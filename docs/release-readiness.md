# Public release readiness

Validation performed 2026-10-05; final evidence review 2026-10-07.
Application version: 1.2.0. Project schema: 4.
This is preparation evidence, not a public release announcement.

## Changes made for publication

- Removed unused TypeScript declarations/imports and obsolete canvas guidance
  styles. Enabled `noUnusedLocals` and `noUnusedParameters` in the strict build.
- Added Node engine metadata, `.nvmrc`, production preview, typecheck, coverage,
  production workflow checks, and repeatable third-party notice generation.
- Added GitHub Actions validation with read-only repository permissions, clean
  installation, sample/notice drift checks, and browser failure artifacts.
- Added MIT licensing as selected by the maintainer; builds retain both the
  project license and third-party notices. Runtime-package notices are generated
  from installed, locked packages; one missing npm license file is retained from
  its upstream source with provenance recorded in the generated notice.
- Added contribution/security/configuration guidance and replaced ambiguous
  roadmap release claims with verified, partial, and planned checkbox lists.
- Corrected inline versus Elasticsearch export documentation and sample schema.
- Excluded dependencies, build/coverage/browser outputs, local agent files,
  session transcripts, reference images, environment files, credentials, and
  machine settings from Git publication. Local reference materials are retained
  on disk, not destroyed.

## Validation

Environment: Windows, Node 22.22.2, npm 10.9.7, bundled Chromium automation.

| Check | Evidence |
| --- | --- |
| Clean dependency installation | `npm ci` passed |
| Dependency advisories | `npm audit` reported zero known vulnerabilities |
| Strict unused/type checks | `npm run typecheck` passed |
| Unit tests and coverage | 112 tests in 6 files passed; 91.8% statements, 81.81% branches, 93.02% functions, 92.52% lines; aggregate 80% gate retained |
| Production build | Passed; existing approximately 1.3 MB JavaScript chunk advisory |
| Five sample pairs and notices | All 11 generated artifacts reproduce byte-for-byte; compiler/render tests cover sample artifacts |
| Source browser suite | `npm run test:e2e`: 31/31 passed with the worktree unchanged during execution |
| Built-asset browser workflows | `npm run test:production`: 4/4 passed against the production preview server |
| Credential-pattern scan | No matches in 89 source/documentation/configuration text files, including local session/tool text; package caches/generated output excluded |
| Publication inventory | Git's candidate-file inventory excludes local tooling, transcripts, images, generated output, and secret-file patterns |
| Documentation and licensing | 19 Markdown documents checked with no broken local links; MIT/package-lock metadata and build license/notice copies agree |

The credential scan checked common GitHub/OpenAI/AWS token formats, private-key
headers, credential assignments, and authenticated URLs. It is a pattern scan,
not proof against every possible secret. No Git repository/history existed at
audit start. Review actual staged content and scan any imported history before
publication. No application debug logging or debugger statements were found.

Browser coverage includes save/open/export, invalid inputs, locks/history,
grouping, clipboard behavior, drag/resize/snapping, source drafts, and keyboard
controls. UI checks cover both themes, 1024/1366/1920px screens, all existing
element inspectors, and Properties widths 240/320/520px. These are Chromium
checks; no live Kibana, Firefox, Safari, or mobile validation is claimed.

An earlier browser run had three navigation timeouts while files were being
regenerated/edited. The final unchanged-worktree run passed all 31 tests without
raising timeouts or adding retries. Built-asset checks independently passed all
four core editing, save/open/export, lock/gesture, and invalid-input workflows.

## Remaining gates before publishing

1. Select/create the public GitHub destination and establish private vulnerability
   reporting or a maintainer contact. No remote or repository identity was supplied.
2. Review the staged file list against `.gitignore`; do not upload this entire
   working directory as a ZIP (it contains intentionally excluded local files).
3. Run the prepared CI on the actual repository, inspect results, and scan any
   imported Git history. A local pass is not a GitHub CI pass.
4. Review version/release notes, then publish the repository/tag/release. Nothing
   has been pushed, tagged, deployed, or publicly published during preparation.

Live Kibana validation, additional browsers, mobile authoring, automatic project
recovery, text wrapping, and bundle optimization remain explicitly unchecked in
the [roadmap](roadmap.md). They are disclosed scope limits, not completed work.

## Reproduce

```sh
npm ci
npm run typecheck
npm run test:coverage
npm run notices
npm run samples
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:production
npm audit
```

On Linux use `npx playwright install --with-deps chromium`. Finish all edits and
generation before browser tests. Historical completion reports retain their
earlier snapshot counts; use this report for current preparation evidence.
