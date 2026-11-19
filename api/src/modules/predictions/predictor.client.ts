/**
 * HTTP client for the prediction service (FastAPI).
 *
 * The browser never talks to the predictor directly: the API forwards the
 * uploaded image with its own server-side API key, so the key is never
 * shipped to the client.
 *
 * Behaviour:
 * - POST {PREDICTOR_URL}/api/v1/predict with multipart field "file" and
 *   "Authorization: Bearer {PREDICTOR_API_KEY}".
 * - Each attempt is bounded by PREDICTOR_TIMEOUT_MS (default 60000 ms).
 * - Transient failures (network errors, 502, 503, 504) are retried at most
 *   twice with exponential backoff (500 ms, 1000 ms). Timeouts are not
 *   retried: the predictor is busy and the caller would give up first.
 * - Predictor errors are mapped to the API's error taxonomy:
 *   400 → 400, 413 → 413, 415 → 415 (with the predictor's detail);
 *   401/403 → 502 "Prediction service misconfigured" (bad server-side key);
 *   anything else after retries → 503 "Prediction service unavailable".
 * - A successful response is returned unchanged.
 */

import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Injection token for the backoff delay function (overridable in tests). */
export const PREDICTOR_SLEEP = 'PREDICTOR_SLEEP';

export type SleepFn = (ms: number) => Promise<void>;

/** The subset of an uploaded file the client needs. */
export interface PredictorUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/** Predictor response body, passed through unchanged. */
export type PredictorResponse = Record<string, unknown>;

const UNAVAILABLE_MESSAGE = 'Prediction service unavailable, try again later';
const MISCONFIGURED_MESSAGE = 'Prediction service misconfigured';
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class PredictorClient {
  private readonly logger = new Logger(PredictorClient.name);
  private static readonly RETRYABLE_STATUSES = new Set([502, 503, 504]);

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(PREDICTOR_SLEEP)
    private readonly sleep: SleepFn = defaultSleep,
  ) {}

  async predict(file: PredictorUpload): Promise<PredictorResponse> {
    const baseUrl = this.config
      .get<string>('PREDICTOR_URL', 'http://localhost:8000')
      .replace(/\/+$/, '');
    const apiKey = this.config.get<string>('PREDICTOR_API_KEY', '');
    const timeoutMs = this.timeoutMs();

    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/v1/predict`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: this.buildForm(file),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const err = error as Error;
        if (err.name === 'TimeoutError') {
          this.logger.error(
            `Prediction service timed out after ${timeoutMs} ms`,
          );
          throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
        }
        if (attempt < MAX_RETRIES) {
          this.logger.warn(
            `Prediction service unreachable (attempt ${attempt + 1}): ${err.message}`,
          );
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
          continue;
        }
        this.logger.error(`Prediction service unreachable: ${err.message}`);
        throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
      }

      if (response.ok) {
        return this.parseSuccess(response);
      }

      if (
        PredictorClient.RETRYABLE_STATUSES.has(response.status) &&
        attempt < MAX_RETRIES
      ) {
        this.logger.warn(
          `Prediction service returned ${response.status} (attempt ${attempt + 1}); retrying`,
        );
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
        continue;
      }

      throw await this.toHttpException(response);
    }
  }

  private buildForm(file: PredictorUpload): FormData {
    const form = new FormData();
    // Copy into a plain Uint8Array: Blob requires an ArrayBuffer-backed view.
    const bytes = new Uint8Array(file.buffer);
    form.append(
      'file',
      new Blob([bytes], { type: file.mimetype }),
      file.originalname,
    );
    return form;
  }

  private timeoutMs(): number {
    const configured = Number(
      this.config.get('PREDICTOR_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_TIMEOUT_MS;
  }

  private async parseSuccess(response: Response): Promise<PredictorResponse> {
    try {
      return (await response.json()) as PredictorResponse;
    } catch (error) {
      this.logger.error(
        `Prediction service returned a non-JSON body: ${(error as Error).message}`,
      );
      throw new BadGatewayException(
        'Prediction service returned an invalid response',
      );
    }
  }

  private async toHttpException(response: Response): Promise<HttpException> {
    const body: unknown = await response.json().catch(() => ({}));
    const rawDetail = (body as { detail?: unknown } | null)?.detail;
    const detail =
      typeof rawDetail === 'string' && rawDetail
        ? rawDetail
        : 'Prediction failed';

    switch (response.status) {
      case 400:
        return new BadRequestException(detail);
      case 413:
        return new PayloadTooLargeException(detail);
      case 415:
        return new UnsupportedMediaTypeException(detail);
      case 401:
      case 403:
        this.logger.error(
          'Prediction service rejected the API key (check PREDICTOR_API_KEY)',
        );
        return new BadGatewayException(MISCONFIGURED_MESSAGE);
      default:
        this.logger.error(
          `Prediction service error ${response.status}: ${detail}`,
        );
        return new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }
}
