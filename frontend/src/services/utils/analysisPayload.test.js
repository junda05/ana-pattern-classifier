import {
  buildNewCorrections,
  buildExistingCorrections,
  normalizeObservations,
  withCorrectionNotes,
  applyAppendResponse,
  MAX_IMAGES_PER_RESULT,
} from './analysisPayload';

const signed = (prediction) => ({ prediction, confidencePercentage: 90, classificationLevel: 'competent', signature: 's', dilution: '80' });

describe('analysis payload helpers', () => {
  it('caps a result at 20 images', () => {
    expect(MAX_IMAGES_PER_RESULT).toBe(20);
  });

  describe('normalizeObservations', () => {
    it.each([
      ['', null],
      ['   ', null],
      [null, null],
      [undefined, null],
      ['Faint staining.', 'Faint staining.'],
    ])('turns %p into %p', (input, expected) => {
      expect(normalizeObservations(input)).toBe(expected);
    });
  });

  it('never sends a correction of a new image to the class the model predicted', () => {
    const predictions = [signed('NEGATIVE'), signed('NUCLEAR_HOMOGENEOUS')];
    const corrections = buildNewCorrections(
      { a: 'NEGATIVE', b: 'NUCLEAR_SPECKLED' },
      { a: 0, b: 1 },
      predictions
    );

    expect(corrections).toEqual([{ imageIndex: 1, correctedPrediction: 'NUCLEAR_SPECKLED' }]);
  });

  it('never sends a correction of a saved prediction to its own class', () => {
    const existing = [
      { predictionId: 501, prediction: 'NUCLEAR_SPECKLED' },
      { predictionId: 502, prediction: 'NEGATIVE' },
    ];
    const corrections = buildExistingCorrections({ 501: 'NUCLEAR_SPECKLED', 502: 'NUCLEAR_SPECKLED' }, existing);

    expect(corrections).toEqual([{ predictionId: 502, correctedPrediction: 'NUCLEAR_SPECKLED' }]);
  });

  it('attaches the correction notes to every correction, and nothing when there are none', () => {
    const list = [{ predictionId: 1, correctedPrediction: 'NEGATIVE' }];

    expect(withCorrectionNotes(list, 'Checked twice.')).toEqual([
      { predictionId: 1, correctedPrediction: 'NEGATIVE', observations: 'Checked twice.' },
    ]);
    expect(withCorrectionNotes(list, '  ')).toEqual(list);
  });

  describe('applyAppendResponse', () => {
    const existing = [{ predictionId: 501, prediction: 'NEGATIVE' }];

    it('takes the saved predictions from the response', () => {
      const response = {
        predictions: [{ predictionId: 501 }, { predictionId: 600 }],
        addedPredictionIds: [600],
      };

      expect(applyAppendResponse(existing, [signed('NUCLEAR_SPECKLED')], response)).toEqual(response.predictions);
    });

    it('appends the new predictions under their reported ids when the response has no list', () => {
      const response = { addedPredictionIds: [600] };

      expect(applyAppendResponse(existing, [signed('NUCLEAR_SPECKLED')], response)).toEqual([
        existing[0],
        { ...signed('NUCLEAR_SPECKLED'), predictionId: 600 },
      ]);
    });
  });
});
