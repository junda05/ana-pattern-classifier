import {
  BadGatewayException,
  BadRequestException,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PredictorClient } from './predictor.client';

// Eight-byte PNG signature: enough to exercise the multipart upload without a real image.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FILE = {
  buffer: PNG_BYTES,
  originalname: 'sample.png',
  mimetype: 'image/png',
};

const PREDICTION = {
  prediction: 'Nuclear homogeneous',
  prediction_key: 'NUCLEAR_HOMOGENEOUS',
  classification_level: 'competent',
  confidence: 0.91,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeConfig(values: Record<string, string> = {}): ConfigService {
  const env: Record<string, string> = {
    PREDICTOR_URL: 'http://predictor.test',
    PREDICTOR_API_KEY: 'test-key',
    PREDICTOR_TIMEOUT_MS: '5000',
    ...values,
  };
  return {
    get: (key: string, fallback?: unknown) =>
      key in env ? env[key] : fallback,
  } as unknown as ConfigService;
}

/** The error a promise rejects with; fails the test if it resolves. */
async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected the promise to reject');
}

describe('PredictorClient', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let sleep: jest.Mock<Promise<void>, [number]>;
  let client: PredictorClient;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    sleep = jest.fn<Promise<void>, [number]>().mockResolvedValue(undefined);
    client = new PredictorClient(makeConfig(), sleep);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the predictor JSON unchanged on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, PREDICTION));

    await expect(client.predict(FILE)).resolves.toEqual(PREDICTION);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('posts the file as multipart field "file" with the bearer API key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, PREDICTION));

    await client.predict(FILE);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://predictor.test/api/v1/predict');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer test-key' });
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const sent = form.get('file') as File;
    expect(sent).toBeInstanceOf(Blob);
    expect(sent.name).toBe('sample.png');
    expect(sent.type).toBe('image/png');
    expect(Buffer.from(await sent.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it('strips a trailing slash from PREDICTOR_URL', async () => {
    client = new PredictorClient(
      makeConfig({ PREDICTOR_URL: 'http://predictor.test/' }),
      sleep,
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(200, PREDICTION));

    await client.predict(FILE);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://predictor.test/api/v1/predict',
    );
  });

  it('maps 400 to BadRequestException with the predictor detail', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { detail: 'The file is empty' }),
    );

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('The file is empty');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps 413 to PayloadTooLargeException', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(413, { detail: 'The file exceeds 10 MB' }),
    );

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(PayloadTooLargeException);
    expect(error.message).toBe('The file exceeds 10 MB');
  });

  it('maps 415 to UnsupportedMediaTypeException', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(415, { detail: 'Unsupported image type' }),
    );

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
    expect(error.message).toBe('Unsupported image type');
  });

  it('uses a generic message when the predictor error has no detail', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 400 }));

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('Prediction failed');
  });

  it.each([401, 403])(
    'maps %i to 502 "Prediction service misconfigured" without retrying',
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(status, { detail: 'Invalid API key' }),
      );

      const error = await rejection(client.predict(FILE));
      expect(error).toBeInstanceOf(BadGatewayException);
      expect(error.message).toBe('Prediction service misconfigured');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('retries 503 with exponential backoff and resolves on the third call', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { detail: 'Busy' }))
      .mockResolvedValueOnce(jsonResponse(503, { detail: 'Busy' }))
      .mockResolvedValueOnce(jsonResponse(200, PREDICTION));

    await expect(client.predict(FILE)).resolves.toEqual(PREDICTION);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it.each([502, 504])(
    'retries %i as a transient gateway error',
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(status, {}))
        .mockResolvedValueOnce(jsonResponse(200, PREDICTION));

      await expect(client.predict(FILE)).resolves.toEqual(PREDICTION);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('returns 503 after three 503 responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { detail: 'Busy' }));

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toBe(
      'Prediction service unavailable, try again later',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-transient 500 and returns 503', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { detail: 'Internal error' }),
    );

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 503 after exactly three network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toBe(
      'Prediction service unavailable, try again later',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it('does not retry a timeout (the caller would give up first) and returns 503', async () => {
    const timeout = new DOMException(
      'The operation was aborted due to timeout',
      'TimeoutError',
    );
    fetchMock.mockRejectedValueOnce(timeout);

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps a 200 with a non-JSON body to 502', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));

    const error = await rejection(client.predict(FILE));
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toBe(
      'Prediction service returned an invalid response',
    );
  });
});
