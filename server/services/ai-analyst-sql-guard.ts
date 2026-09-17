const ALLOWED_RELATIONS = ['analyst_events', 'analyst_collections'] as const;
export type AnalystRelation = (typeof ALLOWED_RELATIONS)[number];

export const MAX_ANALYST_QUERY_ROWS = 500;
export const MAX_ANALYST_QUERY_LENGTH = 12_000;

export type AnalystSqlGuardResult =
  | {
      ok: true;
      sql: string;
      relations: AnalystRelation[];
      limitApplied: boolean;
    }
  | { ok: false; error: string };

function stripLiteralsAndComments(sql: string): string {
  const characters = sql.split('');
  let index = 0;

  const blank = (start: number, end: number) => {
    for (let cursor = start; cursor < end; cursor += 1) {
      if (characters[cursor] !== '\n') characters[cursor] = ' ';
    }
  };

  while (index < sql.length) {
    const pair = sql.slice(index, index + 2);
    if (pair === '--') {
      const end = sql.indexOf('\n', index);
      blank(index, end === -1 ? sql.length : end);
      index = end === -1 ? sql.length : end;
      continue;
    }
    if (pair === '/*') {
      const end = sql.indexOf('*/', index + 2);
      blank(index, end === -1 ? sql.length : end + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[index] === "'") {
      let end = index + 1;
      while (end < sql.length) {
        if (sql[end] === "'" && sql[end + 1] === "'") {
          end += 2;
          continue;
        }
        if (sql[end] === "'") {
          end += 1;
          break;
        }
        end += 1;
      }
      blank(index, end);
      index = end;
      continue;
    }
    if (sql[index] === '"') {
      const end = sql.indexOf('"', index + 1);
      blank(index, end === -1 ? sql.length : end + 1);
      index = end === -1 ? sql.length : end + 1;
      continue;
    }
    index += 1;
  }

  return characters.join('');
}

const FORBIDDEN_KEYWORDS = [
  'insert',
  'update',
  'delete',
  'truncate',
  'drop',
  'alter',
  'create',
  'replace',
  'merge',
  'upsert',
  'grant',
  'revoke',
  'comment',
  'copy',
  'set',
  'reset',
  'show',
  'begin',
  'commit',
  'rollback',
  'savepoint',
  'prepare',
  'execute',
  'deallocate',
  'call',
  'do',
  'vacuum',
  'analyze',
  'refresh',
  'lock',
  'listen',
  'notify',
  'pg_sleep',
  'dblink',
  'lo_import',
  'lo_export',
  'pg_read_file',
  'pg_read_binary_file',
  'pg_ls_dir',
] as const;

function extractRelations(skeleton: string): {
  relations: string[];
  cteNames: Set<string>;
} {
  const cteNames = new Set<string>();
  const ctePattern = /(?:\bwith\b|,)\s*([a-z_][a-z0-9_$]*)\s+as\s*\(/gi;
  let cteMatch: RegExpExecArray | null;
  while ((cteMatch = ctePattern.exec(skeleton)) !== null) {
    cteNames.add(cteMatch[1].toLowerCase());
  }

  const tokens = skeleton.match(/[a-z_][a-z0-9_$]*|[(),.]|\S/gi) ?? [];
  const relations = new Set<string>();
  const terminators = new Set([
    'where',
    'group',
    'having',
    'order',
    'limit',
    'offset',
    'union',
    'intersect',
    'except',
    'window',
    'on',
    'using',
  ]);
  const joinWords = new Set([
    'join',
    'inner',
    'left',
    'right',
    'full',
    'cross',
    'outer',
    'natural',
    'lateral',
  ]);

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index].toLowerCase();
    if (token !== 'from' && token !== 'join') {
      index += 1;
      continue;
    }

    index += 1;
    let expectsRelation = true;
    while (index < tokens.length) {
      const current = tokens[index];
      const normalized = current.toLowerCase();

      if (!expectsRelation) {
        if (current === ',') {
          expectsRelation = true;
          index += 1;
          continue;
        }
        break;
      }

      if (joinWords.has(normalized) || normalized === 'only') {
        index += 1;
        continue;
      }
      if (current === '(') {
        expectsRelation = false;
        index += 1;
        continue;
      }
      if (
        terminators.has(normalized) ||
        !/^[a-z_][a-z0-9_$]*$/i.test(current)
      ) {
        break;
      }

      let relation = current;
      index += 1;
      if (
        tokens[index] === '.' &&
        tokens[index + 1] &&
        /^[a-z_][a-z0-9_$]*$/i.test(tokens[index + 1])
      ) {
        relation = `${relation}.${tokens[index + 1]}`;
        index += 2;
      }

      if (tokens[index] === '(') {
        let depth = 1;
        index += 1;
        while (index < tokens.length && depth > 0) {
          if (tokens[index] === '(') depth += 1;
          if (tokens[index] === ')') depth -= 1;
          index += 1;
        }
      } else {
        relations.add(relation.toLowerCase());
      }
      expectsRelation = false;
    }
  }

  return { relations: [...relations], cteNames };
}

