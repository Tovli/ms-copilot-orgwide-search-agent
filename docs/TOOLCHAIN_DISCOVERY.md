# Verified discovery record

Checked on 2026-11-05 before implementation. The repository initially contained only `.git`; no project instructions or source files were present. Node 24.15.0 and npm 11.14.0 were available. No global Microsoft 365 Agents Toolkit CLI or matching VS Code extension was found. Ruflo 3.71.0 was available through the connected MCP tools.

The npm registry identified `@microsoft/m365agentstoolkit-cli` 1.1.19 as its stable distribution. Running its `--version`, `list templates`, `new --help`, `validate --help`, and `package --help` established actual commands and supported templates. A temporary discovery project was generated with:

```sh
npx --yes --package @microsoft/m365agentstoolkit-cli@1.1.19 atk new -c declarative-agent-typespec -n discovery-agent -f <temporary-discovery-folder> -i false --telemetry false
```

The generated template contained TypeSpec sources, app manifest schema 1.30, Toolkit lifecycle schema v1.12, and the stable Copilot emitter 1.0.0. Its unrelated sample API action, extra app permissions, Azure features, generated project ID and template artwork were not copied into this project. The native-only implementation has original geometric icons.

Official Microsoft guidance supports TypeSpec authoring and specifically documents that omitting both OneDrive/SharePoint source-scoping arrays uses all authorized organizational sources. The stable emitter accepts `op documents is AgentCapabilities.OneDriveAndSharePoint;` and emits exactly the single name-only capability. [TypeSpec guide](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/build-declarative-agents-typespec), [current schema reference](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-manifest-1.9).

The installed emitter's `dist/src/constants.js` hardcodes `DECLARATIVE_AGENT_VERSION = "v1.5"`. Its registry stable release is 1.0.0. Toolkit includes a 1.5 schema validator as well as newer schemas, and its direct manifest validation accepts the output. Therefore this project preserves **1.5**, the current stable emitter's supported output. It does not relabel generated JSON as 1.9. The application template stays at **1.30**, and the lifecycle uses **v1.12**.

The template's TypeSpec compiler 1.12.0 and several development dependencies were affected by advisories. The final source pins compiler/http/openapi/openapi3 1.17.0, Ajv 8.20.0 and fflate 0.8.3. Compilation was rerun successfully. Targeted overrides pin Toolkit's MSAL dependency 7.2.0, glob 14.0.3, minimatch 11.0.4 and the older Scalar JSON helper's undici 7.30.1. These resolutions remove the observed audit findings without enabling additional runtime services. MSAL's changed interactive response handling still requires tenant pilot validation; authentication was not attempted to establish compatibility. [MSAL migration](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/v7-migration.md).

There is no supported general `web_search: false` manifest property in this format. Web retrieval is excluded by declaring only OneDrive/SharePoint, with an instruction to stay within document evidence. The supported `discourageModelKnowledge` TypeSpec decorator emits `behavior_overrides.special_instructions.discourage_model_knowledge: true`. This guidance does not replace grounding evaluation.

Installed Toolkit source was inspected for packaging and lifecycle behavior. A bare TypeSpec CLI compile emits the agent JSON without the Toolkit-generated app manifest marker. Consequently the lifecycle stages all four files under `dist/tenant/appPackage` before `teamsApp/zipAppPackage` resolves references. Personal `copilotAgent/publish` submits the ZIP to Microsoft's publishing service; it does not require a separate Developer Portal update in this lifecycle.

Direct manifest validation and Toolkit packaging run locally without credentials. `atk validate --package-file` initiates Microsoft 365 OAuth even when `-i false` is requested. That process was cancelled without sign-in. Remote package rules, deep/test-case/Responsible AI checks, authentication, provisioning and publishing remain unexecuted. The documented developer workflow is based on installed command help and supported lifecycle actions, not a claim of a successful tenant deployment. [Toolkit CLI reference](https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/microsoft-365-agents-toolkit-cli).
