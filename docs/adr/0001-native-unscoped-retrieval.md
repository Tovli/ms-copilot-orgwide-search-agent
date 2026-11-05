# ADR 0001: Use native unscoped document retrieval

Status: Accepted for the implemented baseline.

This record captures a decision made during development; it does not authorize tenant deployment.

## Context

The brief requires discovery across all OneDrive and SharePoint sources available to the signed-in user, with minimal infrastructure and existing Microsoft 365 authorization. It explicitly excludes manually selected source scopes and custom retrieval services from the baseline.

## Decision

Use a Microsoft 365 Copilot declarative agent with only `{ "name": "OneDriveAndSharePoint" }`. Omit both source-scoping arrays. Exclude WebSearch, custom actions, connectors, Graph application permissions, and an independent backend/index. Use agent instructions and the supported model-knowledge discouragement setting for evidence-based presentation.

## Consequences

Microsoft manages retrieval and permission trimming. The implementation cannot control internal query expansion, engine ranking, index coverage, or exhaustive discovery. Instructions do not replace access controls or prove prompt-injection resistance. Existing oversharing remains a tenant responsibility. Any custom retrieval architecture needs measured evidence and separate approval.

## Evidence and alternatives

Official documentation and compiled output support the name-only capability; see [discovery](../TOOLCHAIN_DISCOVERY.md). Selected-file/site scope fails the broad-discovery requirement. A custom Graph/search backend adds infrastructure and permissions prohibited by the initial brief. Neither alternative was implemented.
