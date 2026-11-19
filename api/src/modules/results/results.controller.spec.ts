import { BadRequestException } from '@nestjs/common';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { CreateBatchResultsWithCorrectionsDto } from '../../DTOs/results/create-batch-results-with-corrections.dto';
import { AddPredictionsToResultDto } from '../../DTOs/results/add-predictions-to-result.dto';
import { UserRole } from '../../entities/users/user.types';
import { ResultStatus } from '../../entities/results/result.types';
import { PaginationQueryDto } from '../../DTOs/results/pagination-query.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

const image = (name: string) =>
  ({
    originalname: name,
    mimetype: 'image/png',
    size: 1,
    buffer: Buffer.from([0]),
  }) as Express.Multer.File;

const request = {
  user: { userId: 42, username: 'jdoe', role: UserRole.STANDARD },
} as unknown as AuthenticatedRequest;

const validBatch = {
  patientId: 1,
  predictions: [
    {
      prediction: 'NUCLEAR_HOMOGENEOUS',
      confidencePercentage: 87.5,
      classificationLevel: 'competent',
      signature: 'signature-from-analyze',
      dilution: '80',
    },
    {
      prediction: 'NUCLEOLAR_CLUMPY',
      confidencePercentage: 76.1,
      classificationLevel: 'competent',
      signature: 'signature-from-analyze',
      dilution: '160',
    },
  ],
  corrections: [{ imageIndex: 1, correctedPrediction: 'NUCLEAR_SPECKLED' }],
  observations: 'Routine screening',
};

async function badRequestMessages(
  promise: Promise<unknown>,
): Promise<string[]> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as {
      message: string | string[];
    };
    return Array.isArray(body.message) ? body.message : [body.message];
  }
  throw new Error('Expected a BadRequestException');
}

