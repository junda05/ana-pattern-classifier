import { plainToInstance } from 'class-transformer';
import { PredictionDetailDto } from './prediction-detail.dto';
import { Dilution } from '../../entities/predictions/prediction.types';

describe('PredictionDetailDto', () => {
  const original = process.env.API_BASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.API_BASE_URL;
    } else {
      process.env.API_BASE_URL = original;
    }
  });

  const toDto = (imagePath: string | null) =>
    plainToInstance(
      PredictionDetailDto,
      {
        predictionId: 7,
        prediction: 'NUCLEAR_HOMOGENEOUS',
        confidencePercentage: 91.5,
        imagePath,
        dilution: Dilution.DILUTION_160,
        resultId: 3,
      },
      { excludeExtraneousValues: true },
    );

  it('builds imageUrl from the shared API base URL (default port 8001)', () => {
    delete process.env.API_BASE_URL;
    expect(toDto('abc-1-slide.png').imageUrl).toBe(
      'http://localhost:8001/api/v1/files/predictions/abc-1-slide.png',
    );
  });

  it('honours API_BASE_URL', () => {
    process.env.API_BASE_URL = 'https://lab.example.com/';
    expect(toDto('abc-1-slide.png').imageUrl).toBe(
      'https://lab.example.com/api/v1/files/predictions/abc-1-slide.png',
    );
  });

  it('returns a null imageUrl without an image and drops undeclared fields', () => {
    const dto = toDto(null);
    expect(dto.imageUrl).toBeNull();
    expect(dto).not.toHaveProperty('resultId');
  });
});
