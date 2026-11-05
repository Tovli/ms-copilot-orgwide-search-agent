import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, scoreEvaluation, validateEvaluation } from '../scripts/evaluate.mjs';

const fixture = () => ({
  judgments: {
    schemaVersion: 1, evidenceType: 'synthetic',
    cases: [
      { id: 'cross-language', query: 'Find product requirements', queryLanguage: 'en', documentLanguage: 'he', category: 'semantic', expectedNoResults: false,
        requiredChecks: ['sourceGrounding', 'responseLanguage'], judgments: [{ documentId: 'relevant', relevance: 3 }, { documentId: 'less-relevant', relevance: 1 }, { documentId: 'irrelevant', relevance: 0 }] },
      { id: 'no-match', query: 'Find a nonexistent fictional document', queryLanguage: 'en', documentLanguage: 'en', category: 'no-results', expectedNoResults: true,
        requiredChecks: ['permissionIsolation', 'promptInjectionResistance'], judgments: [] },
    ],
  },
  results: { schemaVersion: 1, evidenceType: 'synthetic', observations: [
    { caseId: 'cross-language', outcome: 'results', rankedDocumentIds: ['relevant', 'less-relevant'], latencyMs: 1000, checks: { sourceGrounding: 'pass', responseLanguage: 'pass' } },
    { caseId: 'no-match', outcome: 'no_results', rankedDocumentIds: [], latencyMs: 2000, checks: { permissionIsolation: 'pass', promptInjectionResistance: 'pass', sourceGrounding: 'pass', responseLanguage: 'pass' } },
  ] },
});

function tenantFixture() {
  const inputs = fixture();
  inputs.judgments.evidenceType = 'tenant';
  inputs.results.evidenceType = 'tenant';
  inputs.judgments.cases.push({ ...structuredClone(inputs.judgments.cases[0]), id: 'hebrew-to-english', queryLanguage: 'he', documentLanguage: 'en' });
  inputs.results.observations.push({ ...structuredClone(inputs.results.observations[0]), caseId: 'hebrew-to-english' });
  inputs.results.reviewCoverage = { permissionIsolationAcrossAccounts: 'pass', sensitivityControls: 'pass', webIsolation: 'pass', fullMatrixReviewed: 'pass' };
  return inputs;
}

test('source grounding and response language must be reviewed on every trial regardless of case assignments', () => {
  const { judgments, results } = fixture();
  delete results.observations[1].checks.sourceGrounding;
  assert.equal(scoreEvaluation(judgments, results, 2).pilotGate, 'incomplete');
  results.observations[1].checks.sourceGrounding = 'pass';
  delete results.observations[1].checks.responseLanguage;
  assert.equal(scoreEvaluation(judgments, results, 2).pilotGate, 'incomplete');
});

test('tenant pilot requires observed positives in both English/Hebrew directions', () => {
  const { judgments, results } = tenantFixture();
  assert.equal(scoreEvaluation(judgments, results, 2).pilotGate, 'pass');
  judgments.cases.pop();
  results.observations.pop();
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.pilotGate, 'incomplete');
  assert.ok(report.incomplete.some((message) => message.includes('he->en')));
});

test('tenant pilot cannot pass with missing two-account/sensitivity/web/full-matrix review', () => {
  const { judgments, results } = tenantFixture();
  delete results.reviewCoverage;
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.pilotGate, 'incomplete');
  assert.equal(report.evidenceType, 'self-reported tenant observations');
  assert.equal(report.productionReadinessEstablished, false);
  assert.deepEqual(Object.values(report.reviewCoverage), ['not_tested', 'not_tested', 'not_tested', 'not_tested']);
});

test('every tenant coverage attestation independently blocks pass when omitted or failed', () => {
  for (const check of ['permissionIsolationAcrossAccounts', 'sensitivityControls', 'webIsolation', 'fullMatrixReviewed']) {
    const { judgments, results } = tenantFixture();
    delete results.reviewCoverage[check];
    assert.equal(scoreEvaluation(judgments, results, 2).pilotGate, 'incomplete');
    results.reviewCoverage[check] = 'fail';
    assert.equal(scoreEvaluation(judgments, results, 2).pilotGate, 'fail');
  }
});

test('tenant coverage accepts only explicit supported statuses and fields', () => {
  const { judgments, results } = tenantFixture();
  results.reviewCoverage.webIsolation = true;
  assert.throws(() => scoreEvaluation(judgments, results, 2), /reviewCoverage/);
  results.reviewCoverage.webIsolation = 'pass';
  results.reviewCoverage.madeUp = 'pass';
  assert.throws(() => scoreEvaluation(judgments, results, 2), /reviewCoverage/);
});

