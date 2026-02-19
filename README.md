# Singapore Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/singapore-law-mcp)](https://www.npmjs.com/package/@ansvar/singapore-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/singapore-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/singapore-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/singapore-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/singapore-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Singapore legislation, including the Personal Data Protection Act (PDPA), Cybersecurity Act, Computer Misuse Act, Electronic Transactions Act, Companies Act, and Spam Control Act with full-text search.

## Deployment Tier

**SMALL** -- Single tier, bundled SQLite database shipped with the npm package.

**Estimated database size:** ~80-150 MB (full corpus of Singapore federal legislation)

## Key Legislation Covered

| Act | Year | Significance |
|-----|------|-------------|
| **Personal Data Protection Act (PDPA)** | 2012 (amended 2020) | Comprehensive data protection law; mandatory data breach notification since 1 February 2021; significant fines up to S$1 million per breach |
| **Cybersecurity Act** | 2018 | Framework for protection of Critical Information Infrastructure (CII); establishes the Cyber Security Agency (CSA) |
| **Computer Misuse Act** | 1993 (amended) | Criminalises unauthorised access to computer material, computer service, and cyberattacks |
| **Electronic Transactions Act** | 2010 | Legal recognition of electronic records and electronic signatures |
| **Companies Act** | 1967 (revised) | Corporate governance, registration, directors' duties |
| **Spam Control Act** | 2007 | Regulation of unsolicited commercial electronic messages |
| **Constitution of the Republic of Singapore** | 1963 | Supreme law; Article 9 protects liberty of the person |

## Regulatory Context

- **Data Protection Supervisory Authority:** Personal Data Protection Commission (PDPC), established under the PDPA
- **Cybersecurity Regulator:** Cyber Security Agency of Singapore (CSA), established under the Cybersecurity Act 2018
- **Singapore's PDPA** includes Do Not Call (DNC) Registry provisions and mandatory data breach notification (2020 amendment)
- Singapore is an ASEAN cybersecurity hub and a member of the ASEAN Framework on Personal Data Protection
- Singapore uses a common law legal system with significant statutory modification
- English is the primary legal language and the language of all legislation
- The PDPC has strong enforcement powers with significant fines imposed on organisations

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [Singapore Statutes Online](https://sso.agc.gov.sg) | Attorney-General's Chambers | API | Weekly | Singapore Open Data Licence | All current Acts of Parliament, subsidiary legislation, Constitution |
| [PDPC Decisions & Guidelines](https://www.pdpc.gov.sg) | Personal Data Protection Commission | HTML Scrape | Monthly | Government Publication | Enforcement decisions, advisory guidelines, guidance notes |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/singapore-law-mcp
```

## Usage

### As stdio MCP server

```bash
singapore-law-mcp
```

### In Claude Desktop / MCP client configuration

```json
{
  "mcpServers": {
    "singapore-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/singapore-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific section/article from a Singapore Act |
| `search_legislation` | Full-text search across all Singapore legislation |
| `get_provision_eu_basis` | Cross-reference lookup for international framework relationships (GDPR, ASEAN, NIS, etc.) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 3 article retrieval tests (PDPA, Cybersecurity Act, Companies Act)
- 3 search tests (personal data, cybersecurity, computer misuse)
- 2 citation roundtrip tests (official sso.agc.gov.sg URL patterns)
- 2 cross-reference tests (GDPR relationship, ASEAN framework)
- 2 negative tests (non-existent Act, malformed section)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/singapore-law-mcp/issues/new?template=data-error.md)

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
