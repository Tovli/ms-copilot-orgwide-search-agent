# Contributing

Keep the agent organization-independent and native to Microsoft 365. Read [README.md](README.md), [SECURITY.md](SECURITY.md), and [LIMITATIONS.md](LIMITATIONS.md) first.

## Development

Install the supported Node.js version and use `npm ci --ignore-scripts` to install the lockfile. Run `npm run build`, `npm run validate`, `npm test`, `npm run package`, `npm run verify-package`, `npm run secrets`, and `npm audit --audit-level=moderate` before opening a pull request. README describes the pinned Toolkit and compiler versions. Public CI requires no Microsoft 365 credentials.

Use UTF-8, preserve Hebrew examples, keep JSON/schema references consistent, and use native Node.js modules for small build utilities. Update the lockfile intentionally when changing dependencies. Avoid runtime services, Graph permissions, connectors, telemetry, and scope restrictions unless an accepted design explicitly changes the architecture.

Add tests for changed configuration and package boundaries, particularly rejection of restricted scopes, extra capabilities, unsafe configuration, secrets, and tenant-specific source data. Keep sample fixtures fictional. A mock test must never be described as evidence of retrieval relevance or permission isolation in Microsoft 365.

`npm test` compiles its agent fixture into a temporary directory and uses isolated package staging; it needs installed dependencies but no prior build or tenant configuration. Secret scanning includes publishable env examples and all tracked text files. Use symbolic placeholders in examples, never sample live credentials. Evaluation pass targets are a versioned repository policy; proposed changes need a reviewed source change rather than overrides embedded in evaluation inputs.

## Pull requests and issues

Describe the concrete behavior before and after the change, its reason, relevant validation, and outstanding tenant checks. Update public instructions, the changelog, and evaluation cases when behavior or setup changes. Never attach live query results, documents, tokens, private sites, or tenant identifiers to an issue or CI log.

Bug reports should include version, operating system, command, sanitized error, and a synthetic reproduction. Feature proposals should explain the document-discovery problem, measurable success criteria, and whether native capabilities already address it. Architecture changes need evidence from evaluation before adding infrastructure.

Use semantic versioning. Identify breaking changes explicitly, provide migration and rollback guidance, and preserve an existing installation's app identity during supported upgrades. A manifest or emitter upgrade needs a compiled-output diff, schema validation, package inspection, and pilot re-evaluation.

## Review and releases

Maintainers review security-sensitive manifest changes, dependency updates, deployment configuration, and release contents. Tenant integration tests are optional for ordinary contributors and mandatory evidence for a production rollout. Keep their records in the installing organization's controlled storage.

The repository owner has adopted Apache-2.0; contributions are distributed under the project's [Apache License 2.0](LICENSE). Maintain private vulnerability reporting for public releases. See [SECURITY.md](SECURITY.md) for private disclosure.
