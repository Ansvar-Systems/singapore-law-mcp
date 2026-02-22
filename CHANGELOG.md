# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-02-22
### Added
- `data/census.json` — full corpus census (10 laws, 1,722 provisions)
- `server.json` now includes streamable-http remote endpoint

### Changed
- Golden contract tests upgraded to in-memory MCP client/server pattern with `skipIf` guards for nightly-only assertions (`upstream_text_hash`, `citation_resolves`)
- `fixtures/golden-tests.json` parameter names aligned to tool schemas (`document_id`/`section` instead of `law_identifier`/`article`)
- EU cross-reference tests (sg-009, sg-010) changed to `handles_gracefully` (EU reference tables not yet populated)
- `server.json` uses dual `packages` format (stdio + streamable-http), no `remotes` key

### Fixed
- `server.json` version synced with `package.json` and `constants.ts`

## [1.0.0] - 2026-XX-XX
### Added
- Initial release of Singapore Law MCP
- `search_legislation` tool for full-text search across all Singapore statutes
- `get_provision` tool for retrieving specific articles/sections
- `get_provision_eu_basis` tool for international framework cross-references (GDPR, ASEAN)
- `validate_citation` tool for legal citation validation
- `check_statute_currency` tool for checking statute amendment status
- `list_laws` tool for browsing available legislation
- Contract tests with 12 golden test cases
- Drift detection with 6 stable provision anchors
- Health and version endpoints
- Vercel deployment (single tier bundled)
- npm package with stdio transport
- MCP Registry publishing

[Unreleased]: https://github.com/Ansvar-Systems/singapore-law-mcp/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Ansvar-Systems/singapore-law-mcp/releases/tag/v1.1.0
[1.0.0]: https://github.com/Ansvar-Systems/singapore-law-mcp/releases/tag/v1.0.0
