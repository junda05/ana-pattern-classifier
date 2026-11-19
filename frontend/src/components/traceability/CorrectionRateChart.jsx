import React from 'react';
import { colors } from '../../config/colors';

/**
 * Correction-rate chart: correctly classified vs. corrected predictions as horizontal bars.
 *
 * Statistics are computed per prediction (per image):
 * - Total Validated: predictions in results with status VERIFIED or CORRECTED
 * - Model Accuracy: % of validated predictions that needed no correction
 * - Correction Rate: % of validated predictions that were corrected
 *
 * @param {Object} statistics - Statistics computed by the API
 */
const CorrectionRateChart = ({ statistics }) => {
  const {
    totalValidated,
    precision,
    correctionRate,
    totalVerifiedWithoutCorrections,
    totalCorrected
  } = statistics;

  return (
    <div className="bg-white p-6 rounded-lg border" style={{ borderColor: colors.border.subtle }}>
      <h3 className="text-lg font-semibold text-gray-800 mb-6">
        Prediction Correction Rate
      </h3>

      {/* Summary figures */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold" style={{ color: colors.primary.red }}>
            {totalValidated}
          </p>
          <p className="text-xs text-gray-600 mt-1">Total Validated</p>
        </div>
        <div className="text-center p-3 rounded-lg border-2" style={{ backgroundColor: colors.accent.blue.background, borderColor: colors.accent.blue.border }}>
          <p className="text-2xl font-bold" style={{ color: colors.accent.blue.text }}>
            {precision}%
          </p>
          <p className="text-xs text-gray-600 mt-1">Model Accuracy</p>
        </div>
        <div className="text-center p-3 rounded-lg border-2" style={{ backgroundColor: colors.accent.amber.background, borderColor: colors.accent.amber.border }}>
          <p className="text-2xl font-bold" style={{ color: colors.accent.amber.text }}>
            {correctionRate}%
          </p>
          <p className="text-xs text-gray-600 mt-1">Correction Rate</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Correctly classified */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border-2"
                style={{ backgroundColor: colors.accent.blue.background, borderColor: colors.accent.blue.border }}
              />
              <span className="text-sm font-medium text-gray-700">
                Correctly Classified
              </span>
            </div>
            <span className="text-sm font-semibold text-gray-800">
              {totalVerifiedWithoutCorrections} ({precision}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
            <div
              className="h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500 border-2"
              style={{
                width: `${precision}%`,
                backgroundColor: colors.accent.blue.background,
                borderColor: colors.accent.blue.border,
                minWidth: totalVerifiedWithoutCorrections > 0 ? '40px' : '0'
              }}
            >
              {precision > 10 && (
                <span className="text-xs font-semibold" style={{ color: colors.accent.blue.text }}>
                  {totalVerifiedWithoutCorrections}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Corrected */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border-2"
                style={{ backgroundColor: colors.accent.amber.background, borderColor: colors.accent.amber.border }}
              />
              <span className="text-sm font-medium text-gray-700">
                Corrected Predictions
              </span>
            </div>
            <span className="text-sm font-semibold text-gray-800">
              {totalCorrected} ({correctionRate}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
            <div
              className="h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500 border-2"
              style={{
                width: `${correctionRate}%`,
                backgroundColor: colors.accent.amber.background,
                borderColor: colors.accent.amber.border,
                minWidth: totalCorrected > 0 ? '40px' : '0'
              }}
            >
              {correctionRate > 10 && (
                <span className="text-xs font-semibold" style={{ color: colors.accent.amber.text }}>
                  {totalCorrected}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {totalValidated === 0 ? (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> There are no validated results in the selected period.
          </p>
        </div>
      ) : (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Note:</strong> Corrected predictions are those that required manual correction
            after automatic classification. A low correction rate indicates high AI model
            accuracy.
          </p>
        </div>
      )}
    </div>
  );
};

export default CorrectionRateChart;
