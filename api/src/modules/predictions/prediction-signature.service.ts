/**
 * Trusted predictions: HMAC signatures that bind a prediction to its image.
 *
 * POST /predictions/analyze adds two fields to the predictor response:
 * - imageSha256: lowercase hex SHA-256 of the analyzed image bytes
 * - signature: base64url (no padding) HMAC-SHA256, keyed with
 *   PREDICTION_SIGNING_SECRET, of the string
 *   `${imageSha256}|${prediction_key}|${confidence_percentage}|${classification_level}`
 *   (numbers rendered as JavaScript renders them, e.g. 93.12 or 88;
 *   classification_level is "general" when the predictor omits it)
 *
 * The batch endpoints (POST /results/batch/with-files and
 * POST /results/:id/predictions/with-files) send back, per prediction,
 * prediction (= prediction_key), confidencePercentage, classificationLevel and
 * signature. The API recomputes the SHA-256 of the uploaded image at the same
 * index and verifies the signature with a constant-time compare, so a client
 * cannot save a class, confidence or level the model did not produce for that
 * exact image. Failure: 400 "Prediction signature is invalid for image N."
 * (N counts from 1, in upload order).
 *
 * The API refuses to start without PREDICTION_SIGNING_SECRET.
 */

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { ClassificationLevel } from '../../entities/predictions/prediction.types';

/** The values covered by a signature (besides the image hash). */
export interface SignedFields {
  predictionKey: string;
  confidencePercentage: number;
  classificationLevel: string;
}

/** A prediction item as submitted to the batch endpoints. */
export interface SignedPredictionInput {
  prediction: string;
  confidencePercentage: number;
  classificationLevel: string;
  signature: string;
}

/** Predictor response plus the fields added by the API. */
export type SignedAnalysis = Record<string, unknown> & {
  classification_level: string;
  imageSha256: string;
  signature: string;
};

/** Lowercase hex SHA-256 of the bytes. */
export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

@Injectable()
export class PredictionSignatureService {
  private readonly logger = new Logger(PredictionSignatureService.name);
  private readonly secret: string;

  constructor(config: ConfigService) {
    const secret = config.get<string>('PREDICTION_SIGNING_SECRET')?.trim();
    if (!secret) {
      throw new Error('PREDICTION_SIGNING_SECRET is not set.');
    }
    this.secret = secret;
  }

  /** base64url HMAC-SHA256 of `${imageSha256}|${key}|${confidence}|${level}`. */
  sign(imageSha256: string, fields: SignedFields): string {
    const message = [
      imageSha256,
      fields.predictionKey,
      String(fields.confidencePercentage),
      fields.classificationLevel,
    ].join('|');
    return createHmac('sha256', this.secret)
      .update(message)
      .digest('base64url');
  }

  /**
   * Adds imageSha256 and signature to a predictor response.
   * @throws BadGatewayException when the response lacks a usable
   *   prediction_key, confidence_percentage or classification_level
   */
  signAnalysis(
    image: Buffer,
    response: Record<string, unknown>,
  ): SignedAnalysis {
    const {
      prediction_key: predictionKey,
      confidence_percentage: confidencePercentage,
      classification_level: level = ClassificationLevel.GENERAL,
    } = response;
    if (
      typeof predictionKey !== 'string' ||
      !predictionKey ||
      typeof confidencePercentage !== 'number' ||
      !Number.isFinite(confidencePercentage) ||
      typeof level !== 'string'
    ) {
      this.logger.error(
        'Prediction service response has no usable prediction_key, confidence_percentage or classification_level',
      );
      throw new BadGatewayException(
        'Prediction service returned an invalid response',
      );
    }

    const imageSha256 = sha256Hex(image);
    return {
      ...response,
      classification_level: level,
      imageSha256,
      signature: this.sign(imageSha256, {
        predictionKey,
        confidencePercentage,
        classificationLevel: level,
      }),
    };
  }

  /**
   * Verifies every prediction against the image uploaded at the same index.
   * @throws BadRequestException "Prediction signature is invalid for image N."
   */
  assertValid(
    images: ReadonlyArray<{ buffer: Buffer }>,
    predictions: readonly SignedPredictionInput[],
  ): void {
    predictions.forEach((prediction, index) => {
      const image = images[index];
      if (!image || !this.isValid(image.buffer, prediction)) {
        throw new BadRequestException(
          `Prediction signature is invalid for image ${index + 1}.`,
        );
      }
    });
  }

  private isValid(image: Buffer, prediction: SignedPredictionInput): boolean {
    if (typeof prediction.signature !== 'string') {
      return false;
    }
    const expected = Buffer.from(
      this.sign(sha256Hex(image), {
        predictionKey: prediction.prediction,
        confidencePercentage: prediction.confidencePercentage,
        classificationLevel: prediction.classificationLevel,
      }),
    );
    const given = Buffer.from(prediction.signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
