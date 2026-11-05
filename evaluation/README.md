# Local evaluation inputs

The two `sample-*.json` files are completely synthetic scorer demonstrations. They are invented observations, not Microsoft 365 execution logs. No organizational files, retrieval results or security tests are represented by them. The demonstration has one known relevant document per positive case and is scored at **k=5**, including the agent's intended concise-result behavior:

```shell
npm run evaluate -- --judgments evaluation/sample-judgments.json --results evaluation/sample-results.json --k 5
```

For a real pilot, create private copies under ignored `local/` or `evaluation/private/`. Use `results-template.json` for an empty recording file. Never upload those copies or their output as public CI artifacts. Follow [TESTING.md](../TESTING.md) to build the judgments and record observations. The script has no network calls and does not open documents or execute queries.

The judgments file has `schemaVersion: 1`, `evidenceType: "tenant"`, and a nonempty `cases` array. Each case has:

- `id`: stable, locally assigned case identifier.
- `query`: the actual test query; kept private and never echoed by the scorer.
- `queryLanguage` / `documentLanguage`: short language labels such as `en` and `he`; use a separate case for each intended direction.
- `category`: a non-sensitive category label, such as `cross-language`, `metadata` or `security`.
- `expectedNoResults`: whether no relevant, authorized match is expected in the reviewed corpus.
- `requiredChecks`: one or more of `permissionIsolation`, `promptInjectionResistance`, `sourceGrounding`, `responseLanguage`.
- `judgments`: `{ "documentId": "local-opaque-id", "relevance": 3 }` entries for all known positives and every returned document. Grade 0 is irrelevant; 1 is potentially relevant; 2 is relevant; 3 is a strong match. Human reviewers must preserve explicit query constraints when grading.

Gate targets are fixed in the reviewed repository policy **`org-document-search-pilot-v2`**. Neither judgments nor results may include a `thresholds` or `policy` field: the scorer rejects these inputs rather than allowing a run to choose its own pass criteria. Remove those fields when migrating older input files. Reports identify `policy.source: "repository"`, the policy ID, the cutoff `k`, and every effective threshold. Changes to targets require a reviewed source/policy-version change before collecting trials, plus an explicit record of the source revision in the private approval evidence. There is no custom-policy CLI option. These are project targets, not Microsoft guarantees. The pilot procedure also requires manual review, reasonable sample size, administrative approval and the complete matrix in TESTING.md; a green numeric report alone is insufficient.

The results file has `schemaVersion: 1`, matching `evidenceType`, and an `observations` array. Each observation records `caseId`, `outcome` (`results`, `no_results`, or `error`), `rankedDocumentIds`, `latencyMs`, and `checks`. Check statuses are `pass`, `fail` or `not_tested`. An omitted required check counts as not tested. **Source grounding and response language are mandatory on every trial**, including negative/error trials, even if omitted from the case's `requiredChecks`. Record an observation per repetition. Deduplicate file references before recording, preserving the first rank. Do not put document contents, source links or tenant identifiers in this format; keep any needed mapping in a separate private tenant-controlled record.

For `evidenceType: "tenant"`, the results file must also include `reviewCoverage` with each of `permissionIsolationAcrossAccounts`, `sensitivityControls`, `webIsolation` and `fullMatrixReviewed` set to `pass` after the corresponding tenant review. Use `not_tested` while pending; use `fail` for a failed review. The empty results template initializes all four to `not_tested`. An absent/pending attestation makes the pilot gate incomplete; a failure blocks it. `permissionIsolationAcrossAccounts` means the reviewer completed the differing-access two-account tests, including content, metadata and existence disclosure. Tenant scoring also requires observed positive `en->he` and `he->en` cases. These are self-reported review attestations: the script does not authenticate accounts, inspect permissions, verify security controls or establish that a human review actually occurred.

Every returned document must be judged, including irrelevant results. Unjudged IDs, duplicate file IDs, invalid grades, unknown cases and contradictory outcomes are rejected. `results` requires at least one ranked ID; `no_results` and `error` require an empty list. Record a partial or unavailable-source failure as `error`, with any diagnostic evidence held privately outside this format.

The scorer computes binary precision/known-positive recall and reciprocal rank from grades greater than zero, plus graded nDCG using gain `2^grade - 1`. For a stricter relevance definition, set grade 1 items to 0 under a documented rubric before the run.

The diagnostic **`precisionAtK`** retains the standard denominator k: one correct result at k=5 scores 0.20. The gate instead uses **`returnedPrecisionAtK`**, relevant results divided by the number actually returned within the first k. That same one-result list scores 1.00 returned precision, and can pass when it covers all known positives. This aligns the gate with the instruction to prefer a few strong matches and avoid quota-filling. Returned precision is **zero** for an empty list or retrieval error on a positive case. Returning one clean result while omitting other known relevant files can still fail recall; adding unrelated files reduces returned precision. Both metrics appear in overall, direction and category summaries, but only returned precision has a precision threshold.

Recall measures known positives in the reviewed corpus, not all documents in the tenant. An expected-no-result case has zero positive judgments; its ranking metrics are excluded and its outcome is assessed separately. A query with known positive documents that returns no results or an error receives **zero** on both precision metrics, recall, MRR and nDCG. A positive case with no known positive judgments is invalid, because its recall denominator cannot be established. Repetitions are averaged within each case, then cases receive equal quality weight. Latency percentiles use nearest rank across all raw observations, including errors.

Output contains aggregate metrics and category/language labels, not queries, document IDs or contents. Those labels must themselves be non-sensitive. Inputs labelled `tenant` remain **self-reported**; the script cannot verify their provenance. The report always has `productionReadinessEstablished: false`. Exit 0 means the recorded pilot targets passed; exit 1 means targets failed or evidence is incomplete; exit 2 means invalid input or a file-read error.
