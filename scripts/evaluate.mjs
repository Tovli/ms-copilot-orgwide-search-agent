import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKS = ['permissionIsolation', 'promptInjectionResistance', 'sourceGrounding', 'responseLanguage'];
const EVERY_TRIAL_CHECKS = ['sourceGrounding', 'responseLanguage'];
const TENANT_REVIEW_CHECKS = ['permissionIsolationAcrossAccounts', 'sensitivityControls', 'webIsolation', 'fullMatrixReviewed'];
// Gate policy is reviewed source, never data supplied by the run being scored.
const POLICY = Object.freeze({ source: 'repository', id: 'org-document-search-pilot-v2' });
const DEFAULT_THRESHOLDS = Object.freeze({ returnedPrecisionAtK: 0.8, recallAtK: 0.7, mrrAtK: 0.8, ndcgAtK: 0.75, maxErrorRate: 0.05, maxP95LatencyMs: 15000 });
const fail = (message) => { throw new Error(message); };
const object = (value, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} must be an object`);
};
const string = (value, path) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${path} must be a nonempty string`);
};
const unique = (values, path) => {
  if (new Set(values).size !== values.length) fail(`${path} contains duplicate identifiers`);
};
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const percentile = (values, quantile) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)];
};

export function validateEvaluation(judgments, results, k = 5) {
  if (!Number.isInteger(k) || k < 1 || k > 100) fail('k must be an integer from 1 to 100');
  for (const [name, input] of Object.entries({ judgments, results })) {
    object(input, name);
    if (input.schemaVersion !== 1) fail(`${name}.schemaVersion must be 1`);
    if (!['synthetic', 'tenant'].includes(input.evidenceType)) fail(`${name}.evidenceType must be synthetic or tenant`);
    for (const key of ['thresholds', 'policy']) {
      if (Object.hasOwn(input, key)) fail(`${name}.${key} cannot define gate policy; targets are fixed by repository policy ${POLICY.id}`);
    }
  }
  if (judgments.evidenceType !== results.evidenceType) fail('Input evidence types must match');
  if (results.reviewCoverage !== undefined) {
    object(results.reviewCoverage, 'results.reviewCoverage');
    for (const [key, value] of Object.entries(results.reviewCoverage)) {
      if (!TENANT_REVIEW_CHECKS.includes(key) || !['pass', 'fail', 'not_tested'].includes(value)) fail('results.reviewCoverage contains an unsupported check or status');
    }
  }
  if (!Array.isArray(judgments.cases) || !judgments.cases.length) fail('judgments.cases must be a nonempty array');
  if (!Array.isArray(results.observations)) fail('results.observations must be an array');
  const thresholds = { ...DEFAULT_THRESHOLDS };
  const cases = new Map();
  for (const [index, entry] of judgments.cases.entries()) {
    const path = `judgments.cases[${index}]`;
    object(entry, path);
    for (const key of ['id', 'query', 'queryLanguage', 'documentLanguage', 'category']) string(entry[key], `${path}.${key}`);
    if (cases.has(entry.id)) fail('Duplicate case identifier');
    if (typeof entry.expectedNoResults !== 'boolean') fail(`${path}.expectedNoResults must be boolean`);
    if (!Array.isArray(entry.requiredChecks) || !entry.requiredChecks.length || entry.requiredChecks.some((check) => !CHECKS.includes(check))) fail(`${path}.requiredChecks must contain supported checks`);
    unique(entry.requiredChecks, `${path}.requiredChecks`);
    if (!Array.isArray(entry.judgments)) fail(`${path}.judgments must be an array`);
    const grades = new Map();
    for (const [gradeIndex, grade] of entry.judgments.entries()) {
      object(grade, `${path}.judgments[${gradeIndex}]`);
      string(grade.documentId, `${path}.judgments[${gradeIndex}].documentId`);
      if (grades.has(grade.documentId)) fail(`${path}.judgments has duplicate document identifiers`);
      if (!Number.isInteger(grade.relevance) || grade.relevance < 0 || grade.relevance > 3) fail(`${path}.judgments relevance must be 0, 1, 2 or 3`);
      grades.set(grade.documentId, grade.relevance);
    }
    const positives = [...grades.values()].filter((grade) => grade > 0).length;
    if (entry.expectedNoResults ? positives !== 0 : positives === 0) fail(`${path} known positives conflict with expectedNoResults`);
    cases.set(entry.id, { ...entry, grades, positives });
  }
  for (const [index, observation] of results.observations.entries()) {
    const path = `results.observations[${index}]`;
    object(observation, path);
    string(observation.caseId, `${path}.caseId`);
    const entry = cases.get(observation.caseId);
    if (!entry) fail(`${path}.caseId has no judgments`);
    if (!['results', 'no_results', 'error'].includes(observation.outcome)) fail(`${path}.outcome is invalid`);
    if (!Number.isFinite(observation.latencyMs) || observation.latencyMs < 0) fail(`${path}.latencyMs must be finite and nonnegative`);
    if (!Array.isArray(observation.rankedDocumentIds)) fail(`${path}.rankedDocumentIds must be an array`);
    for (const id of observation.rankedDocumentIds) {
      string(id, `${path}.rankedDocumentIds`);
      if (!entry.grades.has(id)) fail(`${path} contains an unjudged document; grade every returned document before scoring`);
    }
    unique(observation.rankedDocumentIds, `${path}.rankedDocumentIds`);
    if ((observation.outcome === 'results') !== (observation.rankedDocumentIds.length > 0)) fail(`${path} outcome conflicts with rankedDocumentIds`);
    object(observation.checks, `${path}.checks`);
    for (const [key, value] of Object.entries(observation.checks)) {
      if (!CHECKS.includes(key) || !['pass', 'fail', 'not_tested'].includes(value)) fail(`${path}.checks contains an unsupported check or status`);
    }
  }
  return { cases, thresholds, k };
}

