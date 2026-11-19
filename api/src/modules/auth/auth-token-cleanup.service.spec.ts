import { Logger } from '@nestjs/common';
import { AuthTokenCleanupService } from './auth-token-cleanup.service';
import { PasswordResetService } from './password-reset.service';
import { TokenBlacklistService } from './token-blacklist.service';

const HOUR = 60 * 60 * 1000;

describe('AuthTokenCleanupService', () => {
  let removeExpired: jest.Mock;
  let removeStaleTokens: jest.Mock;
  let service: AuthTokenCleanupService;
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    removeExpired = jest.fn().mockResolvedValue(1);
    removeStaleTokens = jest.fn().mockResolvedValue(2);
    service = new AuthTokenCleanupService(
      { removeExpired } as unknown as TokenBlacklistService,
      { removeStaleTokens } as unknown as PasswordResetService,
    );
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('cleans up on module init and then every hour', async () => {
    await service.onModuleInit();
    expect(removeExpired).toHaveBeenCalledTimes(1);
    expect(removeStaleTokens).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(HOUR);
    expect(removeExpired).toHaveBeenCalledTimes(2);
    expect(removeStaleTokens).toHaveBeenCalledTimes(2);
  });

  it('stops the hourly cleanup on module destroy', async () => {
    await service.onModuleInit();
    service.onModuleDestroy();

    await jest.advanceTimersByTimeAsync(3 * HOUR);
    expect(removeExpired).toHaveBeenCalledTimes(1);
  });

  it('logs failures instead of crashing', async () => {
    removeExpired.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(loggerError).toHaveBeenCalled();
    expect(removeStaleTokens).toHaveBeenCalledTimes(1);
  });
});
