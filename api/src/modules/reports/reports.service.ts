/**
 * Clinical reports service
 *
 * Searches and returns finalized clinical reports.
 *
 * Features:
 * - Report search by patient name (partial) or document number (exact)
 * - Only results with status VERIFIED or CORRECTED are reports
 * - Full report detail: every prediction of the result with its final pattern
 * - Responsible physician (the "medic" printed on the report)
 * - Pagination
 *
 * Business rules:
 * - A report lists EVERY prediction of the result, ordered by predictionId
 * - Final pattern of a prediction = its latest correction (newest
 *   correctedDate) if any, otherwise the model prediction
 * - Responsible physician = the user behind the most recent of
 *   {latest correction of the result, verification (verifiedBy/verifiedAt)};
 *   the creator of the result when neither exists
 * - lastModifiedAt = the latest of: the result date, the latest correction,
 *   the verification, and the latest UPDATE audit record of the result
 * - Search results are sorted by date, newest first
 *
 * Access control:
 * - Every authenticated user can see every report
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Result } from '../../entities/results/result.entity';
import { User } from '../../entities/users/users.entity';
import { CorrectedResult } from '../../entities/corrections/corrected-result.entity';
import { Prediction } from '../../entities/predictions/prediction.entity';
import { Traceability } from '../../entities/traceabilities/traceability.entity';
import { ReportSearchQueryDto } from '../../DTOs/reports/report-search-query.dto';
import { ReportListDto } from '../../DTOs/reports/report-list.dto';
import {
  ReportDetailDto,
  PredictionReportDto,
} from '../../DTOs/reports/report-detail.dto';
import { ReportSearchResponseDto } from '../../DTOs/reports/report-search-response.dto';
import { ResultStatus } from '../../entities/results/result.types';
import {
  ActivityType,
  EntityType,
} from '../../entities/traceabilities/traceability.types';
import { latestCorrection } from '../../common/utils/latest-correction';
import { toHttpException } from '../../common/errors/http-errors';
import { predictionImageUrl } from '../../config/api-base-url';
import { escapeLike } from '../../common/utils/sql-like';

const REPORT_STATUSES = [ResultStatus.VERIFIED, ResultStatus.CORRECTED];
const MAX_REPORTS_PER_PAGE = 50;

function toPredictionReport(prediction: Prediction): PredictionReportDto {
  const latest = latestCorrection<CorrectedResult>(prediction.corrections);
  return {
    predictionId: prediction.predictionId,
    prediction: prediction.prediction,
    confidencePercentage: prediction.confidencePercentage,
    imagePath: prediction.imagePath,
    imageUrl: predictionImageUrl(prediction.imagePath) ?? '',
    dilution: prediction.dilution,
    correction: latest
      ? {
          correctedResultId: latest.correctedResultId,
          correctedPrediction: latest.correctedPrediction,
          observations: latest.observations,
          correctedDate: latest.correctedDate,
          correctedBy: latest.correctedBy,
        }
      : undefined,
    finalPattern: latest ? latest.correctedPrediction : prediction.prediction,
  };
}

/**
 * User responsible for the report: whoever acted last between the latest
 * correction and the verification; the creator when there is neither.
 */
function responsiblePhysicianId(
  result: Result,
  lastCorrection: CorrectedResult | undefined,
): number {
  const verification =
    result.verifiedBy != null && result.verifiedAt != null
      ? { userId: result.verifiedBy, at: new Date(result.verifiedAt).getTime() }
      : undefined;
  const correction = lastCorrection
    ? {
        userId: lastCorrection.correctedBy,
        at: new Date(lastCorrection.correctedDate).getTime(),
      }
    : undefined;

  if (verification && correction) {
    return correction.at > verification.at
      ? correction.userId
      : verification.userId;
  }
  return verification?.userId ?? correction?.userId ?? result.userId;
}

