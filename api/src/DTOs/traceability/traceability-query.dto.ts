/**
 * Query parameters of GET /traceability: pagination plus filters
 *
 * - from: ISO 8601 instant with a time zone, inclusive (dateAndHour >= from)
 * - to: ISO 8601 instant with a time zone, exclusive (dateAndHour < to)
 * - userName: the actor's full name contains this text (case-insensitive)
 * - activityType: one ActivityType value
 *
 * The client turns local days into instants (e.g. the local midnight of the
 * first day and of the day after the last one), so the server never guesses
 * a time zone. Invalid values answer 400.
 *
 * Usage: GET /api/v1/traceability?from=2026-09-24T05:00:00.000Z&to=2026-09-25T05:00:00.000Z&activityType=UPDATE
 */

import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';
import { ActivityType } from '../../entities/traceabilities/traceability.types';
import { IsDateBeforeOrEqual } from '../../common/utils/date-validation.utils';

const INSTANT_MESSAGE =
  '$property must be an ISO 8601 instant with a time zone (e.g. 2026-09-24T05:00:00.000Z).';
/** Date, time and an explicit zone (Z or an offset). */
const INSTANT_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export class TraceabilityQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(INSTANT_WITH_ZONE, { message: INSTANT_MESSAGE })
  @IsISO8601({ strict: true }, { message: INSTANT_MESSAGE })
  @IsDateBeforeOrEqual('to', { message: 'from cannot be later than to.' })
  from?: string;

  @IsOptional()
  @Matches(INSTANT_WITH_ZONE, { message: INSTANT_MESSAGE })
  @IsISO8601({ strict: true }, { message: INSTANT_MESSAGE })
  to?: string;

  @IsOptional()
  @IsString({ message: 'User name must be a string.' })
  @MaxLength(100, { message: 'User name must be at most 100 characters long.' })
  userName?: string;

  @IsOptional()
  @IsEnum(ActivityType, {
    message: `Invalid activity type. It must be one of: ${Object.values(ActivityType).join(', ')}.`,
  })
  activityType?: ActivityType;
}
