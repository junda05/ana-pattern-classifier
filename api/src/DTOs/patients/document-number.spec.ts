import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';
import { UpdatePatientDto } from './update-patient.dto';
import { SearchByDocumentDto } from './search-by-document.dto';

const VALID_PATIENT = {
  fullName: 'John Doe',
  documentType: 'NATIONAL_ID',
  documentNumber: '1000000001',
  gender: 'M',
  birthDate: '1980-01-15',
  phonePrefix: '+1',
  phoneNumber: '5550100',
};

const dtos = [
  ['create', CreatePatientDto, VALID_PATIENT],
  ['update', UpdatePatientDto, {}],
  ['lookup', SearchByDocumentDto, { documentType: 'NATIONAL_ID' }],
] as const;

async function documentNumberErrors(
  cls: new () => object,
  base: object,
  documentNumber: unknown,
): Promise<string[]> {
  const errors = await validate(
    plainToInstance(cls, { ...base, documentNumber }),
  );
  return errors
    .filter((error) => error.property === 'documentNumber')
    .flatMap((error) => Object.values(error.constraints ?? {}));
}

describe.each(dtos)('document number rule (%s)', (_name, cls, base) => {
  it.each(['12345', 'AB12345', 'x1Y2z3', '12345678901234567890'])(
    'accepts %p',
    async (documentNumber) => {
      expect(await documentNumberErrors(cls, base, documentNumber)).toEqual([]);
    },
  );

  it.each([
    ['too short', '1234'],
    ['too long', '123456789012345678901'],
    ['a hyphen', '123-456'],
    ['a space', '123 456'],
    ['a dot', '1.234.567'],
  ])('rejects a number with %s', async (_case, documentNumber) => {
    expect(
      (await documentNumberErrors(cls, base, documentNumber)).length,
    ).toBeGreaterThan(0);
  });

  it('uses the same messages as the lookup', async () => {
    expect(await documentNumberErrors(cls, base, '12-4')).toEqual(
      expect.arrayContaining([
        'The document number must be between 5 and 20 characters long.',
        'The document number may only contain letters and numbers.',
      ]),
    );
  });
});
