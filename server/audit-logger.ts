import { db } from './db';
import { auditLogs, type InsertAuditLog } from '@shared/schema';
import { sql, desc, eq, and } from 'drizzle-orm';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export class AuditLogger {
  static async log(
    action: string,
    tableName: string,
    recordId: string,
    oldData: any = null,
    newData: any = null,
    context: AuditContext = {}
  ) {
    try {
      const auditEntry: InsertAuditLog = {
        action,
        tableName,
        recordId,
        oldData: oldData ? JSON.stringify(oldData) : null,
        newData: newData ? JSON.stringify(newData) : null,
        userId: context.userId || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        sessionId: context.sessionId || null,
      };

      await db.insert(auditLogs).values(auditEntry);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw - audit logging shouldn't break the main operation
    }
  }

  static async logCreate(
    tableName: string,
    recordId: string,
    newData: any,
    context: AuditContext = {}
  ) {
    return this.log('CREATE', tableName, recordId, null, newData, context);
  }

  static async logUpdate(
    tableName: string,
    recordId: string,
    oldData: any,
    newData: any,
    context: AuditContext = {}
  ) {
    return this.log('UPDATE', tableName, recordId, oldData, newData, context);
  }

  static async logDelete(
    tableName: string,
    recordId: string,
    oldData: any,
    context: AuditContext = {}
  ) {
    return this.log('DELETE', tableName, recordId, oldData, null, context);
  }

  static async logLogin(userId: string, context: AuditContext = {}) {
    return this.log(
      'LOGIN',
      'users',
      userId,
      null,
      { loginTime: new Date() },
      context
    );
  }

  static async logLogout(userId: string, context: AuditContext = {}) {
    return this.log(
      'LOGOUT',
      'users',
      userId,
      null,
      { logoutTime: new Date() },
      context
    );
  }

  static async getAuditHistory(
    tableName?: string,
    recordId?: string,
    userId?: string,
    limit: number = 100,
    offset: number = 0
  ) {
    try {
      // Build conditions array
      const conditions = [];
      
      if (tableName) {
        conditions.push(eq(auditLogs.tableName, tableName));
      }
      if (recordId) {
        conditions.push(eq(auditLogs.recordId, recordId));
      }
      if (userId) {
        conditions.push(eq(auditLogs.userId, userId));
      }

      let query = db.select().from(auditLogs);

      // Apply all conditions at once using and()
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = await query
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      console.error('Failed to retrieve audit history:', error);
      return [];
    }
  }
}
