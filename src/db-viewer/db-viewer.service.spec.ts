import { BadRequestException } from '@nestjs/common';
import { DbViewerService } from './db-viewer.service';

/* ---------- mock helpers ---------- */

function mockConnMgr(overrides: any = {}) {
  const queries: any[] = [];
  const ds = {
    query: jest.fn(async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      // 表存在性检查
      if (/sqlite_master/.test(sql) && /\?/.test(sql)) {
        const name = params?.[0] ?? '';
        const known = overrides.tables ?? ['account_items', 'account_books'];
        return known.includes(name) ? [{ name }] : [];
      }
      // sqlite_master 主查询（listTables）
      if (/FROM sqlite_master/.test(sql) && !/\?/.test(sql)) {
        const names = overrides.tables ?? ['account_items', 'account_books'];
        return names.map((n: string) => ({ name: n }));
      }
      // COUNT(*) 查询
      if (/COUNT\(\*\)/.test(sql)) return [{ c: overrides.count ?? 42 }];
      // PRAGMA table_info
      if (/PRAGMA table_info/.test(sql)) {
        return overrides.columns ?? [
          { name: 'id', type: 'TEXT', notnull: 1, pk: 1, dflt_value: null },
          { name: 'amount', type: 'DECIMAL', notnull: 0, pk: 0, dflt_value: null },
        ];
      }
      // 普通数据查询
      return overrides.rows ?? [{ id: 'x', amount: 10 }];
    }),
  };
  return { connMgr: { getDataSource: jest.fn(async () => ds) } as any, ds, queries };
}

/* ---------- tests ---------- */

describe('DbViewerService', () => {
  describe('listTables', () => {
    it('should list tables with counts', async () => {
      const { connMgr } = mockConnMgr({ count: 7 });
      const svc = new DbViewerService(connMgr);
      const result = await svc.listTables('user1');
      expect(result.length).toBe(2);
      expect(result.map((r) => r.name).sort()).toEqual(['account_books', 'account_items']);
      expect(result[0].count).toBe(7);
    });
  });

  describe('readTable', () => {
    it('should read table data with columns and pagination', async () => {
      const { connMgr, ds } = mockConnMgr({
        columns: [{ name: 'id', type: 'TEXT', notnull: 1, pk: 1, dflt_value: null }],
        rows: [{ id: 'a' }, { id: 'b' }],
      });
      const svc = new DbViewerService(connMgr);
      const result = await svc.readTable('user1', 'account_items', 1, 50);
      expect(result.table).toBe('account_items');
      expect(result.columns[0].name).toBe('id');
      expect(result.rows).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(ds.query).toHaveBeenCalled();
    });

    it('should reject invalid table names', async () => {
      const { connMgr } = mockConnMgr();
      const svc = new DbViewerService(connMgr);
      await expect(svc.readTable('user1', 'account_items; DROP TABLE x', 1, 50))
        .rejects.toThrow(BadRequestException);
      await expect(svc.readTable('user1', 'not_a_real_table', 1, 50))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('query (read-only enforcement)', () => {
    it('should reject empty SQL', async () => {
      const { connMgr } = mockConnMgr();
      const svc = new DbViewerService(connMgr);
      await expect(svc.query('user1', '   ')).rejects.toThrow(BadRequestException);
    });

    it('should reject write statements', async () => {
      const { connMgr } = mockConnMgr();
      const svc = new DbViewerService(connMgr);
      const bad = [
        'DELETE FROM account_items',
        'UPDATE account_items SET amount = 0',
        'DROP TABLE account_items',
        'INSERT INTO account_items (id) VALUES (1)',
        'ALTER TABLE account_items ADD COLUMN x',
        'CREATE TABLE t (id int)',
        'REPLACE INTO t VALUES (1)',
        'VACUUM',
        'PRAGMA journal_mode=WAL',
        'ATTACH DATABASE \'x\' AS y',
        'WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x',
      ];
      for (const sql of bad) {
        await expect(svc.query('user1', sql)).rejects.toThrow(BadRequestException);
      }
    });

    it('should allow SELECT and append LIMIT when missing', async () => {
      const { connMgr, ds } = mockConnMgr({ rows: [{ a: 1 }] });
      const svc = new DbViewerService(connMgr);
      const result = await svc.query('user1', 'SELECT * FROM account_items');
      expect(result.limited).toBe(true);
      expect(result.sql).toContain('LIMIT');
      expect(ds.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT'));
    });

    it('should keep explicit LIMIT as-is', async () => {
      const { connMgr, ds } = mockConnMgr({ rows: [{ a: 1 }] });
      const svc = new DbViewerService(connMgr);
      const result = await svc.query('user1', 'SELECT * FROM account_items LIMIT 5');
      expect(result.limited).toBe(false);
      expect(result.sql).toBe('SELECT * FROM account_items LIMIT 5');
      expect(ds.query).toHaveBeenCalledWith('SELECT * FROM account_items LIMIT 5');
    });
  });
});