test('scores precision, known-positive recall, reciprocal rank and graded nDCG', () => {
  const { judgments, results } = fixture();
  results.observations[0].rankedDocumentIds = ['irrelevant', 'less-relevant', 'relevant'];
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.aggregate.precisionAtK, 0.5);
  assert.equal(report.aggregate.recallAtK, 0.5);
  assert.equal(report.aggregate.mrrAtK, 0.5);
  assert.ok(Math.abs(report.aggregate.ndcgAtK - (1 / Math.log2(3)) / (7 + 1 / Math.log2(3))) < 1e-12);
  assert.equal(report.pilotGate, 'fail');
});

test('perfect synthetic scores can pass pilot targets without claiming production readiness', () => {
  const { judgments, results } = fixture();
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.pilotGate, 'pass');
  assert.equal(report.aggregate.precisionAtK, 1);
  assert.equal(report.aggregate.recallAtK, 1);
  assert.equal(report.aggregate.ndcgAtK, 1);
  assert.equal(report.aggregate.noResultAccuracy, 1);
  assert.equal(report.aggregate.p95LatencyMs, 2000);
  assert.equal(report.productionReadinessEstablished, false);
  assert.equal(report.evidenceType, 'synthetic demonstration only');
  assert.equal(report.directions['en->he'].mrrAtK, 1);
});

test('one correct document at k=5 passes the concise-results gate with textbook precision retained', () => {
  const { judgments, results } = fixture();
  judgments.cases[0].judgments = [{ documentId: 'relevant', relevance: 3 }];
  results.observations[0].rankedDocumentIds = ['relevant'];
  const report = scoreEvaluation(judgments, results, 5);
  assert.equal(report.aggregate.precisionAtK, 0.2);
  assert.equal(report.aggregate.returnedPrecisionAtK, 1);
  assert.equal(report.aggregate.recallAtK, 1);
  assert.equal(report.pilotGate, 'pass');
  assert.deepEqual(report.policy, { source: 'repository', id: 'org-document-search-pilot-v2' });
  assert.equal(report.thresholds.returnedPrecisionAtK, 0.8);
  assert.equal(report.thresholds.precisionAtK, undefined);
});

test('two correct documents at k=5 pass without filling empty result slots', () => {
  const { judgments, results } = fixture();
  const report = scoreEvaluation(judgments, results, 5);
  assert.equal(report.aggregate.precisionAtK, 0.4);
  assert.equal(report.aggregate.returnedPrecisionAtK, 1);
  assert.equal(report.pilotGate, 'pass');
});

test('noisy returned lists fail precision and concise lists missing positives still fail recall', () => {
  const { judgments, results } = fixture();
  results.observations[0].rankedDocumentIds = ['relevant', 'irrelevant'];
  const noisy = scoreEvaluation(judgments, results, 5);
  assert.equal(noisy.aggregate.returnedPrecisionAtK, 0.5);
  assert.ok(noisy.failures.includes('Overall: returnedPrecisionAtK below target'));
  results.observations[0].rankedDocumentIds = ['relevant'];
  const missing = scoreEvaluation(judgments, results, 5);
  assert.equal(missing.aggregate.returnedPrecisionAtK, 1);
  assert.equal(missing.aggregate.recallAtK, 0.5);
  assert.ok(missing.failures.includes('Overall: recallAtK below target'));
  assert.equal(missing.pilotGate, 'fail');
});

test('returned precision examines only the first k documents and empty positive results score zero', () => {
  const { judgments, results } = fixture();
  results.observations[0].rankedDocumentIds = ['relevant', 'less-relevant', 'irrelevant'];
  assert.equal(scoreEvaluation(judgments, results, 2).aggregate.returnedPrecisionAtK, 1);
  results.observations[0].rankedDocumentIds = [];
  results.observations[0].outcome = 'no_results';
  const report = scoreEvaluation(judgments, results, 5);
  assert.equal(report.aggregate.returnedPrecisionAtK, 0);
  assert.equal(report.pilotGate, 'fail');
});

test('input judgments or results cannot lower, raise or replace the fixed repository gate policy', () => {
  for (const input of ['judgments', 'results']) for (const key of ['thresholds', 'policy']) for (const override of [{ returnedPrecisionAtK: 0 }, { returnedPrecisionAtK: 1 }, {}, null]) {
    const inputs = fixture();
    inputs[input][key] = override;
    assert.throws(() => scoreEvaluation(inputs.judgments, inputs.results, 5), /cannot define gate policy/);
  }
});

test('retrieval errors count as misses and cannot be presented as successful no-result behavior', () => {
  const { judgments, results } = fixture();
  results.observations.forEach((observation) => { observation.outcome = 'error'; observation.rankedDocumentIds = []; });
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.aggregate.precisionAtK, 0);
  assert.equal(report.aggregate.returnedPrecisionAtK, 0);
  assert.equal(report.aggregate.recallAtK, 0);
  assert.equal(report.aggregate.noResultAccuracy, 0);
  assert.equal(report.aggregate.errorRate, 1);
});

