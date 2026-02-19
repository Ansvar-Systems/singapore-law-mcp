/**
 * HTML parser for Singapore legislation from Singapore Statutes Online (SSO).
 *
 * SSO serves each Act as server-rendered HTML. The initial page contains
 * Part 1 inline; remaining parts are loaded via AJAX. The HTML structure
 * uses consistent CSS classes:
 *
 *   <div class="prov1">                         -- provision wrapper
 *     <td class="prov1Hdr" id="prN-">           -- section header, N = section number
 *       <span class="">Title</span>             -- section title
 *     <td class="prov1Txt">                      -- section text content
 *       <strong>N.</strong> ...                   -- section number + text
 *
 *   <td class="part" id="P1N-">                  -- part wrapper
 *     <div class="partNo">PART N</div>           -- part number
 *     <td class="partHdr">TITLE</td>             -- part title
 *
 *   <td class="def">                             -- definition entry
 *     "term" means ...;                           -- definition text
 *
 * Singapore statutes use "Section" numbering (s1, s2, ...) not "Article".
 * Section numbers can include letters (e.g., s26A, s48P).
 */

import type { SsoActFetchResult } from './fetcher.js';

export interface ActIndexEntry {
  id: string;
  actCode: string;
  title: string;
  titleEn: string;
  abbreviation: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Decode HTML entities and strip tags, collapsing whitespace.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#xA0;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/\u200B/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

/**
 * Extract the inline Part 1 provisions from the initial page HTML.
 * The inline content sits inside <div class="body">...</div>.
 */
function extractInlineBodyHtml(pageHtml: string): string {
  // The legis div contains front matter, body, and tail
  const legisMatch = pageHtml.match(/id="legis">([\s\S]*?)(?=<\/div>\s*<div[^>]*id="(?:provTimeline|footerContent)"|\s*<div class="dms")/);
  if (!legisMatch) {
    // Fallback: look for the body div directly
    const bodyMatch = pageHtml.match(/<div class="body">([\s\S]*?)(?=<div class="tail">|<div class="dms")/);
    return bodyMatch?.[1] ?? '';
  }
  return legisMatch[1];
}

/**
 * Parse provisions from an HTML chunk (either inline or lazy-loaded).
 * Returns an array of parsed provisions and tracks the current part name.
 */
function parseProvisionsFromHtml(
  html: string,
  currentPart: { name: string },
): { provisions: ParsedProvision[]; definitions: ParsedDefinition[] } {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Track current part - update when we encounter a part header
  const partPattern = /<div class="partNo">([^<]+)<\/div>[\s\S]*?class="partHdr"[^>]*>([^<]+)/g;
  let partMatch: RegExpExecArray | null;
  const partPositions: { pos: number; name: string }[] = [];

  while ((partMatch = partPattern.exec(html)) !== null) {
    const partNo = stripHtml(partMatch[1]).trim();
    const partTitle = stripHtml(partMatch[2]).trim();
    partPositions.push({ pos: partMatch.index, name: `${partNo} - ${partTitle}` });
  }

  // Split the HTML on provision boundaries: <div class="prov1">
  // We need to find each prov1 div and extract its content
  const provPattern = /<div class="prov1">/g;
  const provStarts: number[] = [];
  let provMatch: RegExpExecArray | null;

  while ((provMatch = provPattern.exec(html)) !== null) {
    provStarts.push(provMatch.index);
  }

  for (let i = 0; i < provStarts.length; i++) {
    const start = provStarts[i];
    const end = i + 1 < provStarts.length ? provStarts[i + 1] : html.length;
    const provHtml = html.substring(start, end);

    // Update current part based on position
    for (const pp of partPositions) {
      if (pp.pos < start) {
        currentPart.name = pp.name;
      }
    }

    // Extract section number from id="prN-" in prov1Hdr
    const hdrMatch = provHtml.match(/class="prov1Hdr"\s+id="pr([0-9]+[A-Z]*)-"/i);
    if (!hdrMatch) continue;

    const sectionNum = hdrMatch[1];
    const provisionRef = `s${sectionNum}`;

    // Extract section title from <span class="">...</span> inside prov1Hdr
    const titleMatch = provHtml.match(/class="prov1Hdr"[^>]*>[\s\S]*?<span class="">([^<]+)<\/span>/);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';

    // Extract the full text content of the provision
    // Get everything from prov1Txt onwards
    const txtMatch = provHtml.match(/class="prov1Txt">([\s\S]*)/);
    const rawContent = txtMatch ? txtMatch[1] : provHtml;
    const content = stripHtml(rawContent);

    if (content.length > 10) {
      provisions.push({
        provision_ref: provisionRef,
        chapter: currentPart.name || undefined,
        section: sectionNum,
        title,
        content: content.substring(0, 12000), // Cap at 12K chars for very long sections
      });
    }

    // Extract definitions from class="def" elements within this provision.
    // SSO uses Unicode left/right double quotes: U+201C (\u201C) and U+201D (\u201D).
    // Pattern: <td class="def" style="...">  "term"  means/has/includes ... </td>
    const defPattern = /class="def"[^>]*>\s*[\u201C\u201E"]\s*([^"\u201D\u201C]+)\s*[\u201D"]\s*([\s\S]*?)(?=<\/td>)/g;
    let defMatch: RegExpExecArray | null;

    while ((defMatch = defPattern.exec(provHtml)) !== null) {
      const term = stripHtml(defMatch[1]).trim();
      // Build clean definition text from term + the rest (group 2), not group 0 which has HTML tags
      const restText = stripHtml(defMatch[2]).trim();
      const cleanDef = `\u201C${term}\u201D ${restText}`;

      if (term && cleanDef.length > 5) {
        definitions.push({
          term,
          definition: cleanDef.substring(0, 4000),
          source_provision: provisionRef,
        });
      }
    }
  }

  return { provisions, definitions };
}

/**
 * Parse a complete SSO Act fetch result into structured data.
 *
 * Processes the initial HTML (which contains Part 1 inline) and all
 * lazy-loaded body chunks to extract every provision.
 */
export function parseSsoAct(fetchResult: SsoActFetchResult, act: ActIndexEntry): ParsedAct {
  const allProvisions: ParsedProvision[] = [];
  const allDefinitions: ParsedDefinition[] = [];
  const currentPart = { name: '' };

  // 1. Parse inline content from the initial page (Part 1)
  const inlineHtml = extractInlineBodyHtml(fetchResult.initialHtml);
  if (inlineHtml) {
    const { provisions, definitions } = parseProvisionsFromHtml(inlineHtml, currentPart);
    allProvisions.push(...provisions);
    allDefinitions.push(...definitions);
  }

  // 2. Parse each lazy-loaded body chunk (Parts 2, 3, ...)
  for (const chunk of fetchResult.bodyChunksHtml) {
    const { provisions, definitions } = parseProvisionsFromHtml(chunk, currentPart);
    allProvisions.push(...provisions);
    allDefinitions.push(...definitions);
  }

  // 3. Parse schedule chunks (tail) - these may contain additional provisions
  for (const chunk of fetchResult.tailChunksHtml) {
    const { provisions, definitions } = parseProvisionsFromHtml(chunk, currentPart);
    allProvisions.push(...provisions);
    allDefinitions.push(...definitions);
  }

  // Deduplicate provisions by provision_ref (keep longest content)
  const byRef = new Map<string, ParsedProvision>();
  for (const prov of allProvisions) {
    const existing = byRef.get(prov.provision_ref);
    if (!existing || prov.content.length > existing.content.length) {
      byRef.set(prov.provision_ref, prov);
    }
  }

  // Deduplicate definitions by term (keep longest)
  const byTerm = new Map<string, ParsedDefinition>();
  for (const def of allDefinitions) {
    const existing = byTerm.get(def.term);
    if (!existing || def.definition.length > existing.definition.length) {
      byTerm.set(def.term, def);
    }
  }

  // Extract long title / description from the initial HTML
  const longTitleMatch = fetchResult.initialHtml.match(/class="longTitle"[^>]*>([\s\S]*?)<\/td>/);
  const description = longTitleMatch ? stripHtml(longTitleMatch[1]) : undefined;

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.abbreviation,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description,
    provisions: Array.from(byRef.values()),
    definitions: Array.from(byTerm.values()),
  };
}