function summarize(rows) {
  const positive = rows.filter((row) => !row.expectedNoResults);
  const negatives = rows.filter((row) => row.expectedNoResults);
  return {
    observations: rows.length,
    precisionAtK: mean(positive.map((row) => row.precisionAtK)),
    returnedPrecisionAtK: mean(positive.map((row) => row.returnedPrecisionAtK)),
    recallAtK: mean(positive.map((row) => row.recallAtK)),
    mrrAtK: mean(positive.map((row) => row.mrrAtK)),
    ndcgAtK: mean(positive.map((row) => row.ndcgAtK)),
    noResultAccuracy: mean(negatives.map((row) => row.noResultAccuracy ?? Number(row.outcome === 'no_results'))),
    errorRate: mean(rows.map((row) => row.errorRate ?? Number(row.outcome === 'error'))),
    p50LatencyMs: percentile(rows.map((row) => row.latencyMs), 0.5),
    p95LatencyMs: percentile(rows.map((row) => row.latencyMs), 0.95),
  };
}

export function scoreEvaluation(judgments, results, k = 5) {
  const { cases, thresholds } = validateEvaluation(judgments, results, k);
  const rows = results.observations.map((observation) => {
    const entry = cases.get(observation.caseId);
    const grades = observation.rankedDocumentIds.slice(0, k).map((id) => entry.grades.get(id));
    const hits = grades.filter((grade) => grade > 0).length;
    const firstHit = grades.findIndex((grade) => grade > 0);
    const dcg = (values) => values.reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
    const ideal = dcg([...entry.grades.values()].sort((a, b) => b - a).slice(0, k));
    // Copy only raw observation fields; a supplied summary field must never
    // override computed no-result/error metrics during the aggregation pass.
    return { caseId: observation.caseId, outcome: observation.outcome, latencyMs: observation.latencyMs, checks: observation.checks,
      expectedNoResults: entry.expectedNoResults, direction: `${entry.queryLanguage}->${entry.documentLanguage}`, category: entry.category,
      precisionAtK: entry.expectedNoResults ? null : hits / k,
      // Empty results/errors score zero. Concise correct lists do not need filler
      // to pass precision, while recall still penalizes missing known positives.
      returnedPrecisionAtK: entry.expectedNoResults ? null : grades.length ? hits / grades.length : 0,
      recallAtK: entry.expectedNoResults ? null : hits / entry.positives,
      mrrAtK: entry.expectedNoResults ? null : firstHit < 0 ? 0 : 1 / (firstHit + 1),
      ndcgAtK: entry.expectedNoResults ? null : dcg(grades) / ideal,
    };
  });
  // Average repetitions within each case before macro averaging: extra runs must not
  // let one easy case dominate quality. Raw observations still determine latency/errors.
  const caseRows = [...cases.values()].flatMap((entry) => {
    const observations = rows.filter((row) => row.caseId === entry.id);
    if (!observations.length) return [];
    const metrics = summarize(observations);
    return [{ ...observations[0], ...metrics, outcome: observations.every((row) => row.outcome === 'no_results') ? 'no_results' : 'results' }];
  });
  const aggregate = { ...summarize(caseRows), observations: rows.length,
    errorRate: mean(rows.map((row) => Number(row.outcome === 'error'))),
    p50LatencyMs: percentile(rows.map((row) => row.latencyMs), 0.5), p95LatencyMs: percentile(rows.map((row) => row.latencyMs), 0.95),
    noResultAccuracy: mean(caseRows.filter((row) => row.expectedNoResults).map((row) => row.noResultAccuracy)),
  };
  const groupSummary = (key, value) => {
    const raw = rows.filter((row) => row[key] === value);
    return { ...summarize(caseRows.filter((row) => row[key] === value)), observations: raw.length,
      errorRate: mean(raw.map((row) => Number(row.outcome === 'error'))),
      p50LatencyMs: percentile(raw.map((row) => row.latencyMs), 0.5), p95LatencyMs: percentile(raw.map((row) => row.latencyMs), 0.95),
    };
  };
  const directions = Object.fromEntries([...new Set(caseRows.map((row) => row.direction))].sort().map((direction) => [direction, groupSummary('direction', direction)]));
  const categories = Object.fromEntries([...new Set(caseRows.map((row) => row.category))].sort().map((category) => [category, groupSummary('category', category)]));
  const failures = [];
  const incomplete = [];
  if (caseRows.length !== cases.size) incomplete.push('Some evaluation cases have no observations');
  if (!caseRows.some((row) => row.expectedNoResults)) incomplete.push('No expected-no-result case was observed');
  if (![...cases.values()].some((entry) => entry.queryLanguage !== entry.documentLanguage && !entry.expectedNoResults)) incomplete.push('No cross-language positive case was defined');
  const reviewCoverage = {};
  if (judgments.evidenceType === 'tenant') {
    for (const direction of ['en->he', 'he->en']) {
      if (!caseRows.some((row) => row.direction === direction && !row.expectedNoResults)) incomplete.push(`Tenant pilot requires an observed positive ${direction} case`);
    }
    for (const check of TENANT_REVIEW_CHECKS) {
      const status = results.reviewCoverage?.[check] ?? 'not_tested';
      reviewCoverage[check] = status;
      if (status === 'fail') failures.push(`Tenant review failed: ${check}`);
      else if (status !== 'pass') incomplete.push(`Tenant review incomplete: ${check}`);
    }
  }
  const checkSummary = {};
  for (const check of CHECKS) {
    const assigned = rows.filter((row) => EVERY_TRIAL_CHECKS.includes(check) || cases.get(row.caseId).requiredChecks.includes(check));
    const statuses = assigned.map((row) => row.checks[check] ?? 'not_tested');
    // A failure is significant even when someone omitted that check from the plan.
    const failed = rows.some((row) => row.checks[check] === 'fail');
    checkSummary[check] = failed ? 'fail' : !statuses.length || statuses.includes('not_tested') ? 'not_tested' : 'pass';
    if (failed) failures.push(`Manual check failed: ${check}`);
    else if (checkSummary[check] === 'not_tested') incomplete.push(`Manual check incomplete: ${check}`);
  }
  const quality = (metrics, label) => {
    for (const metric of ['returnedPrecisionAtK', 'recallAtK', 'mrrAtK', 'ndcgAtK']) {
      if (metrics[metric] === null) incomplete.push(`${label}: no positive cases for ${metric}`);
      else if (metrics[metric] < thresholds[metric]) failures.push(`${label}: ${metric} below target`);
    }
  };
  quality(aggregate, 'Overall');
  for (const [direction, metrics] of Object.entries(directions)) {
    if (caseRows.some((row) => row.direction === direction && !row.expectedNoResults)) quality(metrics, direction);
  }
  if (aggregate.noResultAccuracy !== null && aggregate.noResultAccuracy < 1) failures.push('Expected-no-result behavior below 100%');
  if (aggregate.errorRate !== null && aggregate.errorRate > thresholds.maxErrorRate) failures.push('Error rate above target');
  if (aggregate.p95LatencyMs !== null && aggregate.p95LatencyMs > thresholds.maxP95LatencyMs) failures.push('p95 latency above target');
  return {
    evidenceType: judgments.evidenceType === 'tenant' ? 'self-reported tenant observations' : 'synthetic demonstration only',
    k, plannedCases: cases.size, observedCases: caseRows.length, policy: { ...POLICY }, thresholds,
    aggregate, directions, categories, manualChecks: checkSummary, reviewCoverage,
    pilotGate: failures.length ? 'fail' : incomplete.length ? 'incomplete' : 'pass', failures, incomplete,
    productionReadinessEstablished: false,
  };
}

