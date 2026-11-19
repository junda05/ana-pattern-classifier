/**
 * Centralized audit-trail (traceability) service
 *
 * Main features:
 * - Unified logging of actions performed in the system
 * - Automatic change detection between old and new values
 * - Supports several entity types (USER, PATIENT, RESULT, CORRECTION)
 * - Detailed, structured view of each audit record
 *
 * Main methods:
 * - logCreate(): logs entity creation
 * - logUpdate(): logs an update, one record per changed field
 * - logUpdateConsolidated(): logs several changes as one record (JSON snapshots)
 * - logDelete(): logs entity deletion
 * - logAction(): generic method for custom actions
 *
 * Rules:
 * - userId is null for system actions (seed script, bootstrap); such records
 *   are shown with the actor name "System"
 * - Logging never breaks the main operation: failures are logged, not thrown
 * - Sensitive fields (password, tokens) are never stored
 * - previousValue/newValue hold either a JSON object (CREATE, DELETE,
 *   consolidated UPDATE) or a plain value (per-field UPDATE, password reset);
 *   only values that look like JSON objects are parsed
 * - The current correction of a prediction is its latest one by correctedDate
 */

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Traceability } from '../../entities/traceabilities/traceability.entity';
import {
  ActivityType,
  EntityType,
  ACTIVITY_TYPE_CHOICES,
  ENTITY_TYPE_CHOICES,
  SYSTEM_ACTOR_NAME,
} from '../../entities/traceabilities/traceability.types';
import { User } from '../../entities/users/users.entity';
import { Patient } from '../../entities/patients/patient.entity';
import { Result } from '../../entities/results/result.entity';
import { Prediction } from '../../entities/predictions/prediction.entity';
import { CorrectedResult } from '../../entities/corrections/corrected-result.entity';
import { TraceabilityListDto } from '../../DTOs/traceability/traceability-list.dto';
import {
  TraceabilityDetailDto,
  GeneralInfoDto,
  UserInfoDto,
  PatientInfoDto,
  AffectedUserInfoDto,
  ResultInfoDto,
  FieldChangeDto,
  PredictionInfoDto,
} from '../../DTOs/traceability/traceability-detail.dto';
import {
  getFieldLabel,
  DILUTION_UPDATED_LABEL,
} from '../../common/constants/field-labels.constants';
import { PaginatedResponseDto } from '../../DTOs/traceability/pagination-query.dto';
import { parseAuditJson } from '../../common/utils/audit-json';
import { latestCorrection } from '../../common/utils/latest-correction';
import { predictionImageUrl } from '../../config/api-base-url';
import { containsPattern } from '../../common/utils/sql-like';
import { datetime2 } from '../../common/utils/sql-datetime';

/** Filters of the audit-trail list (all optional). */
export interface TraceabilityFilters {
  /** ISO 8601 instant, inclusive */
  from?: string;
  /** ISO 8601 instant, exclusive */
  to?: string;
  userName?: string;
  activityType?: ActivityType;
}

/**
 * Audit-trail entry data
 */
interface TraceabilityData {
  activityType: ActivityType;
  entityType: EntityType;
  entityId: number;
  /** null for system actions */
  userId: number | null;
  fieldChanged?: string;
  previousValue?: string;
  newValue?: string;
}

/** A prediction as stored in a result snapshot or a consolidated correction record. */
interface StoredPrediction {
  predictionId?: number;
  prediction?: string;
  originalPrediction?: string;
  correctedPrediction?: string;
  observations?: string | null;
  confidencePercentage?: number;
  imagePath?: string;
  imageUrl?: string;
  dilution?: string;
}

/**
 * The JSON snapshots this service and ResultsService write to previousValue /
 * newValue. Every field is optional (each record kind stores a subset) and
 * unknown fields are shown as generic field changes.
 */
