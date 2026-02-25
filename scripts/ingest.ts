#!/usr/bin/env tsx
/**
 * Singapore Law MCP -- Census-Driven Ingestion Pipeline
 *
 * Fetches ALL Singapore legislation from Singapore Statutes Online (sso.agc.gov.sg)
 * using data/census.json as the source of truth for what to ingest.
 *
 * SSO provides public access to all current Singapore legislation under the
 * Singapore Open Data Licence.
 *
 * The pipeline performs the same sequence a browser would:
 * 1. GET the Act page (receives Part 1 inline + ToC with series IDs)
 * 2. For each series ID, GET /Details/GetLazyLoadContent to fetch that part
 * 3. Parse the combined HTML into structured provision data
 *
 * Usage:
 *   npm run ingest                    # Full census-driven ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached HTML
 *   npm run ingest -- --resume        # Skip acts that already have seed files
 *   npm run ingest -- --start-from ID # Resume from a specific act ID
 *
 * Data is sourced under the Singapore Open Data Licence.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchFullAct, type SsoActFetchResult } from './lib/fetcher.js';
import { parseSsoAct, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

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

function parseArgs(): { limit: number | null; skipFetch: boolean; resume: boolean; startFrom: string | null } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let resume = false;
  let startFrom: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--resume') {
      resume = true;
    } else if (args[i] === '--start-from' && args[i + 1]) {
      startFrom = args[i + 1];
      resume = true;
      i++;
    }
  }

  return { limit, skipFetch, resume, startFrom };
}

/**
 * Convert a census entry to an ActIndexEntry compatible with the existing parser.
 */
function censusToActEntry(law: CensusLawEntry): ActIndexEntry {
  return {
    id: law.id,
    actCode: `Act/${law.identifier}`,
    title: law.title,
    titleEn: law.title,
    abbreviation: law.identifier,
    status: law.status,
    issuedDate: '',
    inForceDate: '',
    url: law.url,
  };
}

/**
 * Load census file.
 */
function loadCensus(): CensusFile {
  if (!fs.existsSync(CENSUS_PATH)) {
    throw new Error(
      `Census file not found: ${CENSUS_PATH}\nRun: npx tsx scripts/census.ts`,
    );
  }
  return JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8')) as CensusFile;
}

/**
 * Update census.json with ingestion results.
 */
function updateCensus(census: CensusFile, results: Map<string, { provisions: number; failed: boolean }>): void {
  const today = new Date().toISOString().split('T')[0];

  for (const law of census.laws) {
    const result = results.get(law.id);
    if (result && !result.failed) {
      law.ingested = true;
      law.provision_count = result.provisions;
      law.ingestion_date = today;
    }
  }

  // Recalculate summary
  census.summary.total_laws = census.laws.length;
  census.summary.ingestable = census.laws.filter(l => l.classification === 'ingestable').length;

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));
}

