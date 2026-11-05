# ADR 0002: Preserve stable TypeSpec emitter schema compatibility

Status: Accepted for the implemented toolchain; revisit with emitter upgrades.

This record captures the development-time compatibility decision.

## Context

The brief prefers TypeSpec when supported. Toolkit 1.1.19 provides a TypeSpec declarative-agent template. The stable Copilot emitter 1.0.0 emits agent schema v1.5, while the Microsoft reference checked during discovery describes v1.9. The generated Toolkit template uses application manifest 1.30 and lifecycle v1.12.

## Decision

Author the agent in TypeSpec and preserve the stable emitter's v1.5 output. Use application manifest 1.30 and Toolkit lifecycle v1.12. Pin compatible dependencies and vendor the exact official schemas with source URLs and hashes for offline validation. Do not hand-edit emitted JSON or merely relabel its version as v1.9.

## Consequences

Authoring remains supported by the selected emitter and repeatable in tenant-free CI. Newer manifest features require an intentional toolchain/schema upgrade and compatibility review. Passing schema validation does not establish tenant acceptance or retrieval quality.

## Evidence and alternatives

The emitter's installed constants, successful compilation, official schemas, and direct Toolkit manifest validation establish local compatibility. See [discovery](../TOOLCHAIN_DISCOVERY.md) and [schema provenance](../../schemas/provenance.json). JSON-only authoring could target newer schemas but would abandon the supported TypeSpec preference without a feature need. Relabeling generated output would misrepresent emitter support. Neither was selected.
