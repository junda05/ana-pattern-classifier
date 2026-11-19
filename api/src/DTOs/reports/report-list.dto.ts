/**
 * Report item in search results
 *
 * Compact version for search tables; it only holds the data needed
 * to identify the report.
 *
 * Fields:
 * - resultId: ID of the result
 * - dateAndHour: date and time of the analysis
 * - status: result status (always VERIFIED or CORRECTED)
 * - patientName: patient's full name
 * - patientDocument: patient's document number
 * - patientPhoneNumber: patient's phone number (optional)
 * - patientPhonePrefix: phone prefix (optional)
 * - patientEmail: patient's email (optional)
 * - observations: result observations (optional)
 *
 * Note: a result can have several predictions (patterns). There is no
 * "main pattern" field because each prediction is independent.
 */

import { ResultStatus } from '../../entities/results/result.types';

export interface ReportListDto {
  resultId: number;
  dateAndHour: Date;
  status: ResultStatus;
  patientName: string;
  patientDocument: string;
  patientPhoneNumber?: string;
  patientPhonePrefix?: string;
  patientEmail?: string;
  observations?: string | null;
}
