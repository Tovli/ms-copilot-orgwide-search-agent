# Vendored Microsoft schemas

These unmodified JSON files are fetched from Microsoft's schema endpoints. `provenance.json` records their source URLs, retrieval date, and SHA-256. Local validation checks those hashes before compiling schemas; pull requests need no tenant or network access.

The stable `@microsoft/typespec-m365-copilot` 1.0.0 emitter hardcodes declarative-agent schema **v1.5**. Although Microsoft's current reference also documents newer schema versions, this project preserves the stable emitter's output instead of relabeling it. The Toolkit 1.1.19 template uses Microsoft 365 application manifest **1.30**.

The app and agent schemas declare JSON Schema draft-04; Microsoft also uses keywords such as `const` and `$defs`. Validation uses `ajv-draft-04` with `ajv-formats`, with strict-schema warnings disabled to accept Microsoft's published schemas. The Toolkit v1.12 YAML lifecycle schema uses draft-07 and is validated separately with Ajv after parsing YAML. Additional lifecycle invariants require compilation, staging, packaging, validation, and personal-only publication in order. Schema validation and project invariants supplement Microsoft Toolkit package validation; they do not establish runtime retrieval quality.

When updating a schema, download it from its exact official URL, review changes, update provenance hashes, update compatible tooling, and rerun the complete validation suite. The schema files retain Microsoft's original descriptions; see THIRD_PARTY_NOTICES.md for dependency and upstream obligations.