function latestDate(dates: Array<Date | null | undefined>): Date {
  const times = dates
    .filter((date): date is Date => date != null)
    .map((date) => new Date(date).getTime());
  return new Date(Math.max(...times));
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject('RESULT_REPOSITORY')
    private readonly resultRepository: Repository<Result>,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: Repository<User>,
    @Inject('TRACEABILITY_REPOSITORY')
    private readonly traceabilityRepository: Repository<Traceability>,
  ) {}

  /**
   * Searches clinical reports by patient name (partial) or document number (exact).
   * Only results with status VERIFIED or CORRECTED are returned.
   *
   * @throws BadRequestException when neither criterion is given
   */
  async searchReports(
    query: ReportSearchQueryDto,
  ): Promise<ReportSearchResponseDto<ReportListDto>> {
    const patientName = query.patientName?.trim();
    const patientDocument = query.patientDocument?.trim();

    if (!patientName && !patientDocument) {
      throw new BadRequestException(
        'Provide at least one search criterion (patient name or document number).',
      );
    }

    try {
      const currentPage = Math.max(1, query.page ?? 1);
      const itemsPerPage = Math.min(
        Math.max(1, query.limit ?? 10),
        MAX_REPORTS_PER_PAGE,
      );
      const skip = (currentPage - 1) * itemsPerPage;

      const queryBuilder = this.resultRepository
        .createQueryBuilder('result')
        .leftJoinAndSelect('result.patient', 'patient')
        .where('result.status IN (:...statuses)', {
          statuses: REPORT_STATUSES,
        });

      if (patientName) {
        queryBuilder.andWhere('patient.fullName LIKE :patientName', {
          patientName: `%${escapeLike(patientName)}%`,
        });
      }

      if (patientDocument) {
        queryBuilder.andWhere('patient.documentNumber = :patientDocument', {
          patientDocument,
        });
      }

      queryBuilder
        .orderBy('result.dateAndHour', 'DESC')
        .addOrderBy('result.resultId', 'DESC');

      const total = await queryBuilder.getCount();
      const results = await queryBuilder
        .skip(skip)
        .take(itemsPerPage)
        .getMany();

      const data: ReportListDto[] = results.map((result) => ({
        resultId: result.resultId,
        dateAndHour: result.dateAndHour,
        status: result.status,
        patientName: result.patient.fullName,
        patientDocument: result.patient.documentNumber,
        patientPhoneNumber: result.patient.phoneNumber,
        patientPhonePrefix: result.patient.phonePrefix,
        patientEmail: result.patient.email,
        observations: result.observations,
      }));

      return {
        data,
        total,
        page: currentPage,
        limit: itemsPerPage,
        totalPages: Math.ceil(total / itemsPerPage),
      };
    } catch (error) {
      throw toHttpException(error, this.logger, 'Could not search reports');
    }
  }

  /**
   * Returns the full detail of a report: every prediction with its final
   * pattern and image, the responsible physician, verification details and
   * the creation/last-modification dates.
   *
   * @param id - Result ID
   * @throws NotFoundException when the result does not exist or is still PENDING
   */
  async getReportById(id: number): Promise<ReportDetailDto> {
    try {
      const result = await this.resultRepository.findOne({
        where: { resultId: id },
        relations: [
          'patient',
          'user',
          'verifier',
          'predictions',
          'predictions.corrections',
        ],
      });

      if (!result) {
        throw new NotFoundException(`Report with ID ${id} not found.`);
      }

      if (!REPORT_STATUSES.includes(result.status)) {
        throw new NotFoundException(
          `Result with ID ${id} is not available as a report (status: ${result.status}).`,
        );
      }

      const predictions: Prediction[] = [...(result.predictions ?? [])].sort(
        (a, b) => a.predictionId - b.predictionId,
      );
      const allCorrections: CorrectedResult[] = predictions.flatMap(
        (p) => p.corrections ?? [],
      );
      const lastCorrection = latestCorrection(allCorrections);

      const physicianId = responsiblePhysicianId(result, lastCorrection);
      const physician = await this.userRepository.findOne({
        where: { userId: physicianId },
      });
      if (!physician) {
        throw new NotFoundException(
          `Responsible user with ID ${physicianId} not found.`,
        );
      }

      return {
        resultId: result.resultId,
        dateAndHour: result.dateAndHour,
        observations: result.observations,
        status: result.status,
        patient: {
          patientId: result.patient.patientId,
          fullName: result.patient.fullName,
          documentType: result.patient.documentType,
          documentNumber: result.patient.documentNumber,
          gender: result.patient.gender,
          birthDate: result.patient.birthDate,
          phonePrefix: result.patient.phonePrefix,
          phoneNumber: result.patient.phoneNumber,
          email: result.patient.email,
        },
        medic: {
          userId: physician.userId,
          fullName: physician.fullName,
          professionalCard: physician.professionalCard,
          email: physician.email,
          username: physician.username,
        },
        verifiedBy: result.verifier
          ? {
              userId: result.verifier.userId,
              fullName: result.verifier.fullName,
            }
          : null,
        verifiedAt: result.verifiedAt ?? null,
        predictions: predictions.map(toPredictionReport),
        createdAt: result.dateAndHour,
        lastModifiedAt: await this.getLastModificationDate(
          result,
          lastCorrection,
        ),
      };
    } catch (error) {
      throw toHttpException(error, this.logger, `Could not load report ${id}`);
    }
  }

  /**
   * Latest of: result date, latest correction, verification, and the latest
   * UPDATE audit record of the result (status or observation changes,
   * appended images).
   */
  private async getLastModificationDate(
    result: Result,
    lastCorrection: CorrectedResult | undefined,
  ): Promise<Date> {
    const lastUpdate = await this.traceabilityRepository.findOne({
      where: {
        entityType: EntityType.RESULT,
        entityId: result.resultId,
        activityType: ActivityType.UPDATE,
      },
      order: { dateAndHour: 'DESC', traceabilityId: 'DESC' },
    });

    return latestDate([
      result.dateAndHour,
      lastCorrection?.correctedDate,
      result.verifiedAt,
      lastUpdate?.dateAndHour,
    ]);
  }
}
