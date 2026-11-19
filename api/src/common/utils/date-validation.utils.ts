/**
 * Date validation utilities
 *
 * Centralizes the custom date validators so they behave
 * consistently across the application.
 *
 * Principles:
 * - DRY: a single source of truth for date validation
 * - SRP: each function has a single responsibility
 * - Reuse: validators that can be shared by several DTOs
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom validator that checks dateFrom is not later than dateTo
 *
 * Compares two properties of the same object to ensure
 * the start date is not after the end date.
 */
@ValidatorConstraint({ name: 'isDateBeforeOrEqual', async: false })
export class IsDateBeforeOrEqualConstraint
  implements ValidatorConstraintInterface
{
  validate(dateFrom: string, args: ValidationArguments): boolean {
    if (!dateFrom) {
      // Nothing to validate without dateFrom
      return true;
    }

    const [relatedPropertyName] = args.constraints as [string];
    const dateTo = (args.object as Record<string, unknown>)[
      relatedPropertyName
    ];

    if (typeof dateTo !== 'string' || !dateTo) {
      // No possible conflict without dateTo
      return true;
    }

    const dateFromObj = new Date(dateFrom);
    const dateToObj = new Date(dateTo);

    // Both dates must be valid
    if (isNaN(dateFromObj.getTime()) || isNaN(dateToObj.getTime())) {
      return false;
    }

    return dateFromObj <= dateToObj;
  }

  defaultMessage(): string {
    return 'The start date cannot be later than the end date.';
  }
}

/**
 * Custom decorator that validates a date is before or equal to another one
 *
 * @param property - Name of the property to compare against (dateTo)
 * @param validationOptions - Optional validation options
 *
 * @example
 * class DateRangeDto {
 *   @IsDateBeforeOrEqual('dateTo')
 *   dateFrom?: string;
 *
 *   dateTo?: string;
 * }
 */
export function IsDateBeforeOrEqual(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsDateBeforeOrEqualConstraint,
    });
  };
}
