/**
 * Parses and validates a JSON string field of a multipart request.
 *
 * Multipart endpoints receive their structured payload as a JSON string (the
 * "data" field), which the global ValidationPipe cannot validate. This helper
 * applies the same rules as the pipe: class-transformer instance, whitelist,
 * forbidden undeclared properties, first error per property. Types are not
 * coerced (JSON already carries numbers and strings).
 *
 * Every failure is a 400 BadRequestException whose `message` is a list of
 * readable errors; nested errors are prefixed with their path, e.g.
 * `predictions[1]: Invalid prediction. ...`.
 */

import { BadRequestException } from '@nestjs/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

function childPath(parentPath: string, error: ValidationError): string {
  const property = String(error.property);
  if (/^\d+$/.test(property)) {
    return `${parentPath}[${property}]`;
  }
  return parentPath ? `${parentPath}.${property}` : property;
}

function flattenErrors(errors: ValidationError[], parentPath = ''): string[] {
  return errors.flatMap((error) => {
    const messages = Object.values(error.constraints ?? {}).map((message) =>
      parentPath ? `${parentPath}: ${message}` : message,
    );
    const children = flattenErrors(
      error.children ?? [],
      childPath(parentPath, error),
    );
    return [...messages, ...children];
  });
}

export async function parseJsonDto<T extends object>(
  cls: ClassConstructor<T>,
  raw: unknown,
  fieldName = 'data',
): Promise<T> {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new BadRequestException([`The "${fieldName}" field is required.`]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException([
      `The "${fieldName}" field must be valid JSON.`,
    ]);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException([
      `The "${fieldName}" field must be a JSON object.`,
    ]);
  }

  const instance = plainToInstance(cls, parsed);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });

  if (errors.length > 0) {
    throw new BadRequestException(flattenErrors(errors));
  }

  return instance;
}
