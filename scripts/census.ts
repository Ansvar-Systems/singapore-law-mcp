#!/usr/bin/env tsx
/**
 * Singapore Law MCP — Census Script
 *
 * Enumerates ALL current Acts from Singapore Statutes Online (sso.agc.gov.sg)
 * by scraping the browse page with PageSize=500 pagination.
 *
 * Outputs data/census.json in golden standard format.
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *   npx tsx scripts/census.ts --page 2   # Fetch only page 2 (resume)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SSO_BASE = 'https://sso.agc.gov.sg';
const BROWSE_URL = `${SSO_BASE}/Browse/Act/Current/All`;
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');
const PAGE_SIZE = 500;

interface CensusLawEntry {
  id: string;
  title: string;
  identifier: string;
  url: string;
  status: 'in_force';
  category: 'act';
  classification: 'ingestable' | 'excluded' | 'inaccessible';
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
}

interface CensusFile {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  census_date: string;
  agent: string;
  summary: {
    total_laws: number;
    ingestable: number;
    ocr_needed: number;
    inaccessible: number;
    excluded: number;
  };
  laws: CensusLawEntry[];
}

function parseArgs(): { page: number | null } {
  const args = process.argv.slice(2);
  let page: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--page' && args[i + 1]) {
      page = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return { page };
}

/**
 * Normalise an Act code into a stable, lowercase, kebab-case ID.
 * E.g. "PDPA2012" -> "pdpa-2012", "CoA1967" -> "coa-1967"
 */
function actCodeToId(code: string): string {
  // Insert a hyphen before a trailing year (4 digits at end)
  const withHyphen = code.replace(/(\D)(\d{4})$/, '$1-$2');
  return withHyphen.toLowerCase();
}

/**
 * Parse act entries from an SSO browse page HTML.
 * Pattern: <a class="non-ajax" href="/Act/CODE" rel="">Title</a>
 */
function parseActEntries(html: string): { actCode: string; title: string }[] {
  const entries: { actCode: string; title: string }[] = [];
  const seen = new Set<string>();

  const pattern = /<a\s+class="non-ajax"\s+href="\/Act\/([^"?]+)"\s+rel="">([^<]+)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const actCode = match[1].trim();
    const title = match[2].trim();

    if (!seen.has(actCode)) {
      seen.add(actCode);
      entries.push({ actCode, title });
    }
  }

  return entries;
}

/**
 * Extract total result count from browse page.
 * Pattern: "523 results" or similar.
 */
function extractTotalCount(html: string): number | null {
  const match = html.match(/(\d+)\s+result/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Load existing census for merge/resume.
 */
function loadExistingCensus(): Map<string, CensusLawEntry> {
  const existing = new Map<string, CensusLawEntry>();
  if (fs.existsSync(CENSUS_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8')) as CensusFile;
      for (const law of data.laws) {
        existing.set(law.id, law);
      }
    } catch {
      // Ignore parse errors, start fresh
    }
  }
  return existing;
}

async function main(): Promise<void> {
  const { page: singlePage } = parseArgs();

  console.log('Singapore Law MCP — Census');
  console.log('==========================\n');
  console.log(`  Source: ${SSO_BASE}`);
  console.log(`  Browse URL: ${BROWSE_URL}`);
  console.log(`  Page size: ${PAGE_SIZE}`);
  if (singlePage) console.log(`  Single page mode: page ${singlePage}`);
  console.log();

  const existingEntries = loadExistingCensus();
  if (existingEntries.size > 0) {
    console.log(`  Loaded ${existingEntries.size} existing entries from previous census\n`);
  }

  const allActEntries: { actCode: string; title: string }[] = [];
  let totalFromServer: number | null = null;

  // Determine pages to fetch
  const pages = singlePage ? [singlePage] : [1];

  for (const pageNum of pages) {
    const url = pageNum === 1
      ? `${BROWSE_URL}?PageSize=${PAGE_SIZE}&SortBy=Title&SortOrder=ASC`
      : `${BROWSE_URL}/${pageNum}?PageSize=${PAGE_SIZE}&SortBy=Title&SortOrder=ASC`;

    console.log(`  Fetching page ${pageNum}: ${url}`);

    const result = await fetchWithRateLimit(url);
    if (result.status !== 200) {
      console.log(`  ERROR: HTTP ${result.status} for page ${pageNum}`);
      continue;
    }

    const entries = parseActEntries(result.body);
    console.log(`    Found ${entries.length} acts on page ${pageNum}`);
    allActEntries.push(...entries);

    // Get total count from first page
    if (pageNum === 1 && !singlePage) {
      totalFromServer = extractTotalCount(result.body);
      if (totalFromServer) {
        console.log(`    Total results reported: ${totalFromServer}`);
        const totalPages = Math.ceil(totalFromServer / PAGE_SIZE);
        if (totalPages > 1) {
          console.log(`    Need ${totalPages} pages total`);
          for (let p = 2; p <= totalPages; p++) {
            pages.push(p);
          }
        }
      }
    }
  }

  console.log(`\n  Total unique acts found: ${allActEntries.length}`);

  // Convert to census entries, merging with existing data
  const today = new Date().toISOString().split('T')[0];

  for (const { actCode, title } of allActEntries) {
    const id = actCodeToId(actCode);
    const url = `${SSO_BASE}/Act/${actCode}`;

    // Preserve ingestion data from existing census if available
    const existing = existingEntries.get(id);

    const entry: CensusLawEntry = {
      id,
      title,
      identifier: actCode,
      url,
      status: 'in_force',
      category: 'act',
      classification: 'ingestable',
      ingested: existing?.ingested ?? false,
      provision_count: existing?.provision_count ?? 0,
      ingestion_date: existing?.ingestion_date ?? null,
    };

    existingEntries.set(id, entry);
  }

  // Build final census
  const allLaws = Array.from(existingEntries.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  const ingestable = allLaws.filter(l => l.classification === 'ingestable').length;
  const inaccessible = allLaws.filter(l => l.classification === 'inaccessible').length;
  const excluded = allLaws.filter(l => l.classification === 'excluded').length;

  const census: CensusFile = {
    schema_version: '1.0',
    jurisdiction: 'SG',
    jurisdiction_name: 'Singapore',
    portal: SSO_BASE,
    census_date: today,
    agent: 'claude-opus-4-6',
    summary: {
      total_laws: allLaws.length,
      ingestable,
      ocr_needed: 0,
      inaccessible,
      excluded,
    },
    laws: allLaws,
  };

  fs.mkdirSync(path.dirname(CENSUS_PATH), { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log('\n==========================');
  console.log('Census Complete');
  console.log('==========================\n');
  console.log(`  Total acts:     ${allLaws.length}`);
  console.log(`  Ingestable:     ${ingestable}`);
  console.log(`  Inaccessible:   ${inaccessible}`);
  console.log(`  Excluded:       ${excluded}`);
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
