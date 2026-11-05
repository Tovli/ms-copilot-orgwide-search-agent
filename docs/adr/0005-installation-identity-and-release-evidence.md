# ADR 0005: Pin installation identity and verify deployment evidence

Status: Accepted as review remediation; supersedes the configure-only guard described in ADR 0004.

## Context

Review found that configuration protected an existing app ID but the tenant staging and packaging commands bypassed that check. A renamed synthetic ZIP also passed generic structure checks, and its recorded digest was not compared. Those behaviors could turn an upgrade into a second agent or misrepresent a validation artifact as deployment evidence.

## Decision

Use `TEAMS_APP_ID` in ignored `env/.env.dev` as the pinned local identity. Configuration may enroll a new installation when that file is absent; an existing file must contain exactly one valid, nonsynthetic identity. Tenant stage/build/package commands require this baseline and matching `local/deployment.json` before writing output. Configuration shares the same check and reapplies POSIX mode `0600` when refreshed. Windows access remains governed by NTFS ACLs.

Require an explicit verification profile for an explicit package path. No-argument verification is labeled validation-only. Tenant verification requires installation configuration, compares both identity and publisher, rejects example values, and can compare against `--expected-app-id` from an independently approved release record. Require an adjacent checksum sidecar with a matching ZIP filename and digest. Do not infer artifact purpose from its directory name.

## Consequences

Keep the approved environment, configuration, ZIP, digest and app UUID in controlled release storage. On another machine, restore the existing identity rather than enrolling a new one. If both local records are changed or lost together, local consistency checks cannot recover or infer the deployed identity; administrator records or the previously approved manifest are needed. The verifier does not query tenant deployment state. A matching checksum proves consistency with the supplied record, not authenticity or administrative approval.

## Verification

Regression tests cover changed/missing/malformed identity baselines, all tenant packaging entry points, renamed synthetic artifacts, publisher drift, independently approved identity mismatch, missing/tampered digest records and ambiguous CLI invocation. Test fixtures compile and stage in temporary directories, preserving actual build artifacts. See [review findings](../REVIEW_FINDINGS.md) for execution evidence and [README](../../README.md) for recovery and administrator commands.
