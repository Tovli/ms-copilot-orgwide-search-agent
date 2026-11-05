# ADR 0004: Separate generic packaging from tenant acceptance

Status: Accepted for the implemented build and deployment workflow.

This record captures the packaging and acceptance decisions made during development.

## Context

Independent contributors must validate the project without tenant credentials. Installing organizations need persistent application identity and their own publisher pages. A valid ZIP cannot demonstrate multilingual retrieval quality, authorization isolation, or successful Microsoft 365 deployment.

## Decision

Default builds produce a validation-only ZIP from synthetic publisher configuration. A separate tenant package command requires installation-specific configuration under ignored `local/`. Package exactly the two manifests and two icons at the ZIP root. Fix entry ordering and DOS timestamps for reproducible custom-builder bytes across timezones.

Stage all four tenant files before Toolkit packaging: bare TypeSpec CLI compilation does not create the Toolkit-generated app-manifest marker needed for the alternative generated-folder resolution path. The authenticated lifecycle validates the ZIP before personal publication. Organizational publishing remains an administrator action.

Keep local acceptance and production acceptance separate. Public CI performs compilation, schema/invariant validation, automated tests, package inspection, and security checks without tenant data. Real retrieval, both cross-language directions, two-account isolation, sensitivity/injection checks, measured latency, and administrative approval require private tenant evaluation. The scorer reports reviewed measurements without claiming authenticated provenance or production readiness.

## Consequences

Generic build artifacts are suitable for inspection, not organizational deployment. Tenant configuration, packages, documents, and evaluation results stay out of public Git and CI. Full Toolkit ZIP validation requires authentication in the observed environment and remains pending until an authorized tenant user runs it. Fixed timestamps establish custom-builder reproducibility; Toolkit's own ZIP timestamps are not presented as reproducible.

## Evidence and alternatives

See [implementation results](../../IMPLEMENTATION_REPORT.md), [testing methodology](../../TESTING.md), and [administrator checklist](../../ADMIN_DEPLOYMENT_CHECKLIST.md). The test suite checks package contents, unsafe configuration, lifecycle expansion, cross-timezone digests, and incomplete evaluation gates. One shared installable identity with example publisher URLs, tenant-credential-dependent public CI, and production approval based only on synthetic tests were not selected.
