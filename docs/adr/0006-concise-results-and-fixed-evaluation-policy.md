# ADR 0006: Align pilot precision with concise results and freeze gate policy

Status: Accepted as review remediation.

## Context

The instructions prefer a few strong results. Standard precision@5 divides hits by five even when a narrow query has only one correct answer. Its previous 0.80 acceptance target therefore penalized the intended behavior. Thresholds supplied by the same judgments file could also turn a weaker run into a passing report.

## Decision

Keep standard `precisionAtK = hits / k` as a breadth diagnostic. Gate on `returnedPrecisionAtK = hits / returnedCountWithinK` with target 0.80; empty/error responses to positive cases score zero. Retain recall, reciprocal-rank, graded nDCG, language-direction and security acceptance checks so a short list cannot hide missing known positives or failed security evidence.

Use the versioned repository policy `org-document-search-pilot-v2`. Reject `thresholds` and `policy` fields in both judgments and results. Reports identify the policy source, ID, effective targets and cutoff. A target change requires a reviewed repository change and new policy ID before collecting trials. There is no custom-policy command-line option.

## Consequences

One or two correct documents can satisfy a narrow query without filling empty slots. Irrelevant additions lower returned precision, and omitted known positives still reduce recall. Old inputs containing threshold overrides must remove those fields. The recorded cutoff and source revision remain part of private review evidence. Numeric acceptance remains a score of self-reported observations; it cannot establish authenticated provenance or production readiness.

## Verification

Regression tests cover one/two correct results at k=5, noisy results, missing positives, empty/error responses, and attempted policy overrides from both inputs. See [TESTING](../../TESTING.md), [evaluation format](../../evaluation/README.md), and the [implementation report](../../IMPLEMENTATION_REPORT.md).
