# ADR 0003: Temporarily override vulnerable development dependencies

Status: Accepted for local development; authenticated compatibility remains pending.

This records the dependency decision made during implementation, including its unresolved risk.

## Context

The initially selected toolchain produced dependency-audit findings. Updating direct TypeSpec and validation libraries addressed some findings, but Toolkit and the compiler's dependency graph still resolved vulnerable indirect packages. Ordinary compatible-range updates did not resolve all observed findings.

## Decision

Pin the following overrides in `package.json`, with the resolved dependency graph recorded in `package-lock.json`:

| Scope | Forced dependency |
| --- | --- |
| `@microsoft/m365agentstoolkit-cli` | `@azure/msal-node` 7.2.0 |
| Dependency graph | `glob` 14.0.3 |
| Dependency graph | `minimatch` 11.0.4 |
| `@scalar/json-magic` 0.13.5 | `undici` 7.30.1 |

These are security workarounds for build/development tooling. None of these packages is included in the Microsoft 365 agent ZIP. The dependency graph's undici requirement also contributes to the documented minimum Node version.

## Consequences

The observed final audit returned zero vulnerabilities, and local compilation, tests, Toolkit manifest validation, and packaging passed. Several overrides cross upstream major-version ranges. In particular, successful local checks do not demonstrate that Toolkit authentication works with the MSAL override; the authenticated pilot must establish that compatibility.

Overrides are temporary maintenance obligations. On upstream upgrades, inspect the unmodified dependency graph and current advisories, remove overrides that are no longer necessary, regenerate the lockfile, and rerun relevant local and authenticated checks. Do not restore known-vulnerable versions solely to silence a compatibility failure.

## Evidence and alternatives

See [discovery](../TOOLCHAIN_DISCOVERY.md), [validation results](../../IMPLEMENTATION_REPORT.md), and [security policy](../../SECURITY.md). The observed advisories concerned [MSAL disclosure](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5), [glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch denial of service](https://github.com/advisories/GHSA-g3hv-75wg-m249), and [undici HTTP/TLS issues](https://github.com/advisories/GHSA-vmh5-mc38-953g), among the reported findings. Retaining the original resolutions leaves those findings open. Removing Toolkit from the project would change the reproducible development workflow; it was not selected during implementation.