test('supplied summary fields cannot override computed no-result or error metrics', () => {
  const { judgments, results } = fixture();
  results.observations[1].outcome = 'error';
  results.observations[1].noResultAccuracy = 1;
  results.observations[1].errorRate = 0;
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.aggregate.noResultAccuracy, 0);
  assert.equal(report.aggregate.errorRate, 0.5);
  assert.equal(report.directions['en->en'].noResultAccuracy, 0);
  assert.equal(report.pilotGate, 'fail');
});

test('repetitions do not allow an easy case to dominate macro quality', () => {
  const { judgments, results } = fixture();
  judgments.cases.push({ ...structuredClone(judgments.cases[0]), id: 'hard-case' });
  results.observations.push(...Array.from({ length: 8 }, () => structuredClone(results.observations[0])));
  results.observations.push({ ...structuredClone(results.observations[0]), caseId: 'hard-case', rankedDocumentIds: [], outcome: 'no_results' });
  assert.equal(scoreEvaluation(judgments, results, 2).aggregate.precisionAtK, 0.5);
});

test('one weak language direction cannot be hidden in overall quality', () => {
  const { judgments, results } = fixture();
  judgments.cases.push({ ...structuredClone(judgments.cases[0]), id: 'reverse', queryLanguage: 'he', documentLanguage: 'en' });
  results.observations.push({ ...structuredClone(results.observations[0]), caseId: 'reverse', rankedDocumentIds: [], outcome: 'no_results' });
  assert.ok(scoreEvaluation(judgments, results, 2).failures.includes('he->en: returnedPrecisionAtK below target'));
});

test('missing observations and missing manual security checks produce incomplete evidence', () => {
  const { judgments, results } = fixture();
  results.observations.pop();
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.pilotGate, 'incomplete');
  assert.equal(report.manualChecks.permissionIsolation, 'not_tested');
  assert.equal(report.observedCases, 1);
});

test('no observations remain incomplete with null metrics', () => {
  const { judgments, results } = fixture();
  results.observations = [];
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.pilotGate, 'incomplete');
  assert.equal(report.aggregate.precisionAtK, null);
});

test('any security failure fails the gate even when the check was not assigned to that case', () => {
  const { judgments, results } = fixture();
  results.observations[0].checks.permissionIsolation = 'fail';
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.pilotGate, 'fail');
  assert.equal(report.manualChecks.permissionIsolation, 'fail');
});

test('not_tested is never silently converted to pass', () => {
  const { judgments, results } = fixture();
  results.observations[1].checks.permissionIsolation = 'not_tested';
  assert.equal(scoreEvaluation(judgments, results, 2).pilotGate, 'incomplete');
});

test('unjudged, duplicate and mismatched results are rejected before scoring', () => {
  const { judgments, results } = fixture();
  results.observations[0].rankedDocumentIds = ['unknown'];
  assert.throws(() => validateEvaluation(judgments, results), /unjudged/);
  results.observations[0].rankedDocumentIds = ['relevant', 'relevant'];
  assert.throws(() => validateEvaluation(judgments, results), /duplicate/);
  results.observations[0].rankedDocumentIds = [];
  assert.throws(() => validateEvaluation(judgments, results), /conflicts/);
});

test('negative cases must have zero known positives and positive cases at least one', () => {
  const { judgments, results } = fixture();
  judgments.cases[0].expectedNoResults = true;
  assert.throws(() => validateEvaluation(judgments, results), /known positives/);
  judgments.cases[0].expectedNoResults = false;
  judgments.cases[0].judgments = [];
  assert.throws(() => validateEvaluation(judgments, results), /known positives/);
});

test('invalid schemas, grades, latencies, thresholds and k values are rejected', () => {
  for (const change of [
    ({ judgments }) => { judgments.schemaVersion = 2; },
    ({ results }) => { results.evidenceType = 'tenant'; },
    ({ judgments }) => { judgments.cases[0].judgments[0].relevance = 4; },
    ({ judgments }) => { judgments.cases[0].id = 'no-match'; },
    ({ results }) => { results.observations[0].latencyMs = NaN; },
    ({ results }) => { results.observations[0].latencyMs = -1; },
    ({ results }) => { results.observations[0].caseId = 'unknown'; },
    ({ results }) => { results.observations[0].checks.permissionIsolation = true; },
    ({ judgments }) => { judgments.thresholds = { recallAtK: 2 }; },
    ({ judgments }) => { judgments.thresholds = { madeUp: 1 }; },
    ({ judgments }) => { judgments.thresholds = { toString: 0 }; },
  ]) {
    const inputs = fixture(); change(inputs);
    assert.throws(() => validateEvaluation(inputs.judgments, inputs.results));
  }
  for (const k of [0, -1, 1.5, NaN, 101]) {
    const { judgments, results } = fixture();
    assert.throws(() => validateEvaluation(judgments, results, k), /k must/);
  }
});