export function guardAnalystSql(rawSql: unknown): AnalystSqlGuardResult {
  if (typeof rawSql !== 'string' || rawSql.trim().length === 0) {
    return { ok: false, error: 'Query was empty.' };
  }
  if (rawSql.length > MAX_ANALYST_QUERY_LENGTH) {
    return {
      ok: false,
      error: `Query exceeds the ${MAX_ANALYST_QUERY_LENGTH.toLocaleString()} character limit.`,
    };
  }

  const sql = rawSql.trim().replace(/;\s*$/, '');
  const skeleton = stripLiteralsAndComments(sql);
  if (skeleton.includes(';')) {
    return {
      ok: false,
      error:
        'Multiple statements are not allowed. Submit one SELECT or WITH query.',
    };
  }
  if (!/^(?:select|with)\b/i.test(skeleton.trimStart())) {
    return {
      ok: false,
      error: 'Only a single read-only SELECT or WITH query is allowed.',
    };
  }
  if (/^\s*with\s+recursive\b/i.test(skeleton)) {
    return {
      ok: false,
      error: 'Recursive queries are not available to the Analyst.',
    };
  }
  if (
    /\b(?:pg_catalog|information_schema|pg_toast|pg_temp)\b/i.test(skeleton)
  ) {
    return {
      ok: false,
      error: 'System schemas are not available to the Analyst.',
    };
  }
  if (/\bpg_[a-z0-9_]+\b/i.test(skeleton)) {
    return {
      ok: false,
      error:
        'PostgreSQL administrative functions are not available to the Analyst.',
    };
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(skeleton)) {
      return {
        ok: false,
        error: `"${keyword.toUpperCase()}" is not allowed in read-only Analyst queries.`,
      };
    }
  }

  const { relations, cteNames } = extractRelations(skeleton);
  const physicalRelations = relations.filter(
    (relation) => !cteNames.has(relation)
  );
  if (physicalRelations.length === 0) {
    return {
      ok: false,
      error: `Query must read ${ALLOWED_RELATIONS.join(' or ')}.`,
    };
  }

  const invalidRelation = physicalRelations.find(
    (relation) => !ALLOWED_RELATIONS.includes(relation as AnalystRelation)
  );
  if (invalidRelation) {
    return {
      ok: false,
      error: `Relation "${invalidRelation}" is unavailable. Allowed relations: ${ALLOWED_RELATIONS.join(', ')}.`,
    };
  }

  const limitApplied = !/\blimit\s+\d+\b/i.test(skeleton);
  return {
    ok: true,
    sql: limitApplied
      ? `SELECT * FROM (${sql}) AS analyst_result LIMIT ${MAX_ANALYST_QUERY_ROWS}`
      : sql,
    relations: physicalRelations as AnalystRelation[],
    limitApplied,
  };
}