describe('ResultsController multipart endpoints', () => {
  let service: jest.Mocked<
    Pick<ResultsService, 'createBatchWithFiles' | 'addPredictionsToResult'>
  >;
  let controller: ResultsController;

  beforeEach(() => {
    service = {
      createBatchWithFiles: jest.fn().mockResolvedValue({ resultId: 5 }),
      addPredictionsToResult: jest.fn().mockResolvedValue({ resultId: 5 }),
    };
    controller = new ResultsController(service as unknown as ResultsService);
  });

  describe('POST /results/batch/with-files', () => {
    const images = [image('a.png'), image('b.png')];

    it('passes a validated DTO and the JWT user to the service', async () => {
      await controller.createBatchWithFiles(
        images,
        JSON.stringify(validBatch),
        request,
      );

      expect(service.createBatchWithFiles).toHaveBeenCalledTimes(1);
      const [dto, files, userId] = service.createBatchWithFiles.mock.calls[0];
      expect(dto).toBeInstanceOf(CreateBatchResultsWithCorrectionsDto);
      expect(dto).not.toHaveProperty('userId');
      expect(files).toBe(images);
      expect(userId).toBe(42);
    });

    it('rejects a userId in the payload (the user always comes from the token)', async () => {
      const messages = await badRequestMessages(
        controller.createBatchWithFiles(
          images,
          JSON.stringify({ ...validBatch, userId: 7 }),
          request,
        ),
      );

      expect(messages).toContain('property userId should not exist');
      expect(service.createBatchWithFiles).not.toHaveBeenCalled();
    });

    it('rejects invalid JSON', async () => {
      expect(
        await badRequestMessages(
          controller.createBatchWithFiles(images, '{"patientId":', request),
        ),
      ).toEqual(['The "data" field must be valid JSON.']);
      expect(service.createBatchWithFiles).not.toHaveBeenCalled();
    });

    it('rejects a missing patientId', async () => {
      const withoutPatient: Partial<typeof validBatch> = { ...validBatch };
      delete withoutPatient.patientId;
      const messages = await badRequestMessages(
        controller.createBatchWithFiles(
          images,
          JSON.stringify(withoutPatient),
          request,
        ),
      );

      expect(messages).toContain('Patient ID is required.');
    });

    it('rejects a prediction class that is not a PredictionClass key', async () => {
      const data = {
        ...validBatch,
        predictions: [
          {
            prediction: 'Nucleolar Clumpy',
            confidencePercentage: 76.1,
            classificationLevel: 'competent',
            signature: 'signature-from-analyze',
            dilution: '80',
          },
          validBatch.predictions[1],
        ],
      };

      const messages = await badRequestMessages(
        controller.createBatchWithFiles(images, JSON.stringify(data), request),
      );

      expect(messages).toEqual([
        'predictions[0]: Invalid prediction. It must be one of the valid ICAP classes.',
      ]);
    });

    it('rejects an unknown dilution and a negative image index', async () => {
      const data = {
        ...validBatch,
        predictions: [
          { ...validBatch.predictions[0], dilution: '100' },
          validBatch.predictions[1],
        ],
        corrections: [
          { imageIndex: -1, correctedPrediction: 'NUCLEAR_SPECKLED' },
        ],
      };

      const messages = await badRequestMessages(
        controller.createBatchWithFiles(images, JSON.stringify(data), request),
      );

      expect(messages).toEqual(
        expect.arrayContaining([
          'predictions[0]: Invalid dilution. It must be one of: 80, 160, 320, 640, 1280 or 2560.',
          'corrections[0]: Image index must be greater than or equal to 0.',
        ]),
      );
    });

    it('rejects CORRECTED as a requested status (it is derived from corrections)', async () => {
      const messages = await badRequestMessages(
        controller.createBatchWithFiles(
          images,
          JSON.stringify({
            ...validBatch,
            corrections: undefined,
            status: 'CORRECTED',
          }),
          request,
        ),
      );

      expect(messages).toEqual([
        'Status must be PENDING or VERIFIED; CORRECTED is set automatically when corrections are sent.',
      ]);
    });

    it('accepts empty observations', async () => {
      await controller.createBatchWithFiles(
        images,
        JSON.stringify({ ...validBatch, observations: '' }),
        request,
      );

      expect(service.createBatchWithFiles).toHaveBeenCalled();
    });

    it('requires at least one image', async () => {
      expect(
        await badRequestMessages(
          controller.createBatchWithFiles(
            [],
            JSON.stringify(validBatch),
            request,
          ),
        ),
      ).toEqual(['Provide at least one image.']);
    });
  });

  describe('POST /results/:id/predictions/with-files', () => {
    const images = [image('c.png')];
    const validAppend = {
      newPredictions: [
        {
          prediction: 'NUCLEAR_SPECKLED',
          confidencePercentage: 66,
          classificationLevel: 'competent',
          signature: 'signature-from-analyze',
          dilution: '320',
        },
      ],
      updatedDilutions: [{ predictionId: 3, dilution: '640' }],
      status: 'VERIFIED',
    };

    it('passes a validated DTO, the JWT user and role to the service', async () => {
      await controller.addPredictionsToResult(
        5,
        images,
        JSON.stringify(validAppend),
        request,
      );

      const [resultId, dto, files, userId, role] =
        service.addPredictionsToResult.mock.calls[0];
      expect(resultId).toBe(5);
      expect(dto).toBeInstanceOf(AddPredictionsToResultDto);
      expect(files).toBe(images);
      expect(userId).toBe(42);
      expect(role).toBe(UserRole.STANDARD);
    });

    it('rejects undeclared properties and a CORRECTED status', async () => {
      const messages = await badRequestMessages(
        controller.addPredictionsToResult(
          5,
          images,
          JSON.stringify({ ...validAppend, status: 'CORRECTED', userId: 2 }),
          request,
        ),
      );

      expect(messages).toEqual(
        expect.arrayContaining([
          'property userId should not exist',
          'Status must be PENDING or VERIFIED; CORRECTED is set automatically when corrections are sent.',
        ]),
      );
      expect(service.addPredictionsToResult).not.toHaveBeenCalled();
    });

    it('accepts corrections without images (no multipart files)', async () => {
      const body = {
        existingCorrections: [
          { predictionId: 3, correctedPrediction: 'NUCLEAR_SPECKLED' },
        ],
        corrections: [],
        observations: '',
      };

      await controller.addPredictionsToResult(
        5,
        undefined as unknown as Express.Multer.File[],
        JSON.stringify(body),
        request,
      );

      const [, dto, files] = service.addPredictionsToResult.mock.calls[0];
      expect(files).toEqual([]);
      expect(dto.existingCorrections).toHaveLength(1);
      expect(dto.observations).toBeNull();
    });

    it('rejects a missing data field', async () => {
      expect(
        await badRequestMessages(
          controller.addPredictionsToResult(5, images, undefined, request),
        ),
      ).toEqual(['The "data" field is required.']);
    });
  });
});

describe('ResultsController GET /results', () => {
  it('passes the search text with the filters and the JWT user to the service', async () => {
    const service = {
      findAllPaginated: jest.fn().mockResolvedValue({ data: [] }),
    };
    const controller = new ResultsController(
      service as unknown as ResultsService,
    );

    await controller.findAll(
      { page: 2, limit: 5, status: ResultStatus.PENDING, search: 'roe' },
      request,
    );

    expect(service.findAllPaginated).toHaveBeenCalledWith(
      2,
      5,
      ResultStatus.PENDING,
      42,
      UserRole.STANDARD,
      'roe',
    );
  });

  it('validates the search length', async () => {
    const query = plainToInstance(PaginationQueryDto, {
      search: 'x'.repeat(101),
    });

    const errors = await validate(query);

    expect(errors.flatMap((e) => Object.values(e.constraints ?? {}))).toEqual([
      'Search must be at most 100 characters long.',
    ]);
  });
});