test('latency and error thresholds are enforced', () => {
  const { judgments, results } = fixture();
  results.observations[0].latencyMs = 20000;
  assert.ok(scoreEvaluation(judgments, results, 2).failures.includes('p95 latency above target'));
});

test('repeated negative cases and language latency slices preserve raw failures and timing', () => {
  const { judgments, results } = fixture();
  results.observations.push({ ...structuredClone(results.observations[1]), outcome: 'error', latencyMs: 25000 });
  const report = scoreEvaluation(judgments, results, 2);
  assert.equal(report.aggregate.noResultAccuracy, 0.5);
  assert.equal(report.directions['en->en'].noResultAccuracy, 0.5);
  assert.equal(report.directions['en->en'].errorRate, 0.5);
  assert.equal(report.directions['en->en'].p95LatencyMs, 25000);
});

test('CLI requires explicit paths and rejects unknown, duplicate or missing arguments', () => {
  assert.deepEqual(parseArgs(['--judgments', 'a.json', '--results', 'b.json', '--k', '3']), { judgmentsPath: 'a.json', resultsPath: 'b.json', k: 3 });
  for (const args of [[], ['--results', 'a.json'], ['--unknown', 'a'], ['--judgments'], ['--judgments', 'a', '--judgments', 'b']]) assert.throws(() => parseArgs(args));
});

test('public demonstration fixtures remain synthetic and pass the same k=5 gate as concise results', async () => {
  const read = async (name) => JSON.parse(await readFile(new URL(`../evaluation/${name}`, import.meta.url), 'utf8'));
  const report = scoreEvaluation(await read('sample-judgments.json'), await read('sample-results.json'), 5);
  assert.equal(report.pilotGate, 'pass');
  assert.equal(report.evidenceType, 'synthetic demonstration only');
});

test('CLI reports aggregate-only output and meaningful pass/fail/read-error exit codes', async () => {
  const script = fileURLToPath(new URL('../scripts/evaluate.mjs', import.meta.url));
  const judgments = fileURLToPath(new URL('../evaluation/sample-judgments.json', import.meta.url));
  const results = fileURLToPath(new URL('../evaluation/sample-results.json', import.meta.url));
  const args = [script, '--judgments', judgments, '--results', results];
  const passed = spawnSync(process.execPath, [...args, '--k', '5'], { encoding: 'utf8' });
  assert.equal(passed.status, 0);
  assert.equal(JSON.parse(passed.stdout).pilotGate, 'pass');
  assert.ok(!passed.stdout.includes('synthetic-marketing'));
  assert.ok(!passed.stdout.includes('Find marketing documents'));
  assert.ok(!passed.stdout.includes('rankedDocumentIds'));
  const temp = await mkdtemp(path.join(tmpdir(), 'org-search-evaluation-'));
  try {
    const badResults = JSON.parse(await readFile(results, 'utf8'));
    badResults.observations[0].outcome = 'no_results';
    badResults.observations[0].rankedDocumentIds = [];
    const badResultsPath = path.join(temp, 'results.json');
    await writeFile(badResultsPath, JSON.stringify(badResults));
    const failed = spawnSync(process.execPath, [script, '--judgments', judgments, '--results', badResultsPath, '--k', '5'], { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.equal(JSON.parse(failed.stdout).pilotGate, 'fail');
    const badJudgments = JSON.parse(await readFile(judgments, 'utf8'));
    badJudgments.thresholds = { returnedPrecisionAtK: 0 };
    const badJudgmentsPath = path.join(temp, 'judgments.json');
    await writeFile(badJudgmentsPath, JSON.stringify(badJudgments));
    const invalid = spawnSync(process.execPath, [script, '--judgments', badJudgmentsPath, '--results', results], { encoding: 'utf8' });
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /cannot define gate policy/);
    assert.equal(invalid.stdout, '');
  } finally {
    assert(path.resolve(temp).startsWith(path.resolve(tmpdir()) + path.sep + 'org-search-evaluation-'));
    await rm(temp, { recursive: true, force: true });
  }
  const unreadable = spawnSync(process.execPath, [script, '--judgments', 'PRIVATE-NONEXISTENT-PATH.json', '--results', results], { encoding: 'utf8' });
  assert.equal(unreadable.status, 2);
  assert.ok(!unreadable.stderr.includes('PRIVATE-NONEXISTENT-PATH'));
});
