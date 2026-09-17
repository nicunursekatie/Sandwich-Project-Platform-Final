import {
  guardAnalystSql,
  MAX_ANALYST_QUERY_ROWS,
} from '../services/ai-analyst-sql-guard';

describe('AI Analyst SQL guard', () => {
  it('allows a full-history aggregation against an approved relation', () => {
    const result = guardAnalystSql(`
      SELECT DATE_TRUNC('month', collection_date::date) AS month,
             SUM(individual_sandwiches) AS sandwiches
      FROM analyst_collections
      GROUP BY 1
      ORDER BY 1
    `);

    expect(result).toMatchObject({
      ok: true,
      relations: ['analyst_collections'],
      limitApplied: true,
    });
    if (result.ok)
      expect(result.sql).toContain(`LIMIT ${MAX_ANALYST_QUERY_ROWS}`);
  });

  it('allows a query CTE while still requiring an approved relation', () => {
    const result = guardAnalystSql(`
      WITH completed AS (
        SELECT * FROM analyst_events WHERE status = 'completed'
      )
      SELECT organization_category, COUNT(*) FROM completed GROUP BY 1
    `);

    expect(result).toMatchObject({ ok: true, relations: ['analyst_events'] });
  });

  it('rejects raw tables, mutation commands, and multiple statements', () => {
    expect(guardAnalystSql('SELECT * FROM event_requests')).toMatchObject({
      ok: false,
    });
    expect(
      guardAnalystSql(
        'SELECT * FROM analyst_events; DELETE FROM event_requests'
      )
    ).toMatchObject({ ok: false });
    expect(
      guardAnalystSql('SELECT pg_sleep(10) FROM analyst_collections')
    ).toMatchObject({ ok: false });
    expect(
      guardAnalystSql(
        'SELECT * FROM analyst_events, event_requests WHERE analyst_events.id = event_requests.id'
      )
    ).toMatchObject({ ok: false });
    expect(
      guardAnalystSql(
        'SELECT * FROM analyst_events ae, event_requests er WHERE ae.id = er.id'
      )
    ).toMatchObject({ ok: false });
    expect(
      guardAnalystSql(
        "SELECT query_to_xml('SELECT password FROM users', true, true, '') FROM analyst_events"
      )
    ).toMatchObject({ ok: false });
    expect(
      guardAnalystSql(
        "SELECT nextval('event_requests_id_seq') FROM analyst_events"
      )
    ).toMatchObject({ ok: false });
    expect(
      guardAnalystSql('SELECT * INTO analyst_copy FROM analyst_events')
    ).toMatchObject({ ok: false });
    expect(
      guardAnalystSql('SELECT * FROM analyst_events FOR UPDATE')
    ).toMatchObject({ ok: false });
  });

  it('does not mistake keywords in string literals for mutations', () => {
    expect(
      guardAnalystSql(
        "SELECT * FROM analyst_events WHERE status = 'deleted' LIMIT 10"
      )
    ).toMatchObject({ ok: true, limitApplied: true });
  });

  it('always wraps model limits in the hard row cap', () => {
    const result = guardAnalystSql('SELECT * FROM analyst_events LIMIT 100000');
    expect(result).toMatchObject({ ok: true, limitApplied: true });
    if (result.ok) {
      expect(result.sql).toContain(`LIMIT ${MAX_ANALYST_QUERY_ROWS}`);
      expect(result.sql).toContain('LIMIT 100000');
    }
  });
});
