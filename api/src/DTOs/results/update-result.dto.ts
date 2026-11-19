/**
 * DTO for updating a result
 *
 * - Only status and observations can be updated
 * - Both fields are optional (partial update)
 * - Other fields cannot be changed, to preserve the audit trail
 *
 * Typical uses:
 * - Changing the result status (workflow)
 * - Adding or editing observations
 * - Administrative corrections
 */

import { IsEnum, IsOptional } from 'class-validator';
import { ResultStatus } from '../../entities/results/result.types';
import { OptionalObservations } from '../../common/validation/optional-observations';

export class UpdateResultDto {
  @IsEnum(ResultStatus, {
    message:
      'Invalid status. It must be one of: PENDING, CORRECTED or VERIFIED.',
  })
  @IsOptional()
  status?: ResultStatus;

  /** '' or null clears the observations (stored as null). */
  @OptionalObservations()
  observations?: string | null;
}