interface StoredSnapshot {
  // Result snapshots (CREATE / consolidated UPDATE)
  predictions?: StoredPrediction[];
  addedPredictions?: StoredPrediction[];
  predictionsCount?: number;
  newPredictionsAdded?: number;
  _dilutionMetadata?: Record<string, string>;
  // Correction records
  resultId?: number;
  corrections?: StoredPrediction[];
  predictionId?: number;
  originalPrediction?: string;
  correctedPrediction?: string;
  observations?: string | null;
  resultStatus?: string;
  previousResultStatus?: string;
  // Patient data copied into correction records
  patientId?: number;
  patientFullName?: string;
  patientDocumentType?: string;
  patientDocumentNumber?: string;
  patientGender?: string;
  patientBirthDate?: Date;
  patientEmail?: string;
  patientPhonePrefix?: string;
  patientPhoneNumber?: string;
  [field: string]: unknown;
}

/** Fields never compared or stored as changes. */
const IGNORED_CHANGE_FIELDS = [
  'password',
  'dateAndHour',
  'dateJoined',
  'lastLogin',
  'correctedDate',
  'createdAt',
  'updatedAt',
];

/** Fields removed from stored snapshots. */
const SENSITIVE_FIELDS = ['password', 'token', 'refreshToken'];

/** Patient fields shown in the "Patient information" section instead of the field changes. */
const PATIENT_SNAPSHOT_FIELDS = [
  'patientId',
  'patientFullName',
  'patientDocumentType',
  'patientDocumentNumber',
  'patientGender',
  'patientBirthDate',
  'patientEmail',
  'patientPhonePrefix',
  'patientPhoneNumber',
];

/** Fields shown in other sections of the detail view (not as field changes). */
const CONSOLIDATED_EXCLUDED_FIELDS = [
  ...PATIENT_SNAPSHOT_FIELDS,
  'predictions',
  // Corrections sent with an append; they show in the predictions section
  'corrections',
  'addedPredictions',
  '_dilutionMetadata',
];
const CREATE_EXCLUDED_FIELDS = [
  ...PATIENT_SNAPSHOT_FIELDS,
  'predictions',
  'corrections',
  'addedPredictions',
  '_dilutionMetadata',
  'previousResultStatus',
];

/** Text form of a stored value: '' when absent, ISO for dates, JSON for objects. */
function displayValue(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return value.toString();
    default:
      return JSON.stringify(value) ?? '';
  }
}

function storedPredictionIds(stored: StoredPrediction[]): number[] {
  return stored
    .map((prediction) => prediction.predictionId)
    .filter((id): id is number => typeof id === 'number' && id > 0);
}

function toPatientInfo(patient: Patient): PatientInfoDto {
  return {
    patientId: patient.patientId,
    fullName: patient.fullName,
    documentType: patient.documentType,
    documentNumber: patient.documentNumber,
    gender: patient.gender,
    birthDate: patient.birthDate,
    email: patient.email,
    phonePrefix: patient.phonePrefix,
    phoneNumber: patient.phoneNumber,
  };
}

function correctionInfo(correction: CorrectedResult | undefined) {
  return correction
    ? {
        correctedPrediction: correction.correctedPrediction,
        observations: correction.observations,
        correctedDate: correction.correctedDate,
      }
    : undefined;
}

@Injectable()
export class TraceabilityService {
  private readonly logger = new Logger(TraceabilityService.name);

  constructor(
    @Inject('TRACEABILITY_REPOSITORY')
    private readonly traceabilityRepository: Repository<Traceability>,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: Repository<User>,
    @Inject('PATIENT_REPOSITORY')
    private readonly patientRepository: Repository<Patient>,
    @Inject('RESULT_REPOSITORY')
    private readonly resultRepository: Repository<Result>,
    @Inject('PREDICTION_REPOSITORY')
    private readonly predictionRepository: Repository<Prediction>,
  ) {}

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------

  /**
   * Logs a create action
   * @param userId - ID of the user who performed the action (null for system actions)
   * @param entityData - Data of the created entity (optional, for the detail view)
   */
  async logCreate(
    entityType: EntityType,
    entityId: number,
    userId: number | null,
    entityData?: Record<string, any>,
  ): Promise<void> {
    await this.persist('create', {
      activityType: ActivityType.CREATE,
      entityType,
      entityId,
      userId,
      newValue: entityData
        ? JSON.stringify(this.sanitizeData(entityData))
        : undefined,
    });
  }

