import axiosClient from '../../config/axios';
import { predictImages, PREDICTION_UNAVAILABLE_MESSAGE } from './predictionService';

jest.mock('../../config/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

// Tiny in-memory stand-in for an image (PNG signature bytes only; never a real image).
const pngFile = (name = 'a.png') =>
  new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

const predictorResponse = (overrides = {}) => ({
  filename: 'a.png',
  prediction: 'Nuclear Homogeneous',
  prediction_key: 'NUCLEAR_HOMOGENEOUS',
  confidence: 0.9234,
  confidence_percentage: 92.34,
  class_probabilities: { NUCLEAR_HOMOGENEOUS: 0.9234 },
  patch_statistics: { total_patches: 4 },
  classification_level: 'competent',
  note: '',
  status: 'success',
  ...overrides,
});

const httpError = (status, data = {}) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  return error;
};

describe('predictImages', () => {
  it('posts each image to the API proxy as the multipart field "file"', async () => {
    axiosClient.post.mockResolvedValue({ data: predictorResponse() });

    await predictImages([{ id: 'img-1', file: pngFile('a.png') }]);

    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = axiosClient.post.mock.calls[0];
    expect(url).toBe('/predictions/analyze');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file').name).toBe('a.png');
    expect(config.timeout).toBe(120000);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('returns the class key, level and confidence for each image, keyed by its id', async () => {
    axiosClient.post.mockResolvedValue({ data: predictorResponse() });

    const [result] = await predictImages([{ id: 'img-1', file: pngFile('a.png') }]);

    expect(result).toMatchObject({
      id: 'img-1',
      fileName: 'a.png',
      error: false,
      predictionKey: 'NUCLEAR_HOMOGENEOUS',
      classificationLevel: 'competent',
      confidence: 92.34,
      formattedPattern: 'AC-1 Nuclear Homogeneous',
    });
  });

  it('keeps the image hash and the prediction signature issued by the API', async () => {
    axiosClient.post.mockResolvedValue({
      data: predictorResponse({ imageSha256: 'a'.repeat(64), signature: 'signed-by-api' }),
    });

    const [result] = await predictImages([{ id: 'img-1', file: pngFile('a.png') }]);

    expect(result).toMatchObject({ id: 'img-1', imageSha256: 'a'.repeat(64), signature: 'signed-by-api' });
  });

  it('leaves the signature empty when the API does not send one', async () => {
    axiosClient.post.mockResolvedValue({ data: predictorResponse() });

    const [result] = await predictImages([{ id: 'img-1', file: pngFile('a.png') }]);

    expect(result.error).toBe(false);
    expect(result.signature).toBeNull();
  });

  it('fails an image whose response has no confidence_percentage, since it cannot be signed', async () => {
    axiosClient.post.mockResolvedValue({ data: predictorResponse({ confidence_percentage: undefined }) });

    const [result] = await predictImages([{ id: 'img-1', file: pngFile('a.png') }]);

    expect(result).toMatchObject({ id: 'img-1', error: true });
  });

  it('uses prediction_key as the class key instead of reverse-mapping the display name', async () => {
    axiosClient.post.mockResolvedValue({
      data: predictorResponse({
        prediction: 'Mitotic NuMA-like',
        prediction_key: 'MITOTIC_NUMA',
        classification_level: 'expert',
      }),
    });

    const [result] = await predictImages([{ id: 'img-1', file: pngFile() }]);

    expect(result.predictionKey).toBe('MITOTIC_NUMA');
    expect(result.formattedPattern).toBe('AC-26 Mitotic NuMA-like');
  });

  it('marks an image as failed when the response carries an unknown class key', async () => {
    axiosClient.post.mockResolvedValue({
      data: predictorResponse({ prediction_key: 'SOMETHING_ELSE' }),
    });

    const [result] = await predictImages([{ id: 'img-1', file: pngFile() }]);

    expect(result.error).toBe(true);
    expect(result.predictionKey).toBeUndefined();
  });

  it.each([502, 503, 504])('maps a %i from the API to the friendly unavailable message', async (status) => {
    axiosClient.post.mockRejectedValue(
      httpError(status, { statusCode: status, message: 'Prediction service unavailable, try again later' })
    );

    const [result] = await predictImages([{ id: 'img-1', file: pngFile() }]);

    expect(result.error).toBe(true);
    expect(result.errorMessage).toBe(PREDICTION_UNAVAILABLE_MESSAGE);
    expect(PREDICTION_UNAVAILABLE_MESSAGE).toBe(
      'The prediction service is unavailable. Please try again in a moment.'
    );
  });

  it.each([
    [400, 'The file is empty'],
    [413, 'The image is larger than 10 MB'],
  ])('shows the API message for a %i', async (status, message) => {
    axiosClient.post.mockRejectedValue(httpError(status, { statusCode: status, message, error: 'Bad Request' }));

    const [result] = await predictImages([{ id: 'img-1', file: pngFile() }]);

    expect(result.error).toBe(true);
    expect(result.errorMessage).toBe(message);
  });

  it('reports a failed image without failing the rest of the batch', async () => {
    axiosClient.post
      .mockResolvedValueOnce({ data: predictorResponse() })
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce({ data: predictorResponse({ prediction_key: 'NEGATIVE', classification_level: 'general' }) });

    const results = await predictImages([
      { id: 'a', file: pngFile('a.png') },
      { id: 'b', file: pngFile('b.png') },
      { id: 'c', file: pngFile('c.png') },
    ]);

    expect(results.map((r) => [r.id, r.error])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ]);
    expect(results[2].predictionKey).toBe('NEGATIVE');
  });
});