async function fetchAndParseActs(
  acts: ActIndexEntry[],
  skipFetch: boolean,
  resume: boolean,
): Promise<Map<string, { provisions: number; failed: boolean }>> {
  console.log(`\nProcessing ${acts.length} Singapore Acts...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 10;

  const results = new Map<string, { provisions: number; failed: boolean }>();
  const actResults: { id: string; abbr: string; provisions: number; definitions: number; status: string }[] = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const chunksDir = path.join(SOURCE_DIR, `${act.id}-chunks`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Resume: skip if seed already exists
    if (resume && fs.existsSync(seedFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
        totalProvisions += existing.provisions.length;
        totalDefinitions += existing.definitions.length;
        results.set(act.id, { provisions: existing.provisions.length, failed: false });
        skipped++;
        processed++;

        // Only log every 50th skip to reduce noise
        if (skipped % 50 === 0) {
          console.log(`  ... skipped ${skipped} existing acts so far`);
        }
        continue;
      } catch {
        // Seed file is corrupt, re-ingest
      }
    }

    // Skip-fetch + seed exists: use cached seed
    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
      console.log(`  SKIP ${act.abbreviation} (cached: ${existing.provisions.length} provisions)`);
      totalProvisions += existing.provisions.length;
      totalDefinitions += existing.definitions.length;
      results.set(act.id, { provisions: existing.provisions.length, failed: false });
      actResults.push({
        id: act.id,
        abbr: act.abbreviation,
        provisions: existing.provisions.length,
        definitions: existing.definitions.length,
        status: 'cached',
      });
      skipped++;
      processed++;
      continue;
    }

    try {
      let parsed: ParsedAct;

      if (skipFetch && fs.existsSync(sourceFile)) {
        // Reuse cached HTML + chunks
        const initialHtml = fs.readFileSync(sourceFile, 'utf-8');
        const bodyChunksHtml: string[] = [];
        const tailChunksHtml: string[] = [];

        if (fs.existsSync(chunksDir)) {
          const chunkFiles = fs.readdirSync(chunksDir).sort();
          for (const cf of chunkFiles) {
            const chunkContent = fs.readFileSync(path.join(chunksDir, cf), 'utf-8');
            if (cf.startsWith('body-')) bodyChunksHtml.push(chunkContent);
            else if (cf.startsWith('tail-')) tailChunksHtml.push(chunkContent);
          }
        }

        const fetchResult: SsoActFetchResult = {
          initialHtml,
          bodyChunksHtml,
          tailChunksHtml,
          chunksLoaded: bodyChunksHtml.length + tailChunksHtml.length,
        };
        parsed = parseSsoAct(fetchResult, act);
        console.log(`  ${act.abbreviation}: parsed from cache (${fetchResult.chunksLoaded} chunks)`);
      } else {
        // Full fetch: initial page + all lazy-loaded chunks
        const progress = `[${processed + 1}/${acts.length}]`;
        process.stdout.write(`  ${progress} Fetching ${act.abbreviation} (${act.id})...`);

        const fetchResult = await fetchFullAct(act.url);

        // Cache the initial HTML
        fs.writeFileSync(sourceFile, fetchResult.initialHtml);

        // Cache the chunks
        fs.mkdirSync(chunksDir, { recursive: true });
        fetchResult.bodyChunksHtml.forEach((chunk, i) => {
          fs.writeFileSync(path.join(chunksDir, `body-${i}.html`), chunk);
        });
        fetchResult.tailChunksHtml.forEach((chunk, i) => {
          fs.writeFileSync(path.join(chunksDir, `tail-${i}.html`), chunk);
        });

        const totalKb = (
          fetchResult.initialHtml.length +
          fetchResult.bodyChunksHtml.reduce((s, c) => s + c.length, 0) +
          fetchResult.tailChunksHtml.reduce((s, c) => s + c.length, 0)
        ) / 1024;

        console.log(` OK (${totalKb.toFixed(0)} KB, ${fetchResult.chunksLoaded} chunks)`);

        parsed = parseSsoAct(fetchResult, act);
      }

      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;
      consecutiveFailures = 0;

      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);

      results.set(act.id, { provisions: parsed.provisions.length, failed: false });
      actResults.push({
        id: act.id,
        abbr: act.abbreviation,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'ok',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR ${act.abbreviation}: ${msg}`);
      results.set(act.id, { provisions: 0, failed: true });
      actResults.push({
        id: act.id,
        abbr: act.abbreviation,
        provisions: 0,
        definitions: 0,
        status: `FAILED: ${msg.substring(0, 80)}`,
      });
      failed++;
      consecutiveFailures++;

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`\n  FATAL: ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Stopping.`);
        console.log(`  Re-run with --resume to continue from where you left off.`);
        break;
      }
    }

    processed++;
  }

  // Print summary
  if (skipped > 0) {
    console.log(`\n  Skipped ${skipped} existing acts (resume mode)`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(60));
  console.log(`\n  Acts processed: ${processed}`);
  console.log(`  Acts skipped (existing): ${skipped}`);
  console.log(`  Acts failed: ${failed}`);
  console.log(`  Total provisions: ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);

  // Only print per-act breakdown for newly ingested acts (not resume-skipped)
  const newResults = actResults.filter(r => r.status !== 'cached');
  if (newResults.length > 0 && newResults.length <= 100) {
    console.log(`\n  Per-Act breakdown (newly ingested):`);
    console.log(`  ${'Act'.padEnd(20)} ${'Provisions'.padStart(12)} ${'Definitions'.padStart(13)}  Status`);
    console.log(`  ${'-'.repeat(20)} ${'-'.repeat(12)} ${'-'.repeat(13)}  ${'-'.repeat(30)}`);
    for (const r of newResults) {
      console.log(
        `  ${r.abbr.substring(0, 20).padEnd(20)} ${String(r.provisions).padStart(12)} ${String(r.definitions).padStart(13)}  ${r.status}`,
      );
    }
  }
  console.log();

  return results;
}

async function main(): Promise<void> {
  const { limit, skipFetch, resume, startFrom } = parseArgs();

  console.log('Singapore Law MCP -- Census-Driven Ingestion Pipeline');
  console.log('=====================================================\n');
  console.log(`  Source: Singapore Statutes Online (sso.agc.gov.sg)`);
  console.log(`  License: Singapore Open Data Licence`);
  console.log(`  Rate limit: 500ms between requests`);
  console.log(`  Census: ${CENSUS_PATH}`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);
  if (resume) console.log(`  --resume`);
  if (startFrom) console.log(`  --start-from ${startFrom}`);

  // Load census
  const census = loadCensus();
  console.log(`\n  Census: ${census.summary.total_laws} total, ${census.summary.ingestable} ingestable`);

  // Filter to ingestable acts
  let ingestable = census.laws.filter(l => l.classification === 'ingestable');

  // Apply --start-from
  if (startFrom) {
    const idx = ingestable.findIndex(l => l.id === startFrom);
    if (idx === -1) {
      console.error(`  ERROR: Act ID "${startFrom}" not found in census`);
      process.exit(1);
    }
    ingestable = ingestable.slice(idx);
    console.log(`  Starting from ${startFrom} (${ingestable.length} remaining)`);
  }

  // Apply --limit
  if (limit) {
    ingestable = ingestable.slice(0, limit);
  }

  // Convert to ActIndexEntry format
  const acts = ingestable.map(censusToActEntry);

  const results = await fetchAndParseActs(acts, skipFetch, resume);

  // Update census with results
  updateCensus(census, results);
  console.log(`  Census updated: ${CENSUS_PATH}`);

  // Final summary
  const ingested = census.laws.filter(l => l.ingested).length;
  console.log(`  Ingestion status: ${ingested}/${census.summary.ingestable} acts ingested`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
