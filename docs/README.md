# Development documentation

The specification and ADRs below preserve the requirements and decisions used during implementation. The ADRs were written down after implementation from the existing source, discovery notes, and validation report; they do not introduce new architecture or claim additional validation.

- [Specification](SPECIFICATION.md): functional requirements, constraints, deliverables, and acceptance criteria.
- [Architecture](ARCHITECTURE.md): runtime flow, intended behavior, build boundaries, and security model.
- [Toolchain discovery](TOOLCHAIN_DISCOVERY.md): verified templates, versions, schema support, and command behavior.
- [ADR 0001 — Native unscoped retrieval](adr/0001-native-unscoped-retrieval.md).
- [ADR 0002 — TypeSpec and compatible schemas](adr/0002-typespec-and-compatible-schemas.md).
- [ADR 0003 — Development dependency overrides](adr/0003-development-dependency-overrides.md).
- [ADR 0004 — Packaging and acceptance boundaries](adr/0004-packaging-and-acceptance-boundaries.md).
- [ADR 0005 — Installation identity and release evidence](adr/0005-installation-identity-and-release-evidence.md).
- [ADR 0006 — Concise results and fixed evaluation policy](adr/0006-concise-results-and-fixed-evaluation-policy.md).
- [Review finding remediation](REVIEW_FINDINGS.md): fixes, regression evidence, and remaining external checks.

The root-level [implementation report](../IMPLEMENTATION_REPORT.md), [testing guide](../TESTING.md), [security policy](../SECURITY.md), and [limitations](../LIMITATIONS.md) retain the deliverable locations required by the original brief.
