import AuditLog from '../models/AuditLog.js';

/**
 * Appends an entry to the audit log. `adminId` is null for automatic actions (auto-hiding), which are recorded with
 * `system: true`.
 */
export const audit = (adminId, entry) => AuditLog.create({ adminId: adminId ?? null, system: !adminId, ...entry });
