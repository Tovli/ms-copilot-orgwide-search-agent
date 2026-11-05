# Third-party material

The agent's instructions, TypeSpec sources, icons, and local scripts were written for this project. Icons are reproducible using `node assets/generate-icons.mjs` and contain no third-party artwork.

The checked-in JSON schemas are unmodified Microsoft material fetched from the official schema endpoints. Their exact sources and SHA-256 digests are in `schemas/provenance.json`. Retain this provenance when redistributing them; schema availability is not a claim of ownership or a change to Microsoft's terms.

Development dependencies are not shipped inside the Microsoft 365 app ZIP. They retain their individual licenses and notices in `node_modules`. The lockfile records the full dependency graph. Inspect those licenses before redistributing a development environment or bundled tooling. Principal direct tools use MIT (Microsoft Toolkit, TypeSpec tooling, Ajv, pngjs) and MIT (fflate); do not replace upstream notices with this project's proposed license. Microsoft's hosted services remain subject to Microsoft licensing and service terms.

The Apache-2.0 text in LICENSE is a proposed project license, pending the owner's adoption before public release. No public release or license adoption was performed by the implementation process.
