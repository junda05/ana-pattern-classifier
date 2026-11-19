/**
 * Predictions module
 *
 * Proxies image analysis to the prediction service so the predictor API key
 * stays on the server (PREDICTOR_URL, PREDICTOR_API_KEY, PREDICTOR_TIMEOUT_MS),
 * and signs every analysis (PREDICTION_SIGNING_SECRET) so the results
 * endpoints only accept predictions the model produced for that image.
 */

import { Module } from '@nestjs/common';
import { PredictionsController } from './predictions.controller';
import { PredictorClient } from './predictor.client';
import { PredictionSignatureService } from './prediction-signature.service';

@Module({
  controllers: [PredictionsController],
  providers: [PredictorClient, PredictionSignatureService],
  exports: [PredictorClient, PredictionSignatureService],
})
export class PredictionsModule {}