/**
 * Legacy compatibility wrapper: parse from raw HTML string.
 * Used when working with cached HTML files.
 */
export function parseSsoHtml(html: string, act: ActIndexEntry): ParsedAct {
  return parseSsoAct(
    {
      initialHtml: html,
      bodyChunksHtml: [],
      tailChunksHtml: [],
      chunksLoaded: 0,
    },
    act,
  );
}

/**
 * Pre-configured list of key Singapore Acts to ingest.
 * These are the most important Acts for cybersecurity, data protection,
 * and compliance use cases.
 */
export const KEY_SG_ACTS: ActIndexEntry[] = [
  {
    id: 'pdpa-2012',
    actCode: 'Act/PDPA2012',
    title: 'Personal Data Protection Act 2012',
    titleEn: 'Personal Data Protection Act 2012',
    abbreviation: 'PDPA',
    status: 'in_force',
    issuedDate: '2012-10-15',
    inForceDate: '2014-07-02',
    url: 'https://sso.agc.gov.sg/Act/PDPA2012',
  },
  {
    id: 'ca-2018',
    actCode: 'Act/CA2018',
    title: 'Cybersecurity Act 2018',
    titleEn: 'Cybersecurity Act 2018',
    abbreviation: 'CA2018',
    status: 'in_force',
    issuedDate: '2018-03-02',
    inForceDate: '2018-08-31',
    url: 'https://sso.agc.gov.sg/Act/CA2018',
  },
  {
    id: 'cma-1993',
    actCode: 'Act/CMA1993',
    title: 'Computer Misuse Act',
    titleEn: 'Computer Misuse Act',
    abbreviation: 'CMA',
    status: 'in_force',
    issuedDate: '1993-08-30',
    inForceDate: '1993-08-30',
    url: 'https://sso.agc.gov.sg/Act/CMA1993',
  },
  {
    id: 'eta-2010',
    actCode: 'Act/ETA2010',
    title: 'Electronic Transactions Act',
    titleEn: 'Electronic Transactions Act',
    abbreviation: 'ETA',
    status: 'in_force',
    issuedDate: '2010-11-01',
    inForceDate: '2010-11-01',
    url: 'https://sso.agc.gov.sg/Act/ETA2010',
  },
  {
    id: 'coa-1967',
    actCode: 'Act/CoA1967',
    title: 'Companies Act 1967',
    titleEn: 'Companies Act 1967',
    abbreviation: 'CoA',
    status: 'in_force',
    issuedDate: '1967-12-29',
    inForceDate: '1967-12-29',
    url: 'https://sso.agc.gov.sg/Act/CoA1967',
  },
  {
    id: 'sca-2007',
    actCode: 'Act/SCA2007',
    title: 'Spam Control Act 2007',
    titleEn: 'Spam Control Act 2007',
    abbreviation: 'SCA',
    status: 'in_force',
    issuedDate: '2007-06-01',
    inForceDate: '2007-06-01',
    url: 'https://sso.agc.gov.sg/Act/SCA2007',
  },
  {
    id: 'ta-1999',
    actCode: 'Act/TA1999',
    title: 'Telecommunications Act 1999',
    titleEn: 'Telecommunications Act 1999',
    abbreviation: 'TA',
    status: 'in_force',
    issuedDate: '1999-10-01',
    inForceDate: '1999-12-01',
    url: 'https://sso.agc.gov.sg/Act/TA1999',
  },
  {
    id: 'ea-1893',
    actCode: 'Act/EA1893',
    title: 'Evidence Act 1893',
    titleEn: 'Evidence Act 1893',
    abbreviation: 'EA',
    status: 'in_force',
    issuedDate: '1893-01-01',
    inForceDate: '1893-01-01',
    url: 'https://sso.agc.gov.sg/Act/EA1893',
  },
  {
    id: 'pc-1871',
    actCode: 'Act/PC1871',
    title: 'Penal Code 1871',
    titleEn: 'Penal Code 1871',
    abbreviation: 'PC',
    status: 'in_force',
    issuedDate: '1871-01-01',
    inForceDate: '1871-01-01',
    url: 'https://sso.agc.gov.sg/Act/PC1871',
  },
  {
    id: 'cons-1963',
    actCode: 'Act/CONS1963',
    title: 'Constitution of the Republic of Singapore',
    titleEn: 'Constitution of the Republic of Singapore',
    abbreviation: 'Constitution',
    status: 'in_force',
    issuedDate: '1963-09-16',
    inForceDate: '1963-09-16',
    url: 'https://sso.agc.gov.sg/Act/CONS1963',
  },
];
