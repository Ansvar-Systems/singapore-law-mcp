/**
 * Response metadata utilities for Singapore Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Singapore Statutes Online (sso.agc.gov.sg) — Attorney-General\'s Chambers of Singapore',
    jurisdiction: 'SG',
    disclaimer:
      'This data is sourced from Singapore Statutes Online under the Singapore Open Data Licence. ' +
      'The authoritative versions are published by the Attorney-General\'s Chambers. ' +
      'Always verify with the official SSO portal at https://sso.agc.gov.sg/.',
    freshness,
  };
}
