import React, { useState } from 'react';
import CorrectionRateChart from './CorrectionRateChart';
import AnalyticsDateFilters from './AnalyticsDateFilters';
import LoadingSpinner from '../ui/LoadingSpinner';
import InlineError from '../ui/InlineError';
import resultsService from '../../services/api/resultsService';
import { getApiErrorMessage } from '../../services/utils/apiErrors';
import { colors } from '../../config/colors';

/**
 * Analytics dashboard: date-range filters plus the correction-rate chart.
 * Statistics come from the API and are computed per prediction (per image), not per result.
 */
const AnalyticsDashboard = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Statistics are generated on demand, when the user clicks the button
  const handleGenerateStatistics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await resultsService.getStatistics({
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });
      setStatistics(data);
    } catch (err) {
      setStatistics(null);
      // A 400 means an invalid date range; the API explains which
      setError(err.response?.status === 400
        ? getApiErrorMessage(err, 'The start date cannot be later than the end date.')
        : 'Could not load the statistics.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg border" style={{ borderColor: colors.border.subtle }}>
      <AnalyticsDateFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onGenerate={handleGenerateStatistics}
        isLoading={isLoading}
      />

      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" type="circle" color="red" label="Loading statistics…" />
        </div>
      )}

      {error && !isLoading && (
        <InlineError message={error} onRetry={handleGenerateStatistics} />
      )}

      {/* Initial state: no statistics generated yet */}
      {!isLoading && !error && !statistics && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Select a Date Range
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Optionally choose a start and end date, then click "Generate Statistics" to view the result metrics.
          </p>
        </div>
      )}

      {!isLoading && !error && statistics && (
        <CorrectionRateChart statistics={statistics} />
      )}
    </div>
  );
};

export default AnalyticsDashboard;
