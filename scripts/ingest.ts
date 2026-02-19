#!/usr/bin/env tsx
/**
 * Singapore Law MCP -- Ingestion Pipeline
 *
 * Fetches Singapore legislation from Singapore Statutes Online (sso.agc.gov.sg).
 * SSO provides public access to all current Singapore legislation under the
 * Singapore Open Data Licence.
 *
 * The pipeline performs the same sequence a browser would:
 * 1. GET the Act page (receives Part 1 inline + ToC with series IDs)
 * 2. For each series ID, GET /Details/GetLazyLoadContent to fetch that part
 * 3. Parse the combined HTML into structured provision data
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached HTML
 *
 * Data is sourced under the Singapore Open Data Licence.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchFullAct, type SsoActFetchResult } from './lib/fetcher.js';
import { parseSsoAct, parseSsoHtml, KEY_SG_ACTS, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

async function fetchAndParseActs(acts: ActIndexEntry[], skipFetch: boolean): Promise<void> {
  console.log(`\nProcessing ${acts.length} Singapore Acts...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;

  const actResults: { abbr: string; provisions: number; definitions: number; status: string }[] = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const chunksDir = path.join(SOURCE_DIR, `${act.id}-chunks`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
      console.log(`  SKIP ${act.abbreviation} (cached: ${existing.provisions.length} provisions)`);
      totalProvisions += existing.provisions.length;
      totalDefinitions += existing.definitions.length;
      actResults.push({
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
        process.stdout.write(`  Fetching ${act.abbreviation} (${act.actCode})...`);

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

      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);

      actResults.push({
        abbr: act.abbreviation,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'ok',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR ${act.abbreviation}: ${msg}`);
      actResults.push({
        abbr: act.abbreviation,
        provisions: 0,
        definitions: 0,
        status: `FAILED: ${msg.substring(0, 80)}`,
      });
      failed++;
    }

    processed++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(60));
  console.log(`\n  Acts processed: ${processed}`);
  console.log(`  Acts skipped (cached): ${skipped}`);
  console.log(`  Acts failed: ${failed}`);
  console.log(`  Total provisions: ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);
  console.log(`\n  Per-Act breakdown:`);
  console.log(`  ${'Act'.padEnd(16)} ${'Provisions'.padStart(12)} ${'Definitions'.padStart(13)}  Status`);
  console.log(`  ${'-'.repeat(16)} ${'-'.repeat(12)} ${'-'.repeat(13)}  ${'-'.repeat(30)}`);
  for (const r of actResults) {
    console.log(
      `  ${r.abbr.padEnd(16)} ${String(r.provisions).padStart(12)} ${String(r.definitions).padStart(13)}  ${r.status}`,
    );
  }
  console.log();
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  console.log('Singapore Law MCP -- Ingestion Pipeline');
  console.log('=======================================\n');
  console.log(`  Source: Singapore Statutes Online (sso.agc.gov.sg)`);
  console.log(`  License: Singapore Open Data Licence`);
  console.log(`  Rate limit: 500ms between requests`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);

  const acts = limit ? KEY_SG_ACTS.slice(0, limit) : KEY_SG_ACTS;
  await fetchAndParseActs(acts, skipFetch);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
