import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { newId } from "./ids";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "CONFIG_CHANGE";

export async function logAudit(params: {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  outletName?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await db.insert(auditLogs).values({
      id: newId(),
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      outletName: params.outletName ?? null,
      summary: params.summary,
      before: params.before === undefined ? null : (params.before as object),
      after: params.after === undefined ? null : (params.after as object),
    });
  } catch (err) {
    // Audit logging must never break the primary operation.
    console.error("Failed to write audit log:", err);
  }
}
