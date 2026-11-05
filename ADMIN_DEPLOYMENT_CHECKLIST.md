# Administrator deployment checklist

This checklist authorizes no action by itself. Record an owner, approver, date, artifact digest, and evidence location for each rollout. Keep tenant evidence private.

## Before accepting the package

- [ ] Confirm the publisher, active Microsoft 365 services, pilot users' Copilot licenses, custom agent policy, and an administrator role authorized for this tenant's agent management.
- [ ] If proposing metered-only access, resolve the source-specific licensing caveat in README and prove retrieval works for that entitlement before rollout.
- [ ] Obtain `dist/tenant/org-document-search-0.1.0.zip`, using this installation's persistent app identity and real HTTPS publisher/privacy/terms pages. Reject the synthetic `dist/validation/` package for deployment.
- [ ] Retain the package and `.zip.sha256` sidecar, version, source revision, and approved local configuration/environment in controlled storage. For upgrades, retrieve the original app UUID from the independently approved release record, not only from the newly submitted configuration.
- [ ] Run `npm run verify-package -- --profile tenant --config local/deployment.json --package dist/tenant/org-document-search-0.1.0.zip --expected-app-id <APPROVED_APP_ID>` using that approved UUID. Require the tenant verification result; validation-only verification cannot approve deployment. Compare publisher details and identity before upload. The local verifier does not query tenant deployment state, and this project does not assume the upload wizard will recognize an unintended new UUID as an upgrade.
- [ ] Review native `OneDriveAndSharePoint` with no source scopes. Confirm no `WebSearch`, custom actions, external backend, or application-wide Graph file permissions.
- [ ] Review overshared documents, group membership, sensitivity/encryption, DLP, search visibility, and Restricted Content Discovery. Do not weaken these controls to improve search results.
- [ ] Review [SECURITY.md](SECURITY.md), [LIMITATIONS.md](LIMITATIONS.md), local validation evidence, and outstanding platform validation/Responsible AI findings.

## Approve and publish a pilot

- [ ] In the current Microsoft 365 admin experience, open **Agents > All Agents > Registry > Add agent** and upload the reviewed ZIP. Confirm the wizard's name, icon, host, policies, and permissions.
- [ ] Limit publication to the approved pilot group. Select optional preinstallation only for the intended pilot audience. Review before finishing deployment. If the tenant exposes different menus, use its supported custom-agent catalog workflow.
- [ ] Confirm agent discovery and access for pilot members and intended exclusion for others. Confirm that agent publication did not alter document permissions.
- [ ] Run the authenticated suite in [TESTING.md](TESTING.md): relevance, both cross-language directions, grounding, no-results, injection canaries, links, permission isolation, labels/policies, revocation, and measured latency.
- [ ] Record skipped tests and failures explicitly. Obtain business and security acceptance against the agreed thresholds.

Microsoft describes the ZIP upload, publication audience, and optional preinstallation flow in the [Agent Registry documentation](https://learn.microsoft.com/en-us/microsoft-agent-365/admin/agent-registry-overview?view=o365-worldwide). Available controls depend on tenant rollout and agent type.

## Expand, monitor, and recover

- [ ] Obtain explicit production approval, then expand the publication/deployment audience through the supported administrator workflow.
- [ ] Confirm rollout with representative users, languages, sites, and document permissions. Communicate best-effort retrieval and the refinement path for missing files.
- [ ] Assign an operational owner to review service failures, user-reported misses, licensing/billing, private aggregate evaluation, and relevant Microsoft platform changes. No external project telemetry is enabled.
- [ ] For updates, retain the app identity, increment version, revalidate/repackage, repeat pilot gates, and resubmit for approval.
- [ ] Keep the last approved source/configuration and artifact digest. If necessary, block or remove access using available admin actions and verify removal; restore approved behavior with a validated higher-version rebuild if required.
- [ ] Before public GitHub release, obtain owner adoption of the proposed license, enable private security/conduct reporting channels, and verify repository secret scanning and push protection are enabled. Their status is not established by local CI. Public source release and tenant production approval are separate decisions.
