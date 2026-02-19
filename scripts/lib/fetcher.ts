/**
 * Rate-limited HTTP client for Singapore Statutes Online (sso.agc.gov.sg)
 *
 * SSO serves legislation as server-rendered HTML with lazy-loaded parts.
 * The initial page contains Part 1 inline and a table of contents with
 * series IDs for remaining parts. Each additional part is fetched via
 * the /Details/GetLazyLoadContent AJAX endpoint.
 *
 * - 500ms minimum delay between requests (be respectful to government servers)
 * - Browser-like User-Agent required (CloudFront blocks bot UAs)
 * - No auth needed (Singapore Open Data Licence)
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const MIN_DELAY_MS = 500;
const SSO_BASE = 'https://sso.agc.gov.sg';

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Fetch a URL with rate limiting and browser-like headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(
  url: string,
  extraHeaders: Record<string, string> = {},
  maxRetries = 3,
): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...extraHeaders,
      },
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const body = await response.text();
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? '',
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Extract the TocSysId from the SSO page HTML.
 * This ID is needed for the lazy-load content API.
 */
function extractTocSysId(html: string): string | null {
  const match = html.match(/TocSysId["']\s*:\s*["']([0-9a-f-]+)["']/i);
  return match?.[1] ?? null;
}

/**
 * Extract series IDs from <div class="dms" data-field="seriesId" data-term="...">
 * elements in the page body (not the tail/schedules section).
 *
 * The body div contains the main Act parts, the tail div contains schedules.
 * We fetch both but distinguish them.
 */
function extractSeriesIds(html: string): { bodyIds: string[]; tailIds: string[] } {
  const bodyIds: string[] = [];
  const tailIds: string[] = [];

  // Split on the <div class="body"> and <div class="tail"> markers
  const bodyMatch = html.match(/<div class="body">([\s\S]*?)(?=<div class="tail">|$)/);
  const tailMatch = html.match(/<div class="tail">([\s\S]*?)(?=<\/div>\s*<\/div>\s*$|$)/);

  const bodyHtml = bodyMatch?.[1] ?? '';
  const tailHtml = tailMatch?.[1] ?? '';

  // Extract data-term values from dms divs with data-field="seriesId"
  const pattern = /data-field="seriesId"\s+data-term="([0-9a-f-]+)"/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(bodyHtml)) !== null) {
    bodyIds.push(match[1]);
  }

  pattern.lastIndex = 0;
  while ((match = pattern.exec(tailHtml)) !== null) {
    if (match[1] !== 'LEGISLATION_ABBREVIATIONS') {
      tailIds.push(match[1]);
    }
  }

  return { bodyIds, tailIds };
}

/**
 * Fetch a single lazy-loaded content chunk from SSO.
 */
async function fetchLazyLoadChunk(
  tocSysId: string,
  seriesId: string,
  actUrl: string,
): Promise<string> {
  const url = `${SSO_BASE}/Details/GetLazyLoadContent?TocSysId=${encodeURIComponent(tocSysId)}&SeriesId=${encodeURIComponent(seriesId)}`;

  const result = await fetchWithRateLimit(url, {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'text/html, */*; q=0.01',
    'Referer': actUrl,
  });

  if (result.status !== 200) {
    throw new Error(`Lazy load chunk ${seriesId} returned HTTP ${result.status}`);
  }

  return result.body;
}

/**
 * Result of fetching a complete Act from SSO.
 */
export interface SsoActFetchResult {
  /** The initial page HTML (contains Part 1 inline) */
  initialHtml: string;
  /** All lazy-loaded body chunks concatenated */
  bodyChunksHtml: string[];
  /** All lazy-loaded tail/schedule chunks concatenated */
  tailChunksHtml: string[];
  /** Total number of AJAX chunks fetched */
  chunksLoaded: number;
}

/**
 * Fetch a complete Act from Singapore Statutes Online.
 *
 * This performs the same sequence a browser would:
 * 1. GET the Act page (receives Part 1 inline + ToC with series IDs)
 * 2. For each series ID, GET /Details/GetLazyLoadContent to fetch that part
 *
 * Returns the initial HTML and all lazy-loaded chunks separately so the
 * parser can extract provisions from each.
 */
export async function fetchFullAct(actUrl: string): Promise<SsoActFetchResult> {
  // Step 1: Fetch the main page
  const mainResult = await fetchWithRateLimit(actUrl);
  if (mainResult.status !== 200) {
    throw new Error(`Act page ${actUrl} returned HTTP ${mainResult.status}`);
  }

  const initialHtml = mainResult.body;

  // Step 2: Extract TocSysId and series IDs
  const tocSysId = extractTocSysId(initialHtml);
  if (!tocSysId) {
    console.log(`    Warning: No TocSysId found, using initial HTML only`);
    return { initialHtml, bodyChunksHtml: [], tailChunksHtml: [], chunksLoaded: 0 };
  }

  const { bodyIds, tailIds } = extractSeriesIds(initialHtml);
  const allIds = [...bodyIds, ...tailIds];

  if (allIds.length === 0) {
    console.log(`    Warning: No series IDs found, using initial HTML only`);
    return { initialHtml, bodyChunksHtml: [], tailChunksHtml: [], chunksLoaded: 0 };
  }

  // Step 3: Fetch each lazy-loaded chunk
  const bodyChunksHtml: string[] = [];
  const tailChunksHtml: string[] = [];
  let loaded = 0;

  for (const seriesId of bodyIds) {
    try {
      const chunk = await fetchLazyLoadChunk(tocSysId, seriesId, actUrl);
      bodyChunksHtml.push(chunk);
      loaded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    Warning: Failed to load body chunk ${seriesId}: ${msg}`);
    }
  }

  for (const seriesId of tailIds) {
    try {
      const chunk = await fetchLazyLoadChunk(tocSysId, seriesId, actUrl);
      tailChunksHtml.push(chunk);
      loaded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    Warning: Failed to load tail chunk ${seriesId}: ${msg}`);
    }
  }

  return { initialHtml, bodyChunksHtml, tailChunksHtml, chunksLoaded: loaded };
}
