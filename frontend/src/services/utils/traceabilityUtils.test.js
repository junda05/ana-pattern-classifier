import { buildTraceabilityQuery, fetchAllTraceabilityRecords } from './traceabilityUtils';
import traceabilityService from '../api/traceabilityService';

jest.mock('../api/traceabilityService', () => ({
  __esModule: true,
  default: { getRecords: jest.fn() },
}));

const row = (id) => ({ traceabilityId: id, userFullName: `User ${id}`, dateAndHour: '2026-09-24T13:55:00.000Z', activityType: 'CREATE' });

describe('buildTraceabilityQuery', () => {
  it('turns the chosen days into local-day bounds: start of the first day to the next local midnight after the last', () => {
    expect(buildTraceabilityQuery({ dateFrom: '2026-09-24', dateTo: '2026-09-25' })).toEqual({
      from: new Date(2026, 8, 24).toISOString(),
      to: new Date(2026, 8, 26).toISOString(),
    });
  });

  it('rolls the exclusive end over month and year boundaries', () => {
    expect(buildTraceabilityQuery({ dateTo: '2026-12-31' })).toEqual({ to: new Date(2027, 0, 1).toISOString() });
  });

  it('sends the trimmed user name and the activity type, and leaves blank filters out', () => {
    expect(buildTraceabilityQuery({ userName: '  Jane ', activityType: 'UPDATE', dateFrom: '', dateTo: '' })).toEqual({
      userName: 'Jane',
      activityType: 'UPDATE',
    });
    expect(buildTraceabilityQuery({ userName: '   ', activityType: '' })).toEqual({});
  });
});

describe('fetchAllTraceabilityRecords', () => {
  beforeEach(() => {
    traceabilityService.getRecords.mockReset();
  });

  it('pages through every result with the same filters, 100 at a time, reporting progress', async () => {
    traceabilityService.getRecords
      .mockResolvedValueOnce({ data: [row(1), row(2)], total: 3, page: 1, limit: 100, totalPages: 2 })
      .mockResolvedValueOnce({ data: [row(3)], total: 3, page: 2, limit: 100, totalPages: 2 });
    const onProgress = jest.fn();

    const records = await fetchAllTraceabilityRecords({ userName: 'Jane' }, onProgress);

    expect(records.map((record) => record.id)).toEqual([1, 2, 3]);
    expect(traceabilityService.getRecords.mock.calls).toEqual([
      [{ userName: 'Jane', page: 1, limit: 100 }],
      [{ userName: 'Jane', page: 2, limit: 100 }],
    ]);
    expect(onProgress).toHaveBeenLastCalledWith({ loaded: 3, total: 3 });
  });

  it('stops at an empty page', async () => {
    traceabilityService.getRecords.mockResolvedValue({ data: [], total: 500, page: 1, limit: 100, totalPages: 5 });

    await expect(fetchAllTraceabilityRecords({})).resolves.toEqual([]);
    expect(traceabilityService.getRecords).toHaveBeenCalledTimes(1);
  });

  it('fails when a page cannot be loaded', async () => {
    traceabilityService.getRecords
      .mockResolvedValueOnce({ data: [row(1)], total: 2, page: 1, limit: 100, totalPages: 2 })
      .mockRejectedValueOnce(new Error('Network Error'));

    await expect(fetchAllTraceabilityRecords({})).rejects.toThrow('Network Error');
  });
});
