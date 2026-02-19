/**
 * format_citation — Format a Singapore legal citation per standard conventions.
 *
 * Singapore uses common law citation style:
 * - "Section N [Act Title Year]" (formal)
 * - "s N [Act Title]" (short)
 */

import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';
import type Database from '@ansvar/mcp-sqlite';

export interface FormatCitationInput {
  citation: string;
  format?: 'full' | 'short' | 'pinpoint';
}

export interface FormatCitationResult {
  original: string;
  formatted: string;
  format: string;
}

export async function formatCitationTool(
  input: FormatCitationInput,
): Promise<FormatCitationResult> {
  const format = input.format ?? 'full';
  const trimmed = input.citation.trim();

  // Parse "Section N <act>" or "s N <act>" or "<act> s N"
  const secFirst = trimmed.match(/^(?:Section|s\.?)\s*(\d+[A-Za-z]*)\s+(.+)$/i);
  const secLast = trimmed.match(/^(.+?)[,;]?\s*(?:Section|s\.?)\s*(\d+[A-Za-z]*)$/i);

  const section = secFirst?.[1] ?? secLast?.[2];
  const act = secFirst?.[2] ?? secLast?.[1] ?? trimmed;

  let formatted: string;
  switch (format) {
    case 'short':
      formatted = section ? `s ${section} ${act.split('(')[0].trim()}` : act;
      break;
    case 'pinpoint':
      formatted = section ? `s ${section}` : act;
      break;
    case 'full':
    default:
      formatted = section ? `Section ${section} ${act}` : act;
      break;
  }

  return { original: input.citation, formatted, format };
}
