/**
 * Statute ID resolution for Singapore Law MCP.
 *
 * Resolves fuzzy document references (titles, abbreviations) to database document IDs.
 */

import type Database from '@ansvar/mcp-sqlite';

/**
 * Resolve a document identifier to a database document ID.
 * Supports:
 * - Direct ID match (e.g., "pdpa-2012")
 * - Act title match (e.g., "Personal Data Protection Act 2012")
 * - Short name / abbreviation match (e.g., "PDPA", "CMA")
 * - Title substring match (e.g., "Cybersecurity Act")
 */
export function resolveDocumentId(
  db: InstanceType<typeof Database>,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct ID match
  const directMatch = db.prepare(
    'SELECT id FROM legal_documents WHERE id = ?'
  ).get(trimmed) as { id: string } | undefined;
  if (directMatch) return directMatch.id;

  // Short name / abbreviation match (exact, case-insensitive)
  const shortNameMatch = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(short_name) = LOWER(?) LIMIT 1"
  ).get(trimmed) as { id: string } | undefined;
  if (shortNameMatch) return shortNameMatch.id;

  // Title/short_name fuzzy match
  const titleResult = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? OR short_name LIKE ? OR title_en LIKE ? LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (titleResult) return titleResult.id;

  // Case-insensitive fallback
  const lowerResult = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(title) LIKE LOWER(?) OR LOWER(short_name) LIKE LOWER(?) OR LOWER(title_en) LIKE LOWER(?) LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (lowerResult) return lowerResult.id;

  return null;
}