  /**
   * Logs an update action: one record per field whose value changed
   * @param userId - ID of the user who performed the action (null for system actions)
   */
  async logUpdate(
    entityType: EntityType,
    entityId: number,
    userId: number | null,
    previousData: Record<string, any>,
    newData: Record<string, any>,
  ): Promise<void> {
    const changes = this.detectChanges(previousData, newData);
    if (changes.length === 0) {
      return;
    }

    await this.persist(
      'update',
      changes.map((change) => ({
        activityType: ActivityType.UPDATE,
        entityType,
        entityId,
        userId,
        fieldChanged: change.field,
        previousValue: change.oldValue,
        newValue: change.newValue,
      })),
    );
  }

  /**
   * Logs an update consolidated into a SINGLE record; both snapshots are
   * stored as JSON objects.
   * @param userId - ID of the user who performed the action (null for system actions)
   */
  async logUpdateConsolidated(
    entityType: EntityType,
    entityId: number,
    userId: number | null,
    previousData: Record<string, any>,
    newData: Record<string, any>,
  ): Promise<void> {
    await this.persist('consolidated update', {
      activityType: ActivityType.UPDATE,
      entityType,
      entityId,
      userId,
      previousValue: JSON.stringify(this.sanitizeData(previousData)),
      newValue: JSON.stringify(this.sanitizeData(newData)),
    });
  }

  /**
   * Logs a delete action
   * @param userId - ID of the user who performed the action (null for system actions)
   * @param entityData - Data of the deleted entity (optional)
   */
  async logDelete(
    entityType: EntityType,
    entityId: number,
    userId: number | null,
    entityData?: Record<string, any>,
  ): Promise<void> {
    await this.persist('delete', {
      activityType: ActivityType.DELETE,
      entityType,
      entityId,
      userId,
      previousValue: entityData
        ? JSON.stringify(this.sanitizeData(entityData))
        : undefined,
    });
  }

  /**
   * Logs a custom action
   * @param data - Full audit-trail entry data
   */
  async logAction(data: TraceabilityData): Promise<void> {
    await this.persist('custom action', data);
  }

