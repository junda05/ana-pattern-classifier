import resultsService from './resultsService';
import axiosClient from '../../config/axios';

jest.mock('../../config/axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

const png = (name) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
const signed = { prediction: 'NEGATIVE', confidencePercentage: 90, classificationLevel: 'competent', signature: 's', dilution: '80' };

describe('resultsService.addPredictionsToResult', () => {
  beforeEach(() => {
    axiosClient.post.mockReset();
    axiosClient.post.mockResolvedValue({ data: { resultId: 42, addedPredictionIds: [] } });
  });

  it('sends a change without new images as a multipart request with only the data field', async () => {
    await resultsService.addPredictionsToResult(42, { observations: null, status: 'VERIFIED' }, []);

    const [url, formData] = axiosClient.post.mock.calls[0];
    expect(url).toBe('/results/42/predictions/with-files');
    expect(formData.getAll('images')).toHaveLength(0);
    expect(JSON.parse(formData.get('data'))).toEqual({ observations: null, status: 'VERIFIED' });
  });

  it('sends one file per new prediction, in order', async () => {
    await resultsService.addPredictionsToResult(42, { newPredictions: [signed, signed] }, [png('a.png'), png('b.png')]);

    const [, formData] = axiosClient.post.mock.calls[0];
    expect(formData.getAll('images').map((file) => file.name)).toEqual(['a.png', 'b.png']);
  });

  it('rejects files that do not match the new predictions', async () => {
    await expect(resultsService.addPredictionsToResult(42, { observations: 'x' }, [png('a.png')]))
      .rejects.toThrow('The number of images (1) must match the number of new predictions (0).');
    expect(axiosClient.post).not.toHaveBeenCalled();
  });
});

describe('resultsService.getResults', () => {
  beforeEach(() => {
    axiosClient.get.mockReset();
    axiosClient.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 5, totalPages: 0 } });
  });

  it('sends the patient search to the API', async () => {
    await resultsService.getResults({ page: 1, limit: 5, status: 'PENDING', search: '  Jane  ' });

    expect(axiosClient.get).toHaveBeenCalledWith('/results', { params: { page: 1, limit: 5, status: 'PENDING', search: 'Jane' } });
  });

  it('leaves a blank search out', async () => {
    await resultsService.getResults({ page: 2, limit: 5, search: '   ' });

    expect(axiosClient.get).toHaveBeenCalledWith('/results', { params: { page: 2, limit: 5 } });
  });
});
