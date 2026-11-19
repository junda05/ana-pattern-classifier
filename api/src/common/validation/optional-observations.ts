/**
 * Validation for optional free-text observations (results and corrections).
 *
 * - not sent (undefined): the field is left unchanged
 * - '' or null: the text is cleared (stored as null)
 * - otherwise a string of at most 1000 characters (the column length)
 */

import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const OBSERVATIONS_MAX_LENGTH = 1000;

export function OptionalObservations(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (value === '' ? null : value)),
    IsOptional(),
    MaxLength(OBSERVATIONS_MAX_LENGTH, {
      message: `Observations must be at most ${OBSERVATIONS_MAX_LENGTH} characters long.`,
    }),
    IsString({ message: 'Observations must be a string.' }),
  );
}
