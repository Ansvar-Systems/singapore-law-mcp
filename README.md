# Singaporean Law MCP Server

**The Singapore Statutes Online (SSO) alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fsingapore-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/singapore-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/singapore-law-mcp?style=social)](https://github.com/Ansvar-Systems/singapore-law-mcp)
[![CI](https://github.com/Ansvar-Systems/singapore-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/singapore-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/singapore-law-mcp)
[![Provisions](https://img.shields.io/badge/provisions-28%2C045-blue)](https://github.com/Ansvar-Systems/singapore-law-mcp)

Query **523 Singapore Acts** -- from the Personal Data Protection Act (PDPA) and Cybersecurity Act to the Penal Code, Companies Act, Electronic Transactions Act, and MAS regulations -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Singapore legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Singapore legal research means navigating Singapore Statutes Online (sso.agc.gov.sg), MAS circulars, PDPC guidelines, and scattered subsidiary legislation. Whether you're:

- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking PDPA obligations or MAS Technology Risk Management Guidelines
- A **legal tech developer** building tools on Singapore law
- A **researcher** tracing provisions across 523 Acts

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Singapore law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-sg/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add singaporean-law --transport http https://mcp.ansvar.eu/law-sg/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "singaporean-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-sg/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "singaporean-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-sg/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/singapore-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "singaporean-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/singapore-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "singaporean-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/singapore-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does the PDPA (Personal Data Protection Act) say about consent for data collection?"*
- *"Find provisions in the Cybersecurity Act about critical information infrastructure"*
- *"Search for director duties under the Companies Act"*
- *"What do MAS regulations say about technology risk management?"*
- *"Find provisions in the Penal Code about computer-related offences"*
- *"Is the Electronic Transactions Act still in force?"*
- *"Search for banking secrecy provisions under the Banking Act"*
- *"Validate the citation Personal Data Protection Act 2012, Section 13"*
- *"Compare PDPA consent requirements with GDPR Article 7"*
- *"Build a legal stance on data breach notification under Singapore law"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Acts** | 523 Acts | Complete Singapore Statutes Online corpus |
| **Provisions** | 28,045 sections | Full-text searchable with FTS5 |
| **Preparatory Works** | 17,464 documents | Parliamentary debates and select committee reports |
| **Database Size** | 74 MB | Optimized SQLite, portable |
| **Data Source** | sso.agc.gov.sg | Singapore Statutes Online (Attorney-General's Chambers) |

**Verified data only** -- every citation is validated against official sources (Singapore Statutes Online, AGC). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from sso.agc.gov.sg (Singapore Statutes Online, Attorney-General's Chambers)
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by Act name + section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
Singapore Statutes Online --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                               ^                        ^
                        Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search SSO by Act name | Search by plain English: *"personal data consent collection"* |
| Navigate multi-section Acts manually | Get the exact provision with context |
| Manual cross-referencing between Acts | `build_legal_stance` aggregates across sources |
| "Is this Act still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find GDPR comparison -- dig through EUR-Lex | `get_eu_basis` -- linked international frameworks |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search SSO --> Navigate Act HTML --> Ctrl+F --> Cross-reference with PDPC Guidelines --> Check EUR-Lex for GDPR comparison --> Repeat

**This MCP:** *"What are the data breach notification requirements under the PDPA and how do they compare to GDPR Article 33?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 28,045 provisions with BM25 ranking. Supports quoted phrases, boolean operators, prefix wildcards |
| `get_provision` | Retrieve specific provision by Act name + section number |
| `check_currency` | Check if an Act is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple Acts for a legal topic |
| `format_citation` | Format citations per Singapore legal conventions |
| `list_sources` | List all 523 Acts with metadata and coverage scope |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations and international frameworks that a Singapore Act aligns with |
| `get_singaporean_implementations` | Find Singapore laws corresponding to a specific EU act or international standard |
| `search_eu_implementations` | Search EU documents with Singapore alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Singapore statutes against EU directives and international frameworks |

---

## EU Law Alignment

Singapore is not an EU member state, but Singapore law -- particularly the PDPA -- has strong alignment with GDPR principles:

- **Personal Data Protection Act (PDPA)** -- Core data protection principles (purpose limitation, consent, access rights, correction rights, data breach notification) closely mirror GDPR requirements. The PDPA Amendment Act 2020 strengthened alignment with GDPR's mandatory breach notification and data portability concepts.
- **PDPC Guidelines** -- The Personal Data Protection Commission issues guidelines that reference international best practices including GDPR
- **APEC CBPR** -- Singapore participates in the APEC Cross-Border Privacy Rules system, which establishes compatible principles for data flows
- **ASEAN Framework** -- Singapore's PDPA informed the ASEAN Model Contractual Clauses for Cross Border Data Flows
- **MAS Technology Risk Management** -- Aligns with international frameworks including ISO 27001, NIST CSF, and EU financial sector requirements

The EU bridge tools allow you to explore these alignment relationships -- checking which Singapore provisions correspond to GDPR requirements.

| Alignment Area | Singapore Law | EU/International Basis |
|----------------|---------------|----------------------|
| Consent | PDPA s.13-17 | GDPR Art. 6-7 |
| Data breach notification | PDPA s.26D | GDPR Art. 33-34 |
| Data portability | PDPA s.26F | GDPR Art. 20 |
| Data Protection Officer | PDPA s.11A | GDPR Art. 37-39 |
| Cross-border transfers | PDPA s.26 | GDPR Art. 44-49 |

> **Note:** Singapore cross-references reflect alignment relationships, not transposition. Singapore operates its own independent legal system. The EU tools identify where Singapore and EU law address the same domains under comparable principles.

---

## Data Sources & Freshness

All content is sourced from authoritative Singapore legal databases:

- **[Singapore Statutes Online](https://sso.agc.gov.sg)** -- Official consolidated Acts, Attorney-General's Chambers
- **[Parliament of Singapore](https://parliament.gov.sg)** -- Parliamentary debates and select committee reports (preparatory works)

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Attorney-General's Chambers, Singapore |
| **Retrieval method** | Singapore Statutes Online (SSO) official source |
| **Languages** | English (official language) |
| **License** | Singapore Government Open Data Licence |
| **Coverage** | 523 Acts, complete SSO corpus |
| **Preparatory Works** | 17,464 Parliamentary documents |

### Automated Freshness Checks

A [GitHub Actions workflow](.github/workflows/check-updates.yml) monitors data sources for changes:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New Acts** | Comparison against SSO Act index |
| **Repealed legislation** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from Singapore Statutes Online (Attorney-General's Chambers). However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources (SSO, Singapore Law Watch) for court filings
> - **EU cross-references** reflect alignment relationships, not formal equivalence
> - **Subsidiary legislation** -- regulations, orders, and notices are not all included in this release; verify against SSO for subsidiary instruments

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. For professional use guidance, consult the **Law Society of Singapore** professional conduct rules.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/singapore-law-mcp
cd singapore-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest          # Ingest Acts from Singapore Statutes Online
npm run build:db        # Rebuild SQLite database
npm run census          # Generate coverage census
npm run drift:detect    # Run drift detection against anchors
npm run check-updates   # Check for amendments and new Acts
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** 74 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate across 523 Acts

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/singapore-law-mcp](https://github.com/Ansvar-Systems/singapore-law-mcp) (This Project)
**Query 523 Singapore Acts directly from Claude** -- PDPA, Cybersecurity Act, Companies Act, Penal Code, Banking Act, and more. `npx @ansvar/singapore-law-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Cameroon, Denmark, Finland, France, Germany, Ghana, India, Ireland, Israel, Japan, Netherlands, Nigeria, Norway, Sweden, Switzerland, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law integration (Singapore Court of Appeal, High Court)
- Subsidiary legislation expansion (regulations, orders, notices)
- EU cross-reference mapping expansion (PDPA-GDPR, MAS-DORA)
- Historical statute versions and amendment tracking
- PDPC advisory guidelines and enforcement decisions

---

## Roadmap

- [x] Core statute database with FTS5 search (523 Acts, 28,045 provisions)
- [x] Preparatory works (17,464 Parliamentary documents)
- [x] International law alignment tools (GDPR comparison)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law (Singapore Court of Appeal, High Court)
- [ ] Subsidiary legislation (regulations, orders, notices)
- [ ] Historical statute versions (amendment tracking)
- [ ] PDPC enforcement decisions and advisory guidelines
- [ ] MAS regulatory notices and guidelines

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{singaporean_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Singaporean Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/singapore-law-mcp},
  note = {523 Singapore Acts with 28,045 provisions and 17,464 preparatory works documents}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Acts of Parliament:** Singapore Attorney-General's Chambers ([Singapore Government Open Data Licence](https://data.gov.sg/open-data-licence))
- **Parliamentary Debates:** Parliament of Singapore (public record)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for Singapore law -- turns out everyone building for the Asian market or navigating PDPA compliance has the same research frustrations.

So we're open-sourcing it. Navigating 523 Acts shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
