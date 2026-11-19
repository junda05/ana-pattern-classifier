import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PredictionSignatureService,
  SignedPredictionInput,
  sha256Hex,
} from './prediction-signature.service';

const SECRET = 'unit-test-signing-secret';
const IMAGE_A = Buffer.from('synthetic-image-bytes');
const IMAGE_B = Buffer.from('another-synthetic-image');

/** Fixed vector: HMAC-SHA256(SECRET, `${sha256(IMAGE_A)}|NUCLEAR_HOMOGENEOUS|93.12|competent`). */
const IMAGE_A_SHA256 =
  'ea154f2b845db9cf192c94024a7883180edb89a64dbfab16e4109619c43750a2';
const IMAGE_A_SIGNATURE = 'ayI_iQ5DPmuPtFrgoFdmRSFzllKvrWaPmDjs09fgHPc';

function service(secret = SECRET) {
  return new PredictionSignatureService({
    get: (key: string) =>
      key === 'PREDICTION_SIGNING_SECRET' ? secret : undefined,
  } as unknown as ConfigService);
}

/** What /predictions/analyze answers for an image (fake predictor output). */
function analyze(signer: PredictionSignatureService, image: Buffer) {
  return signer.signAnalysis(image, {
    prediction: 'Nuclear Homogeneous',
    prediction_key: 'NUCLEAR_HOMOGENEOUS',
    confidence_percentage: 93.12,
    classification_level: 'competent',
  });
}

/** The prediction item a client sends back for an analyzed image. */
function submitted(
  analysis: Record<string, unknown>,
  overrides: Partial<SignedPredictionInput> = {},
): SignedPredictionInput {
  return {
    prediction: analysis.prediction_key as string,
    confidencePercentage: analysis.confidence_percentage as number,
    classificationLevel: analysis.classification_level as string,
    signature: analysis.signature as string,
    ...overrides,
  };
}

describe('sha256Hex', () => {
  it('returns the lowercase hex SHA-256 of the bytes', () => {
    expect(sha256Hex(IMAGE_A)).toBe(IMAGE_A_SHA256);
  });
});

describe('PredictionSignatureService', () => {
  it('refuses to start without PREDICTION_SIGNING_SECRET', () => {
    for (const secret of [undefined, '', '  ']) {
      const config = { get: () => secret } as unknown as ConfigService;
      expect(() => new PredictionSignatureService(config)).toThrow(
        'PREDICTION_SIGNING_SECRET is not set.',
      );
    }
  });

  it('signs `${imageSha256}|${prediction_key}|${confidence_percentage}|${classification_level}` with HMAC-SHA256 (base64url)', () => {
    expect(
      service().sign(IMAGE_A_SHA256, {
        predictionKey: 'NUCLEAR_HOMOGENEOUS',
        confidencePercentage: 93.12,
        classificationLevel: 'competent',
      }),
    ).toBe(IMAGE_A_SIGNATURE);
  });

  describe('signAnalysis', () => {
    it('adds imageSha256 and signature to the predictor response', () => {
      const analysis = analyze(service(), IMAGE_A);

      expect(analysis).toMatchObject({
        prediction: 'Nuclear Homogeneous',
        prediction_key: 'NUCLEAR_HOMOGENEOUS',
        confidence_percentage: 93.12,
        classification_level: 'competent',
        imageSha256: IMAGE_A_SHA256,
        signature: IMAGE_A_SIGNATURE,
      });
    });

    it('signs the general level when the predictor omits it (legacy mode)', () => {
      const signer = service();
      const analysis = signer.signAnalysis(IMAGE_A, {
        prediction_key: 'NUCLEAR',
        confidence_percentage: 88,
      });

      expect(analysis.classification_level).toBe('general');
      expect(analysis.signature).toBe(
        signer.sign(IMAGE_A_SHA256, {
          predictionKey: 'NUCLEAR',
          confidencePercentage: 88,
          classificationLevel: 'general',
        }),
      );
    });

    it.each([
      ['no prediction_key', { confidence_percentage: 90 }],
      [
        'a non-numeric confidence',
        { prediction_key: 'NUCLEAR', confidence_percentage: '90' },
      ],
      [
        'a non-string level',
        {
          prediction_key: 'NUCLEAR',
          confidence_percentage: 90,
          classification_level: 2,
        },
      ],
    ])('rejects a predictor response with %s (502)', (_case, response) => {
      expect(() => service().signAnalysis(IMAGE_A, response)).toThrow(
        BadGatewayException,
      );
    });
  });

  describe('assertValid', () => {
    const signer = service();
    const analysisA = analyze(signer, IMAGE_A);
    const analysisB = signer.signAnalysis(IMAGE_B, {
      prediction_key: 'MITOTIC_NUMA',
      confidence_percentage: 71.5,
      classification_level: 'expert',
    });
    const images = [{ buffer: IMAGE_A }, { buffer: IMAGE_B }];

    function rejection(
      files: Array<{ buffer: Buffer }>,
      predictions: SignedPredictionInput[],
    ): unknown {
      try {
        signer.assertValid(files, predictions);
      } catch (error) {
        return error;
      }
      return undefined;
    }

    function expectInvalid(error: unknown, imageNumber: number) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        `Prediction signature is invalid for image ${imageNumber}.`,
      );
    }

    it('accepts the values returned by the analysis, image by image', () => {
      expect(
        rejection(images, [submitted(analysisA), submitted(analysisB)]),
      ).toBeUndefined();
    });

    it('rejects a tampered class', () => {
      expectInvalid(
        rejection(images, [
          submitted(analysisA),
          submitted(analysisB, { prediction: 'MITOTIC_CENTROSOME' }),
        ]),
        2,
      );
    });

    it('rejects a tampered confidence', () => {
      expectInvalid(
        rejection(images, [
          submitted(analysisA, { confidencePercentage: 99 }),
          submitted(analysisB),
        ]),
        1,
      );
    });

    it('rejects a tampered classification level', () => {
      expectInvalid(
        rejection(images, [
          submitted(analysisA, { classificationLevel: 'expert' }),
          submitted(analysisB),
        ]),
        1,
      );
    });

    it('rejects swapped image order', () => {
      expectInvalid(
        rejection(
          [{ buffer: IMAGE_B }, { buffer: IMAGE_A }],
          [submitted(analysisA), submitted(analysisB)],
        ),
        1,
      );
    });

    it.each([undefined, ''])('rejects a missing signature (%p)', (value) => {
      expectInvalid(
        rejection(images, [
          submitted(analysisA),
          submitted(analysisB, { signature: value as unknown as string }),
        ]),
        2,
      );
    });

    it('rejects a signature made with another secret', () => {
      const forged = analyze(service('another-secret'), IMAGE_A);
      expectInvalid(rejection([{ buffer: IMAGE_A }], [submitted(forged)]), 1);
    });

    it('rejects a truncated signature', () => {
      expectInvalid(
        rejection(
          [{ buffer: IMAGE_A }],
          [
            submitted(analysisA, {
              signature: IMAGE_A_SIGNATURE.slice(0, -1),
            }),
          ],
        ),
        1,
      );
    });
  });
});
