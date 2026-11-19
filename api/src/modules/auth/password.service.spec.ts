import * as bcrypt from 'bcrypt';
import { PasswordService } from './password.service';

// Wrap bcrypt.compare in a spy that keeps the real behaviour
jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return {
    ...actual,
    compare: jest.fn((data: string, encrypted: string) =>
      actual.compare(data, encrypted),
    ),
  };
});

const compare = bcrypt.compare as unknown as jest.Mock;

describe('PasswordService', () => {
  const service = new PasswordService();

  beforeEach(() => compare.mockClear());

  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await service.hashPassword('S3cret-passw0rd');

    await expect(
      service.validatePassword('S3cret-passw0rd', hash),
    ).resolves.toBe(true);
    await expect(service.validatePassword('wrong', hash)).resolves.toBe(false);
  });

  it.each([undefined, null, ''])(
    'still runs a bcrypt comparison with the same cost when the stored hash is %p (unknown user)',
    async (missingHash) => {
      const realCost = (await service.hashPassword('S3cret-passw0rd')).split(
        '$',
      )[2];

      await expect(
        service.validatePassword('S3cret-passw0rd', missingHash),
      ).resolves.toBe(false);

      expect(compare).toHaveBeenCalledTimes(1);
      const [, comparedHash] = compare.mock.calls[0] as [string, string];
      expect(comparedHash.split('$')[2]).toBe(realCost);
    },
  );
});
