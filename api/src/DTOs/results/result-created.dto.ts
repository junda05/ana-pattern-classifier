/**
 * Response returned when a result is created
 *
 * Contains only the data of the created result,
 * without the nested patient and user data.
 *
 * Fields:
 * - resultId: ID of the created result
 * - dateAndHour: date and time of the result
 * - observations: general observations (may be null)
 * - status: result status
 */

import { ResultStatus } from '../../entities/results/result.types';

export interface ResultCreatedDto {
  resultId: number;
  dateAndHour: Date;
  observations: string | null;
  status: ResultStatus;
}
