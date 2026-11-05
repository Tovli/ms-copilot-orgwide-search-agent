# Platform and implementation limitations

Documentation was checked on 2026-11-05. Microsoft can change retrieval, licensing, schemas, and administrative UI independently of this repository. [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) records the exact locally selected toolchain and observed validation results.

## What is controlled here

The source controls the agent's identity, instructions, six conversation starters, and a single unscoped `OneDriveAndSharePoint` capability. It includes no source-selection parameters, custom backend, Graph search integration, vector database, or external action. Microsoft explicitly documents broad source scope when both source-scoping properties are omitted. This remains subject to authorization and discovery policy. [Declarative manifest reference](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-manifest-1.9#onedrive-and-sharepoint-object).

The selected stable TypeSpec emitter produces declarative schema 1.5 even though the latest manifest documentation describes 1.9. The source deliberately uses supported emitter output. Newer schema features need an explicit toolchain upgrade and compatibility review. The emitted behavior override discourages model knowledge; it does not establish a mathematical guarantee of source grounding.

Web search is disabled by excluding `WebSearch` from capabilities. No unsupported `web_search: false` property is invented. The agent's instruction to use retrieved files as evidence does not guarantee the model will never produce an unsupported statement; evaluate grounding in the actual host. [Knowledge-source configuration](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/knowledge-sources).

## Desired behavior and observable evidence

Multilingual expansion, intent preservation, historical-date priority, deduplication, relevance selection, original titles, source links, and useful no-result guidance are instruction-level behavior. They do not configure a deterministic ranking engine or a search pipeline.

Microsoft controls retrieval and orchestration. The agent cannot promise exhaustive search, enumerate every accessible file, guarantee all synonyms were searched, expose a complete query log, tune the index, enforce a fixed result count, or guarantee latency. It must not describe translated searches as executed unless observable evidence supports that statement. A missing result is not evidence that a document does not exist.

Author, collaborator, date, and custom metadata discovery depend on the information returned and the platform's search behavior. This agent has no separate People, Email, or Teams capability. A collaboration reference in file evidence may help; arbitrary people-relationship queries and custom-column filters are not guaranteed. Microsoft identifies unsupported custom-metadata listing scenarios in [known issues](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/known-issues).

## Language

English and Hebrew are currently listed as supported Microsoft Copilot prompt/response languages. This does not establish equal retrieval quality across languages or guarantee that an English query discovers every Hebrew equivalent. Transliteration, acronyms, Hebrew morphology, spelling errors, and mixed-language content require corpus-specific evaluation. [Supported languages](https://support.microsoft.com/en-us/microsoft-365-copilot/supported-languages-for-microsoft-365-copilot).

Instructions use plausible conceptual alternatives rather than automatically translating every request. This improves clarity of intent; it provides no measured recall claim. Record English-to-English, Hebrew-to-Hebrew, English-to-Hebrew, and Hebrew-to-English outcomes separately using [TESTING.md](TESTING.md).

## Index freshness and formats

Microsoft's semantic-index documentation lists Word (`doc/docx`), PowerPoint (`pptx`), PDF, SharePoint pages (`aspx`), and OneNote (`one`) among supported file types. It describes daily indexing for newly added SharePoint documents under stated site-sharing conditions and immediate updates for already indexed documents. Treat these as platform descriptions, not a guaranteed freshness SLA for this agent. Search visibility, permissions, and processing can delay or exclude results. The same documentation does not establish uniform semantic support for every file extension or custom metadata in this unscoped scenario. [Semantic indexing](https://learn.microsoft.com/en-us/microsoftsearch/semantic-index-for-copilot).

Text-bearing PDF support does not imply scanned PDF text is available. OCR is a separately configured Microsoft document-processing service with its own availability and processing requirements; this project neither enables nor purchases it. Test scanned, hybrid, and text PDFs separately. [OCR overview](https://learn.microsoft.com/en-us/microsoft-365/documentprocessing/ocr-overview?view=o365-worldwide).

SharePoint crawler ceilings are not declarative-agent content guarantees. Microsoft lists 150 MB for general crawl downloads, an extended 512 MB for PDF/PPTX/PPT/DOC/DOCX, up to two million parsed characters, up to one million word-broken characters, and parsing time limits. Large items can be only partly indexed or metadata-only. These boundaries do not mean every supported file below the limits is fully available to the agent. [SharePoint search limits](https://learn.microsoft.com/en-us/sharepoint/search-limits).

Microsoft also warns that long SharePoint files and special formatting, including tables, can degrade retrieval. Its 36,000-character guidance for site/folder sources is a recommendation, not this project's maximum file size. Guidance for explicitly selected sets of 20 files does not imply that this unscoped agent searches only 20 organizational files. The project intentionally preserves broad scope. [Optimize content retrieval](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/optimize-content-retrieval).

## Links, security, and policy

Source links and metadata can be absent or rendered differently across hosts. Microsoft lists link-rendering problems when an agent is invoked through an @mention. Never manufacture a URL to compensate. Test the dedicated agent experience and any required @mention workflow. [Known issues](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/known-issues).

User permissions, sensitivity encryption, DLP, search visibility, and Restricted Content Discovery may intentionally reduce recall. The manifest does not bypass these controls. Permission trimming also cannot distinguish intended access from overshared content. Prompt instructions cannot guarantee resistance to malicious source text. See [SECURITY.md](SECURITY.md).

## Licensing and deployment assumptions

Use an active Microsoft 365 Copilot license for the baseline pilot. Microsoft's general capability table and admin guidance discuss metered usage for organizational knowledge, while its current knowledge-source note and known-issues page state that SharePoint/OneDrive retrieval requires an active user license. Metered-only support for this exact Toolkit agent is therefore a tenant-validation gate, not a guaranteed alternative. See README's licensing section and [knowledge-source requirements](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/knowledge-sources).

Commercial, sovereign, government, and education tenants may expose different capabilities, policies, schema support, and admin workflows. Locally valid manifests and a well-formed ZIP do not prove tenant acceptance, Responsible AI approval, successful authentication, provisioning, retrieval, or production readiness. No tenant-level outcome is claimed until recorded by an authorized tester.

## Scale and performance

There is no project-controlled index, retrieval page size, cache, retry policy, throughput setting, or latency SLA. Large or heterogeneous collections may change relevance and response time. Measure repeated queries across corpus sizes, languages, file types, permission groups, and cold/warm sessions. Keep service errors and missing results visible; do not convert them into successful empty searches. Any proposal for extra infrastructure requires evidence of a meaningful gap and separate explicit approval.
