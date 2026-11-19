import traceabilityService from './traceabilityService';
import axiosClient from '../../config/axios';

jest.mock('../../config/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

describe('traceabilityService.getRecords', () => {
  beforeEach(() => {
    axiosClient.get.mockReset();
    axiosClient.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 10, totalPages: 0 } });
  });

  it('sends the server-side filters', async () => {
    await traceabilityService.getRecords({
      page: 2,
      limit: 100,
      from: '2026-09-24T05:00:00.000Z',
      to: '2026-09-25T05:00:00.000Z',
      userName: 'Jane',
      activityType: 'UPDATE',
    });

    expect(axiosClient.get).toHaveBeenCalledWith('/traceability', {
      params: { page: 2, limit: 100, from: '2026-09-24T05:00:00.000Z', to: '2026-09-25T05:00:00.000Z', userName: 'Jane', activityType: 'UPDATE' },
    });
  });

  it('sends only paging when there are no filters', async () => {
    await traceabilityService.getRecords({ page: 1, limit: 10 });

    expect(axiosClient.get).toHaveBeenCalledWith('/traceability', { params: { page: 1, limit: 10 } });
  });
});
