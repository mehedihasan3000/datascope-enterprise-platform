import type {
  RecordDetailDTO,
  RecordHistoryDTO,
  RecordRelationshipDTO,
} from '@datascope/shared';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  datasetRecords,
  recordHistory,
  recordRelationships,
  users,
} from '../../db/schema/index.js';
import type { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error.middleware.js';
import { resolveEffectiveDatasetPermissions } from '../../middleware/rbac.middleware.js';
import { mapRecordRowToDto } from '../search/search.service.js';

export async function getRecordDetail(
  recordId: string,
  user: AuthenticatedUser,
  expectedDatasetId?: string
): Promise<RecordDetailDTO> {
  const recordRows = await db
    .select()
    .from(datasetRecords)
    .where(
      expectedDatasetId
        ? and(
            eq(datasetRecords.id, recordId),
            eq(datasetRecords.datasetId, expectedDatasetId)
          )
        : eq(datasetRecords.id, recordId)
    )
    .limit(1);

  const row = recordRows[0];
  if (!row) {
    throw new AppError(404, 'RECORD_NOT_FOUND', 'Dataset record not found');
  }

  // Always enforce dataset-level view permission even when accessed via /api/v1/records/:recordId
  if (!expectedDatasetId) {
    const perms = await resolveEffectiveDatasetPermissions(row.datasetId, user);
    if (!perms.canView) {
      throw new AppError(
        403,
        'DATASET_ACCESS_DENIED',
        'You do not have permission to view records in this dataset'
      );
    }
  }

  const [relRows, historyRows] = await Promise.all([
    db
      .select()
      .from(recordRelationships)
      .where(
        or(
          eq(recordRelationships.sourceRecordId, recordId),
          eq(recordRelationships.targetRecordId, recordId)
        )
      )
      .limit(50),
    db
      .select({
        id: recordHistory.id,
        recordId: recordHistory.recordId,
        changedBy: recordHistory.changedBy,
        changedByName: users.fullName,
        changeType: recordHistory.changeType,
        summary: recordHistory.summary,
        previousValues: recordHistory.previousValues,
        newValues: recordHistory.newValues,
        changedAt: recordHistory.changedAt,
      })
      .from(recordHistory)
      .leftJoin(users, eq(recordHistory.changedBy, users.id))
      .where(eq(recordHistory.recordId, recordId))
      .orderBy(desc(recordHistory.changedAt))
      .limit(100),
  ]);

  // Fetch counterpart target records for relationships
  const counterpartIds = Array.from(
    new Set(
      relRows.map((rel) =>
        rel.sourceRecordId === recordId ? rel.targetRecordId : rel.sourceRecordId
      )
    )
  );

  const counterpartMap = new Map<
    string,
    {
      id: string;
      recordCode: string;
      title: string;
      category: string;
      status: string;
      country: string;
      revenue: number;
    }
  >();

  if (counterpartIds.length > 0) {
    const targetRows = await db
      .select({
        id: datasetRecords.id,
        recordCode: datasetRecords.recordCode,
        title: datasetRecords.title,
        category: datasetRecords.category,
        status: datasetRecords.status,
        country: datasetRecords.country,
        revenue: datasetRecords.revenue,
      })
      .from(datasetRecords)
      .where(inArray(datasetRecords.id, counterpartIds));

    for (const t of targetRows) {
      counterpartMap.set(t.id, {
        id: t.id,
        recordCode: t.recordCode,
        title: t.title,
        category: t.category,
        status: t.status,
        country: t.country,
        revenue: Number(t.revenue),
      });
    }
  }

  const relationships: RecordRelationshipDTO[] = relRows.map((rel) => {
    const counterpartId =
      rel.sourceRecordId === recordId ? rel.targetRecordId : rel.sourceRecordId;
    return {
      id: rel.id,
      sourceRecordId: rel.sourceRecordId,
      targetRecordId: rel.targetRecordId,
      relationshipType: rel.relationshipType,
      metadata: rel.metadata ?? {},
      createdAt: rel.createdAt.toISOString(),
      targetRecord: counterpartMap.get(counterpartId),
    };
  });

  const history: RecordHistoryDTO[] = historyRows.map((h) => ({
    id: h.id,
    recordId: h.recordId,
    changedBy: h.changedBy ?? null,
    changedByName: h.changedByName ?? 'System Pipeline',
    changeType: h.changeType,
    summary: h.summary,
    previousValues: h.previousValues ?? null,
    newValues: h.newValues ?? {},
    changedAt: h.changedAt.toISOString(),
  }));

  return {
    ...mapRecordRowToDto(row),
    relationships,
    history,
  };
}
