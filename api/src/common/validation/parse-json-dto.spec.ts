import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { parseJsonDto } from './parse-json-dto';

class ItemDto {
  @IsString({ message: 'Name must be a string.' })
  name: string;
}

class SampleDto {
  @IsInt({ message: 'Patient ID must be an integer.' })
  @IsNotEmpty({ message: 'Patient ID is required.' })
  patientId: number;

  @IsArray({ message: 'Items must be an array.' })
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}

async function messagesOf(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as {
      message: string | string[];
    };
    return Array.isArray(body.message) ? body.message : [body.message];
  }
  throw new Error('Expected a BadRequestException');
}

describe('parseJsonDto', () => {
  it('returns a validated class instance with nested instances', async () => {
    const dto = await parseJsonDto(
      SampleDto,
      '{"patientId":1,"items":[{"name":"a"}]}',
    );

    expect(dto).toBeInstanceOf(SampleDto);
    expect(dto.items[0]).toBeInstanceOf(ItemDto);
    expect(dto.patientId).toBe(1);
  });

  it.each([undefined, null, '', '   ', 42])(
    'rejects a missing data field (%p)',
    async (raw) => {
      expect(await messagesOf(parseJsonDto(SampleDto, raw))).toEqual([
        'The "data" field is required.',
      ]);
    },
  );

  it('rejects invalid JSON', async () => {
    expect(await messagesOf(parseJsonDto(SampleDto, '{"patientId":'))).toEqual([
      'The "data" field must be valid JSON.',
    ]);
  });

  it.each(['[1,2]', '"text"', '7', 'null'])(
    'rejects JSON that is not an object (%s)',
    async (raw) => {
      expect(await messagesOf(parseJsonDto(SampleDto, raw))).toEqual([
        'The "data" field must be a JSON object.',
      ]);
    },
  );

  it('reports missing and invalid fields with the DTO messages', async () => {
    const messages = await messagesOf(
      parseJsonDto(SampleDto, '{"items":"nope"}'),
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        'Patient ID is required.',
        'Items must be an array.',
      ]),
    );
  });

  it('prefixes nested errors with their path', async () => {
    const messages = await messagesOf(
      parseJsonDto(
        SampleDto,
        '{"patientId":1,"items":[{"name":"a"},{"name":5}]}',
      ),
    );

    expect(messages).toEqual(['items[1]: Name must be a string.']);
  });

  it('rejects undeclared properties, including nested ones', async () => {
    const messages = await messagesOf(
      parseJsonDto(
        SampleDto,
        '{"patientId":1,"userId":9,"items":[{"name":"a","extra":true}]}',
      ),
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        'property userId should not exist',
        'items[0]: property extra should not exist',
      ]),
    );
  });

  it('does not coerce types implicitly', async () => {
    expect(
      await messagesOf(parseJsonDto(SampleDto, '{"patientId":"1","items":[]}')),
    ).toEqual(['Patient ID must be an integer.']);
  });
});
