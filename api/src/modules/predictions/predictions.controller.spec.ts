import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PredictionsController } from './predictions.controller';
import { PredictorClient } from './predictor.client';
import {
  PredictionSignatureService,
  sha256Hex,
} from './prediction-signature.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/users/user.types';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function upload(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'sample.png',
    mimetype: 'image/png',
    buffer: PNG_BYTES,
    size: PNG_BYTES.length,
    ...overrides,
  } as Express.Multer.File;
}

describe('PredictionsController', () => {
  let predict: jest.Mock;
  let signer: PredictionSignatureService;
  let controller: PredictionsController;

  beforeEach(() => {
    predict = jest.fn();
    signer = new PredictionSignatureService({
      get: () => 'unit-test-signing-secret',
    } as unknown as ConfigService);
    controller = new PredictionsController(
      { predict } as unknown as PredictorClient,
      signer,
    );
  });

  it('forwards the uploaded file to the predictor and returns its signed response', async () => {
    const body = {
      prediction: 'Nuclear Homogeneous',
      prediction_key: 'NUCLEAR_HOMOGENEOUS',
      confidence_percentage: 93.12,
      classification_level: 'competent',
    };
    predict.mockResolvedValueOnce(body);
    const file = upload();

    const imageSha256 = sha256Hex(PNG_BYTES);
    await expect(controller.analyze(file)).resolves.toEqual({
      ...body,
      imageSha256,
      signature: signer.sign(imageSha256, {
        predictionKey: 'NUCLEAR_HOMOGENEOUS',
        confidencePercentage: 93.12,
        classificationLevel: 'competent',
      }),
    });
    expect(predict).toHaveBeenCalledWith(file);
  });

  it('rejects a request without a file with 400', async () => {
    await expect(
      controller.analyze(undefined as unknown as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(predict).not.toHaveBeenCalled();
  });

  it('requires a JWT and the ADMIN or STANDARD role', () => {
    const guards: unknown = Reflect.getMetadata(
      GUARDS_METADATA,
      PredictionsController,
    );
    expect(guards).toEqual([PassportJwtAuthGuard, RolesGuard]);
    const roles: unknown = Reflect.getMetadata(
      ROLES_KEY,
      PredictionsController,
    );
    expect(roles).toEqual([UserRole.ADMIN, UserRole.STANDARD]);
  });
});