  /** Saves audit records; failures are logged and never break the main operation. */
  private async persist(
    kind: string,
    data: TraceabilityData | TraceabilityData[],
  ): Promise<void> {
    try {
      const entries = Array.isArray(data)
        ? data.map((entry) => this.traceabilityRepository.create(entry))
        : this.traceabilityRepository.create(data);
      await this.traceabilityRepository.save(entries as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Could not write the audit record (${kind}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Detects changed fields between two snapshots (only fields present in newData)
   */
  private detectChanges(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
  ): Array<{ field: string; oldValue: string; newValue: string }> {
    const changes: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }> = [];

    for (const key of Object.keys(newData)) {
      // Fields that were not sent (undefined), and internal fields, are
      // skipped; null is a real value (a cleared field)
      if (newData[key] === undefined || IGNORED_CHANGE_FIELDS.includes(key)) {
        continue;
      }

      const oldValue = oldData[key];
      const newValue = newData[key];

      if (!this.areValuesEqual(oldValue, newValue)) {
        changes.push({
          field: key,
          oldValue: displayValue(oldValue),
          newValue: displayValue(newValue),
        });
      }
    }

    return changes;
  }

  private areValuesEqual(value1: unknown, value2: unknown): boolean {
    if (value1 == null && value2 == null) {
      return true;
    }
    if (value1 == null || value2 == null) {
      return false;
    }
    if (value1 instanceof Date && value2 instanceof Date) {
      return value1.getTime() === value2.getTime();
    }
    if (typeof value1 === 'object' && typeof value2 === 'object') {
      return JSON.stringify(value1) === JSON.stringify(value2);
    }
    return value1 === value2;
  }

  /** Removes sensitive fields from a snapshot */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    for (const field of SENSITIVE_FIELDS) {
      delete sanitized[field];
    }
    return sanitized;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Returns the audit records, newest first, paginated and filtered:
   * - from (inclusive) / to (exclusive): ISO 8601 instants
   * - userName: the actor's full name contains the text (case-insensitive,
   *   LIKE wildcards escaped)
   * - activityType: exact activity type
   */
  async findAllPaginated(
    page: number,
    limit: number,
    filters: TraceabilityFilters = {},
  ): Promise<PaginatedResponseDto<TraceabilityListDto>> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.traceabilityRepository
      .createQueryBuilder('trace')
      .leftJoinAndSelect('trace.user', 'user');
    if (filters.from) {
      queryBuilder.andWhere('trace.dateAndHour >= :from', {
        from: datetime2(new Date(filters.from)),
      });
    }
    if (filters.to) {
      queryBuilder.andWhere('trace.dateAndHour < :to', {
        to: datetime2(new Date(filters.to)),
      });
    }
    if (filters.userName?.trim()) {
      queryBuilder.andWhere('LOWER(user.fullName) LIKE :userName', {
        userName: containsPattern(filters.userName),
      });
    }
    if (filters.activityType) {
      queryBuilder.andWhere('trace.activityType = :activityType', {
        activityType: filters.activityType,
      });
    }

    const [traceabilities, total] = await queryBuilder
      .orderBy('trace.dateAndHour', 'DESC')
      .addOrderBy('trace.traceabilityId', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: traceabilities.map((trace) => this.mapToListDto(trace)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Returns the full detail of an audit record
   */
  async findById(id: number): Promise<TraceabilityDetailDto> {
    const traceability = await this.traceabilityRepository.findOne({
      where: { traceabilityId: id },
      relations: ['user'],
    });

    if (!traceability) {
      throw new NotFoundException(`Audit record with ID ${id} not found.`);
    }

    return await this.mapToDetailDto(traceability);
  }

  private actorName(trace: Traceability): string {
    if (trace.user) {
      return trace.user.fullName;
    }
    return trace.userId == null ? SYSTEM_ACTOR_NAME : 'Unknown user';
  }

  private mapToListDto(trace: Traceability): TraceabilityListDto {
    return {
      traceabilityId: trace.traceabilityId,
      userFullName: this.actorName(trace),
      userRole: trace.user?.role ?? null,
      dateAndHour: trace.dateAndHour,
      // Raw code for client-side logic; the label is display text only
      activityType: trace.activityType,
      activityTypeLabel: this.getActivityTypeLabel(trace.activityType),
      entityType: trace.entityType,
    };
  }

  private mapToUserInfo(trace: Traceability): UserInfoDto {
    if (!trace.user) {
      return {
        userId: trace.userId,
        username: null,
        fullName: this.actorName(trace),
        role: null,
        email: null,
      };
    }
    return {
      userId: trace.user.userId,
      username: trace.user.username,
      fullName: trace.user.fullName,
      role: trace.user.role,
      email: trace.user.email,
    };
  }

  private async mapToDetailDto(
    trace: Traceability,
  ): Promise<TraceabilityDetailDto> {
    const generalInfo: GeneralInfoDto = {
      dateAndHour: trace.dateAndHour,
      activityType: trace.activityType,
      activityTypeLabel: this.getActivityTypeLabel(trace.activityType),
    };

    let patientInfo: PatientInfoDto | undefined;
    let affectedUserInfo: AffectedUserInfoDto | undefined;
    let resultInfo: ResultInfoDto | undefined;

    switch (trace.entityType) {
      case EntityType.PATIENT: {
        const patient = await this.patientRepository.findOne({
          where: { patientId: trace.entityId },
        });
        if (patient) {
          patientInfo = {
            patientId: patient.patientId,
            fullName: patient.fullName,
            documentType: patient.documentType,
            documentNumber: patient.documentNumber,
          };
        }
        break;
      }
      case EntityType.USER: {
        const user = await this.userRepository.findOne({
          where: { userId: trace.entityId },
        });
        if (user) {
          affectedUserInfo = {
            userId: user.userId,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            email: user.email,
          };
        }
        break;
      }
      case EntityType.RESULT:
        ({ resultInfo, patientInfo } = await this.buildResultSection(trace));
        break;
      case EntityType.CORRECTION:
        ({ resultInfo, patientInfo } =
          await this.buildCorrectionSection(trace));
        break;
    }

    return {
      traceabilityId: trace.traceabilityId,
      generalInfo,
      userInfo: this.mapToUserInfo(trace),
      entityType: trace.entityType,
      entityTypeLabel: this.getEntityTypeLabel(trace.entityType),
      patientInfo,
      affectedUserInfo,
      resultInfo,
      fieldChanges: this.getFieldChanges(trace),
    };
  }

  /** Parses a stored snapshot; plain values return null, malformed JSON is reported as a warning. */
  private parseSnapshot(
    trace: Traceability,
    value: string | null | undefined,
  ): StoredSnapshot | null {
    // The snapshots are written by this API in the StoredSnapshot shape.
    return parseAuditJson(value, (error) =>
      this.logger.warn(
        `Audit record ${trace.traceabilityId} holds malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
      ),
    ) as StoredSnapshot | null;
  }

  /**
   * Result section: the predictions stored in the record (CREATE or
   * consolidated UPDATE) with their current corrections, otherwise the current
   * predictions of the result.
   */
  private async buildResultSection(
    trace: Traceability,
  ): Promise<{ resultInfo?: ResultInfoDto; patientInfo?: PatientInfoDto }> {
    const result = await this.resultRepository.findOne({
      where: { resultId: trace.entityId },
      relations: ['patient'],
    });
    if (!result) {
      return {};
    }

    const newData = this.parseSnapshot(trace, trace.newValue);
    const holdsSnapshot =
      trace.activityType === ActivityType.CREATE ||
      (trace.activityType === ActivityType.UPDATE && !trace.fieldChanged);
    const snapshot = holdsSnapshot ? newData : null;

    let predictions: PredictionInfoDto[];
    let predictionsCount: number;
    if (Array.isArray(snapshot?.predictions)) {
      predictions = await this.withCurrentCorrections(snapshot.predictions);
      predictionsCount = snapshot.predictionsCount || predictions.length;
    } else if (
      trace.activityType === ActivityType.UPDATE &&
      Array.isArray(snapshot?.addedPredictions)
    ) {
      predictions = await this.withCurrentCorrections(
        snapshot.addedPredictions,
      );
      predictionsCount = snapshot.predictionsCount || 0;
    } else {
      predictions = await this.currentPredictions(trace.entityId);
      predictionsCount = predictions.length;
    }

    // Extra information when the record added predictions to the result
    let addedPredictions: PredictionInfoDto[] = [];
    let newPredictionsAdded = 0;
    let originalResultDateTime: Date | undefined;
    if (
      newData?.newPredictionsAdded &&
      Array.isArray(newData.addedPredictions)
    ) {
      newPredictionsAdded = newData.newPredictionsAdded;
      addedPredictions = await this.withCurrentCorrections(
        newData.addedPredictions,
      );
      originalResultDateTime = result.dateAndHour;
    }

    let patientInfo: PatientInfoDto | undefined;
    if (result.patient) {
      patientInfo = toPatientInfo(result.patient);
    } else {
      const patient = await this.patientRepository.findOne({
        where: { patientId: result.patientId },
      });
      patientInfo = patient ? toPatientInfo(patient) : undefined;
    }

    return {
      resultInfo: {
        resultId: result.resultId,
        status: result.status,
        dateAndHour: result.dateAndHour,
        observations: result.observations,
        predictionsCount,
        predictions,
        newPredictionsAdded,
        addedPredictions,
        originalResultDateTime,
      },
      patientInfo,
    };
  }

  /** Correction section: the corrected predictions and the patient of the result. */
  private async buildCorrectionSection(
    trace: Traceability,
  ): Promise<{ resultInfo?: ResultInfoDto; patientInfo?: PatientInfoDto }> {
    const data = this.parseSnapshot(trace, trace.newValue);
    let resultId: number | undefined = data?.resultId;
    const predictions: PredictionInfoDto[] = [];

    if (Array.isArray(data?.corrections)) {
      // Consolidated record with several corrections
      const current = await this.loadPredictions(
        storedPredictionIds(data.corrections),
        false,
      );
      for (const stored of data.corrections) {
        const prediction =
          stored.predictionId !== undefined
            ? current.get(stored.predictionId)
            : undefined;
        if (!prediction) {
          continue;
        }
        const imagePath = stored.imagePath || prediction.imagePath;
        predictions.push({
          predictionId: prediction.predictionId,
          prediction: stored.originalPrediction || prediction.prediction,
          confidencePercentage:
            stored.confidencePercentage || prediction.confidencePercentage,
          imagePath,
          imageUrl: predictionImageUrl(imagePath),
          dilution: stored.dilution || prediction.dilution,
          correction: {
            correctedPrediction: stored.correctedPrediction ?? '',
            observations: stored.observations,
          },
        });
      }
    } else if (data?.predictionId) {
      // Single-correction record
      const prediction = await this.predictionRepository.findOne({
        where: { predictionId: data.predictionId },
        relations: ['result'],
      });
      if (prediction) {
        resultId = prediction.result?.resultId ?? resultId;
        predictions.push({
          predictionId: prediction.predictionId,
          prediction: data.originalPrediction || prediction.prediction,
          confidencePercentage: prediction.confidencePercentage,
          imagePath: prediction.imagePath,
          imageUrl: predictionImageUrl(prediction.imagePath),
          dilution: prediction.dilution,
          correction: {
            correctedPrediction: data.correctedPrediction ?? '',
            observations: data.observations,
          },
        });
      }
    }

    const resultInfo: ResultInfoDto | undefined =
      predictions.length > 0
        ? {
            resultId,
            status: undefined,
            dateAndHour: undefined,
            observations: undefined,
            predictionsCount: predictions.length,
            predictions,
          }
        : undefined;

    let patientInfo: PatientInfoDto | undefined;
    if (data?.patientId) {
      // Patient data stored in the audit record
      patientInfo = {
        patientId: data.patientId,
        fullName: data.patientFullName ?? '',
        documentType: data.patientDocumentType ?? '',
        documentNumber: data.patientDocumentNumber ?? '',
        gender: data.patientGender,
        birthDate: data.patientBirthDate,
        email: data.patientEmail,
        phonePrefix: data.patientPhonePrefix,
        phoneNumber: data.patientPhoneNumber,
      };
    } else if (resultId) {
      const result = await this.resultRepository.findOne({
        where: { resultId },
        relations: ['patient'],
      });
      patientInfo = result?.patient ? toPatientInfo(result.patient) : undefined;
    }

    return { resultInfo, patientInfo };
  }

  /** Loads predictions by ID (optionally with their corrections). */
  private async loadPredictions(
    ids: number[],
    withCorrections: boolean,
  ): Promise<Map<number, Prediction>> {
    if (ids.length === 0) {
      return new Map();
    }
    const query = this.predictionRepository.createQueryBuilder('prediction');
    if (withCorrections) {
      query.leftJoinAndSelect('prediction.corrections', 'corrections');
    }
    const rows = await query
      .where('prediction.predictionId IN (:...ids)', { ids })
      .getMany();
    return new Map(rows.map((row) => [row.predictionId, row]));
  }

  /**
   * Predictions stored in an audit record, with their CURRENT latest correction
   * (corrections may have been made after the record) and image URLs rebuilt
   * with the current API base URL.
   */
  private async withCurrentCorrections(
    stored: StoredPrediction[],
  ): Promise<PredictionInfoDto[]> {
    const current = await this.loadPredictions(
      storedPredictionIds(stored),
      true,
    );
    return stored.map((prediction) => {
      const latest = latestCorrection<CorrectedResult>(
        prediction.predictionId !== undefined
          ? current.get(prediction.predictionId)?.corrections
          : undefined,
      );
      const normalized = {
        ...prediction,
        imageUrl:
          predictionImageUrl(prediction.imagePath) ?? prediction.imageUrl,
      } as PredictionInfoDto;
      return latest
        ? { ...normalized, correction: correctionInfo(latest) }
        : normalized;
    });
  }

  /** Current predictions of a result with their latest corrections, by predictionId. */
  private async currentPredictions(
    resultId: number,
  ): Promise<PredictionInfoDto[]> {
    const result = await this.resultRepository.findOne({
      where: { resultId },
      relations: ['predictions', 'predictions.corrections'],
    });
    return [...(result?.predictions ?? [])]
      .sort((a: Prediction, b: Prediction) => a.predictionId - b.predictionId)
      .map((prediction: Prediction) => ({
        predictionId: prediction.predictionId,
        prediction: prediction.prediction,
        confidencePercentage: prediction.confidencePercentage,
        imagePath: prediction.imagePath,
        imageUrl: predictionImageUrl(prediction.imagePath),
        dilution: prediction.dilution,
        correction: correctionInfo(
          latestCorrection<CorrectedResult>(prediction.corrections),
        ),
      }));
  }

  /**
   * Field changes shown under "Activity details"
   */
  private getFieldChanges(trace: Traceability): FieldChangeDto[] {
    // Single-field records (per-field UPDATE, password reset) store plain values
    if (trace.fieldChanged) {
      return [
        {
          fieldName: trace.fieldChanged,
          fieldLabel: getFieldLabel(trace.fieldChanged),
          previousValue: trace.previousValue || '',
          newValue: trace.newValue || '',
        },
      ];
    }

    if (trace.activityType === ActivityType.UPDATE) {
      return this.consolidatedChanges(trace);
    }

    if (trace.activityType === ActivityType.CREATE) {
      const data = this.parseSnapshot(trace, trace.newValue);
      if (!data) {
        return [];
      }
      const changes: FieldChangeDto[] = [];
      const excluded = [...CREATE_EXCLUDED_FIELDS];

      // Result status change of a correction record, shown once as a before/after pair
      if (data.previousResultStatus && data.resultStatus) {
        changes.push({
          fieldName: 'resultStatus',
          fieldLabel: getFieldLabel('resultStatus'),
          previousValue: data.previousResultStatus,
          newValue: data.resultStatus,
        });
        excluded.push('resultStatus');
      }

      for (const [key, value] of Object.entries(data)) {
        if (!excluded.includes(key)) {
          changes.push({
            fieldName: key,
            fieldLabel: getFieldLabel(key),
            previousValue: '',
            newValue: displayValue(value),
          });
        }
      }
      return changes;
    }

    if (trace.activityType === ActivityType.DELETE) {
      const data = this.parseSnapshot(trace, trace.previousValue);
      return data
        ? Object.entries(data).map(([key, value]) => ({
            fieldName: key,
            fieldLabel: getFieldLabel(key),
            previousValue: displayValue(value),
            newValue: '',
          }))
        : [];
    }

    return [];
  }

  /** Differences between the two snapshots of a consolidated UPDATE record. */
  private consolidatedChanges(trace: Traceability): FieldChangeDto[] {
    const previousData = this.parseSnapshot(trace, trace.previousValue);
    const newData = this.parseSnapshot(trace, trace.newValue);
    if (!previousData || !newData) {
      return [];
    }

    // File name of each dynamic dilution field
    const dilutionMetadata = newData._dilutionMetadata ?? {};
    const changes: FieldChangeDto[] = [];
    const allKeys = new Set([
      ...Object.keys(previousData),
      ...Object.keys(newData),
    ]);

    for (const key of allKeys) {
      if (CONSOLIDATED_EXCLUDED_FIELDS.includes(key)) {
        continue;
      }
      const previousValue = previousData[key];
      const newValue = newData[key];
      if (JSON.stringify(previousValue) === JSON.stringify(newValue)) {
        continue;
      }
      const fieldLabel =
        key.startsWith('dilutionUpdated_') && dilutionMetadata[key]
          ? `${DILUTION_UPDATED_LABEL} - ${dilutionMetadata[key]}`
          : getFieldLabel(key);
      changes.push({
        fieldName: key,
        fieldLabel,
        previousValue: displayValue(previousValue),
        newValue: displayValue(newValue),
      });
    }

    return changes;
  }

  private getActivityTypeLabel(activityType: ActivityType): string {
    const choice = ACTIVITY_TYPE_CHOICES.find((c) => c.value === activityType);
    return choice?.label || activityType;
  }

  private getEntityTypeLabel(entityType: EntityType): string {
    const choice = ENTITY_TYPE_CHOICES.find((c) => c.value === entityType);
    return choice?.label || entityType;
  }
}
