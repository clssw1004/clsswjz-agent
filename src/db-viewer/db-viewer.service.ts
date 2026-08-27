import { BadRequestException, Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';

/**
 * 数据库只读浏览服务。
 * 安全约束：
 * - 仅允许 SELECT / PRAGMA / WITH(SELECT) 类只读语句，其余一律 400 拒绝
 * - 所有查询强制追加 LIMIT（防大表拖垮服务）
 * - 表名必须是 sqlite_master 中真实存在的表
 * - 通过 ConnectionManager 按 userId 隔离，用户只能看自己的库
 */

/** 写操作关键字（命中即拒绝） */
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'REPLACE',
  'ATTACH', 'DETACH', 'VACUUM', 'REINDEX', 'TRIGGER', 'GRANT', 'REVOKE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'PRAGMA journal',
];

/** 除 SELECT 外的非法语句前缀（避免 `WITH ... DELETE` 等变形绕过） */
const FORBIDDEN_PREFIX = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|VACUUM|REINDEX|TRIGGER|GRANT|REVOKE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|PRAGMA|EXPLAIN|ANALYZE)\b/i;

/** 默认查询最大行数 */
const MAX_ROWS = 200;

@Injectable()
export class DbViewerService {
  constructor(private connMgr: ConnectionManager) {}

  /** 列出当前用户库所有用户表（含行数、列信息） */
  async listTables(userId: string) {
    const ds = await this.connMgr.getDataSource(userId);
    const tables: any[] = await ds.query(
      `SELECT name, (SELECT COUNT(*) FROM sqlite_master AS m2 WHERE m2.type='table' AND m2.name = m1.name) AS _dummy
       FROM sqlite_master AS m1 WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    const result = [];
    for (const t of tables) {
      const name: string = t.name;
      let count = 0;
      try {
        const row = await ds.query(`SELECT COUNT(*) AS c FROM "${name.replace(/"/g, '""')}"`);
        count = Number(row?.[0]?.c || 0);
      } catch { /* 表损坏等异常时行数显示 0 */ }
      result.push({ name, count });
    }
    return result;
  }

  /** 分页读取某表数据 + 列定义 */
  async readTable(userId: string, tableName: string, page = 1, pageSize = 50) {
    const ds = await this.connMgr.getDataSource(userId);
    const safeName = await this.assertTableExists(ds, tableName);
    const p = Math.max(1, Math.floor(page) || 1);
    const size = Math.min(Math.max(1, Math.floor(pageSize) || 50), 100);
    const offset = (p - 1) * size;

    // 列信息（含类型，供前端渲染判断）
    const cols: any[] = await ds.query(`PRAGMA table_info("${safeName}")`);
    const columns = cols.map((c) => ({
      name: c.name,
      type: c.type || '',
      notNull: !!c.notnull,
      pk: !!c.pk,
      dflt: c.dflt_value ?? null,
    }));

    const rows: any[] = await ds.query(
      `SELECT * FROM "${safeName}" ORDER BY rowid LIMIT ${size} OFFSET ${offset}`,
    );

    return {
      table: safeName,
      page: p,
      pageSize: size,
      columns,
      rows,
      total: await this.tableCount(ds, safeName),
    };
  }

  /** 只读 SQL 查询（仅 SELECT 类） */
  async query(userId: string, sql: string, pageSize = 100) {
    if (!sql || !String(sql).trim()) {
      throw new BadRequestException('SQL 不能为空');
    }
    const trimmed = String(sql).trim();
    const size = Math.min(Math.max(1, Math.floor(pageSize) || 100), 200);

    // 1. 关键字黑名单（覆盖注释/大小写/空白绕过）
    const upper = trimmed.toUpperCase().replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
    const hit = FORBIDDEN_KEYWORDS.find((kw) => upper.includes(kw));
    if (hit) {
      throw new BadRequestException(`仅支持只读查询，检测到禁止关键字: ${hit}`);
    }

    // 2. 非法语句前缀（WITH 变形等）
    if (FORBIDDEN_PREFIX.test(trimmed)) {
      throw new BadRequestException('仅支持 SELECT 只读查询');
    }

    // 3. 强制 LIMIT（无 LIMIT 时追加，防全表扫描）
    let finalSql = trimmed;
    if (!/\bLIMIT\b/i.test(upper)) {
      // 去掉尾部分号后追加
      finalSql = trimmed.replace(/;+\s*$/, '') + ` LIMIT ${size}`;
    }

    const ds = await this.connMgr.getDataSource(userId);
    const rows = await ds.query(finalSql);
    const result = Array.isArray(rows) ? rows : [rows];
    return {
      sql: finalSql,
      limited: !/\bLIMIT\b/i.test(upper),
      count: result.length,
      columns: result.length ? Object.keys(result[0]) : [],
      rows: result,
    };
  }

  private async assertTableExists(ds: any, tableName: string): Promise<string> {
    if (!tableName || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
      throw new BadRequestException('非法表名');
    }
    const row = await ds.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
      [tableName],
    );
    if (!row?.length) {
      throw new BadRequestException(`表不存在: ${tableName}`);
    }
    return tableName;
  }

  private async tableCount(ds: any, tableName: string): Promise<number> {
    try {
      const row = await ds.query(`SELECT COUNT(*) AS c FROM "${tableName}"`);
      return Number(row?.[0]?.c || 0);
    } catch {
      return 0;
    }
  }
}