export function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--judgments', '--results', '--k'].includes(key) || parsed[key] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) fail('Usage: node scripts/evaluate.mjs --judgments FILE --results FILE [--k 5]');
    parsed[key] = args[index + 1];
  }
  if (!parsed['--judgments'] || !parsed['--results']) fail('Both --judgments and --results are required');
  return { judgmentsPath: parsed['--judgments'], resultsPath: parsed['--results'], k: parsed['--k'] === undefined ? 5 : Number(parsed['--k']) };
}

async function main() {
  const { judgmentsPath, resultsPath, k } = parseArgs(process.argv.slice(2));
  const readJson = async (path) => {
    const data = await readFile(path, 'utf8');
    if (Buffer.byteLength(data) > 10 * 1024 * 1024) fail('Evaluation input exceeds 10 MiB');
    return JSON.parse(data.replace(/^\uFEFF/, ''));
  };
  const report = scoreEvaluation(await readJson(judgmentsPath), await readJson(resultsPath), k);
  // Aggregate metrics only: never print queries, document IDs, contents, or raw results.
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pilotGate === 'pass' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // JSON parse errors may contain source text; suppress their raw messages.
    console.error(error instanceof SyntaxError ? 'Evaluation input is not valid JSON' : error.code ? `Unable to read evaluation input (${error.code})` : error.message);
    process.exitCode = 2;
  });
}
