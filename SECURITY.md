# Security policy

## Supported version and reporting

Security fixes target the latest release. GitHub private vulnerability reporting is enabled on the canonical repository. Use its [private vulnerability report form](https://github.com/Tovli/ms-copilot-orgwide-search-agent/security/advisories/new), or **Security > Report a vulnerability**, to reach repository maintainers. Fork owners must enable their own reporting channel. If the private form is unavailable, request a private channel without disclosing the vulnerability in a public issue. Never attach tokens, organizational documents, tenant URLs, or search transcripts to public reports.

Include the affected version, a synthetic reproduction, the violated boundary, and the expected behavior. Maintainers should acknowledge privately, agree on disclosure timing, and publish a security advisory when a fix is available. No response-time commitment is established yet.

## Authorization boundary

The agent declares only native `OneDriveAndSharePoint` retrieval. Microsoft 365 performs retrieval as the signed-in user; this project does not obtain service-account credentials, add Graph application permissions, ingest files, or maintain a second index. Omitting source scopes permits broad discovery; it does not grant broader document access. Microsoft documents that grounding respects existing user permissions. [Microsoft Copilot data protection architecture](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-architecture-data-protection-auditing).

Application availability and document permissions are separate. Giving a pilot group access to the agent does not give its members access to one another's files. Conversely, permission trimming does not repair oversharing: a file shared too broadly may be legitimately discoverable by an unintended audience. Review sharing links, group membership, and site permissions before rollout.

## Sensitivity and discovery controls

Keep Microsoft Purview labels, encryption, DLP, retention, and SharePoint discovery policies in force. Labels do not all have the same effect; encryption rights and configured policies determine whether Copilot can process a file. A label attached to the agent is not a substitute for file protection. Microsoft describes the applicable protection and audit behavior in its [data protection architecture](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-architecture-data-protection-auditing).

Administrators must evaluate existing Restricted Content Discovery and search visibility settings. This project never changes those settings to improve recall. Restricted SharePoint Search is a retiring feature; do not introduce it as a new deployment prerequisite. [Restricted Content Discovery](https://learn.microsoft.com/en-us/sharepoint/restricted-content-discovery), [Restricted SharePoint Search retirement](https://learn.microsoft.com/en-us/sharepoint/restricted-sharepoint-search).

## Untrusted retrieved content

Instructions tell the agent to treat document text as evidence and ignore embedded attempts to change its behavior, expose data, fabricate results, or override the user's request. These instructions supplement Microsoft's controls. They do not prove prompt-injection resistance or create an authorization boundary.

The package has no custom action or external endpoint for sending documents. Web search is omitted from the capability list. Review every manifest or capability change: adding an action, connector, web grounding, or external logging changes the security model and requires a new review.

## Local configuration and telemetry

Use ignored `local/` deployment configuration and generated `env/` files. App identity and public publisher URLs are configuration, not passwords, but deployment artifacts should still stay out of the generic source distribution. Tokens and credentials belong in Toolkit-managed authentication storage, never in manifests, JSON configuration, `.env` examples, CI variables for public pull requests, or command output.

The pinned local identity is `TEAMS_APP_ID` in `env/.env.dev`; all tenant packaging entry points require a valid baseline and matching deployment configuration. Keep a separately approved identity record for recovery and upgrades, and use tenant package verification with `--expected-app-id` from that record before administrator upload. A checkout cannot detect an identity change if both local records are replaced together. Package sidecars are integrity checks against a trusted producer record, not signatures or proof of tenant approval.

`npm run secrets` scans tracked files and untracked nonignored text files, including committed `.env` examples and tracked files that match ignore rules. It recognizes snake_case/camelCase credential assignments, Entra-shaped values containing `~`, private keys and several token formats; diagnostics redact values. Binary files and oversized files have explicit handling. It remains a bounded pattern scan of the working tree, not a complete history scan or proof that no secret exists.

Secret scanning and push protection were enabled and verified through GitHub's API on the canonical repository when it was created. Recheck their current status and review alerts before releases; forks must configure their own protections. Passing CI alone does not establish repository settings. Follow [GitHub's secret scanning setup](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning) and its available repository protections. If a secret is exposed, revoke/rotate it and follow the organization's incident process; removing the text alone is insufficient.

This project adds no document-content collection, external analytics, or telemetry endpoint. Invoke Toolkit with `--telemetry false` as documented in README. Microsoft 365 itself can retain prompts, responses, references, and audit records according to tenant policies; absence of project telemetry does not disable platform logging. [Microsoft auditing and retention](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-architecture-data-protection-auditing).

The development lockfile pins security-driven overrides for Toolkit dependencies. Local compilation and package checks do not prove that an overridden authentication dependency works against a tenant. Re-run the authenticated pilot after changing dependency resolutions, and record any failure without weakening authentication or restoring a known-vulnerable dependency silently.

## Release security gates

- Run the local manifest, package, configuration, secret, and dependency checks documented in README. A pattern-based secret check is useful defense in depth, not proof that a repository is secret-free.
- Test two licensed pilot users with intentionally different document permissions, including denial by direct filename, exact phrase, and paraphrase. No restricted content, metadata, or existence may be disclosed.
- Test permission revocation after allowing service propagation, labeled/encrypted content, DLP, discovery restrictions, and a newly shared file. Record the observed policy behavior privately.
- Include benign prompt-injection canaries in synthetic test documents. Confirm the agent stays within the user request and never follows the canary instructions.
- Open every cited link as the same user, verify that the title and relevance are grounded, and distinguish retrieval failure from a negative search result.
- Keep all real evaluation inputs and outputs outside Git and public CI. Report aggregate findings after privacy review.

See [TESTING.md](TESTING.md) for the evidence required before production approval. Offline tests cannot demonstrate tenant isolation or the security of Microsoft's retrieval service.
