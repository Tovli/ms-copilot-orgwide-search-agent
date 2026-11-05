# Review finding remediation

The following changes address the supplied review. They do not establish tenant acceptance or change the native retrieval architecture.

| Finding | Resolution | Regression evidence |
| --- | --- | --- |
| Medium: packaging bypasses app identity guard | Shared pinned-identity guard protects configure, tenant build/stage/package and tenant verification. Missing/malformed baseline blocks packaging. Recovery and independent approved-ID checks are documented. | Changed, absent, duplicate, invalid and synthetic environment IDs; packaging routes reject drift before output. |
| Medium: precision@5 conflicts with concise results | Gate uses returned-result precision; standard hits/k remains diagnostic. Recall/MRR/nDCG and security requirements remain. | One/two correct files at k=5 pass; noisy lists and missing positives fail. |
| Low: evidence controls its own thresholds | Both input files reject threshold/policy overrides. Reports name fixed repository policy `org-document-search-pilot-v2`. | Attempts to lower, raise or replace policy fail input validation and CLI exits nonzero. |
| Low: scanner misses Entra values and env examples | Scan complete assigned values, including `~`, camelCase JSON and environment names. Use Git's tracked/nonignored file inventory; tracked ignored files and publishable env examples are included. | Synthetic Entra-shaped assignments, quoted/Markdown/XML values, placeholder controls, publishable env files, tracked ignored files and BOM-marked UTF-16 in both byte orders. Values are redacted in failures. |
| Low: verification confuses synthetic and tenant packages | Explicit profile for explicit paths; tenant mode rejects examples and compares publisher/identity with pinned config. Check sidecar digest and ZIP filename. No-argument output is visibly validation-only. | Renamed synthetic ZIP, ambiguous command, wrong publisher/approved ID, missing/mismatched sidecar and modified ZIP. |
| Nit: clean-checkout tests depend on generated JSON | Compile test fixtures to a temporary directory during suite setup. | Standalone `npm test` passed while the normal generated directory was absent. |
| Nit: tests write shared staging | Every test uses temporary compilation and staging paths. | `npm test` and `npm run package` executed concurrently; both passed. |
| Nit: duplicate feature-branch CI runs | Push trigger limited to main/master; pull requests still validate contributor branches. | Workflow YAML inspected and parsed locally; GitHub execution remains pending. |
| Nit: existing env file keeps permissive POSIX mode | Reapply `chmod(0600)` after configuration refresh; Windows ACL limits documented. | POSIX assertion included conditionally; Windows local run exercises refresh but does not establish POSIX permissions. |
| Nit: trailing-dot example host bypass | Reject trailing-dot publisher hostnames, including one or multiple final dots. | HTTPS example-host variants fail config validation. |

## Executed checks

- **55 tests passed, zero failed/skipped**: 23 package/configuration tests, 28 evaluation tests, and 4 credential-scanner tests.
- Standalone tests passed without `appPackage/.generated` present. The generated directory was restored afterward.
- Tests and normal packaging ran concurrently and passed using separate staging directories.
- Build, three official schema checks, configuration/lifecycle invariants, default validation ZIP verification, credential scanning and dependency audit passed. Audit returned zero vulnerabilities.
- The regenerated default validation artifact retains SHA-256 `501cbe75065f083c487afece6087645c564a425cbb59346d59a8e99e87bee980`; the agent's runtime payload is unchanged by these tooling fixes.

## Remaining external evidence

GitHub secret scanning/push-protection settings were not inspected or changed; the repository owner must verify them before public release. Local scanning is bounded working-tree defense, not complete secret or history coverage. No authenticated Microsoft 365 execution or administrator upload was performed. The administrator must compare upgrade identity with an independently approved release record rather than assuming upload will detect a new UUID as an unintended duplicate.

The decisions are recorded in [ADR 0005](adr/0005-installation-identity-and-release-evidence.md) and [ADR 0006](adr/0006-concise-results-and-fixed-evaluation-policy.md). Exact commands and recovery requirements are in [README](../README.md) and the [administrator checklist](../ADMIN_DEPLOYMENT_CHECKLIST.md).
