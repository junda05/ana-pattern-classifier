/**
 * Detail of a single prediction
 *
 * Fields:
 * - predictionId: ID of the prediction
 * - prediction: predicted class
 * - confidencePercentage: prediction confidence
 * - imagePath: stored file name (as saved in the database)
 * - imageUrl: absolute URL of the image (generated automatically)
 * - dilution: sample dilution
 *
 * The image URL is built with the shared API base URL helper
 * (API_BASE_URL, default http://localhost:8001).
 */

import { Exclude, Expose, Transform } from 'class-transformer';
import { Dilution } from '../../entities/predictions/prediction.types';
import { predictionImageUrl } from '../../config/api-base-url';

@Exclude()
export class PredictionDetailDto {
  @Expose()
  predictionId: number;

  @Expose()
  prediction: string;

  @Expose()
  confidencePercentage: number;

  @Expose()
  imagePath: string;

  /**
   * Absolute URL of the image, derived from imagePath.
   * Example: http://localhost:8001/api/v1/files/predictions/uuid-123-image.jpg
   */
  @Expose()
  @Transform(
    ({ obj }: { obj: Pick<PredictionDetailDto, 'imagePath'> }) =>
      predictionImageUrl(obj.imagePath) ?? null,
  )
  imageUrl: string | null;

  @Expose()
  dilution: Dilution;
}
