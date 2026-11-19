import React from 'react';
import { colors } from '../../config/colors';
import { Calendar } from 'lucide-react';

/**
 * Date-range filters for the Analytics dashboard, with the Generate Statistics button.
 */
const AnalyticsDateFilters = ({ dateFrom, dateTo, onDateFromChange, onDateToChange, onGenerate, isLoading }) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="analytics-date-from" className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" aria-hidden="true" />
            Start Date (Optional)
          </label>
          <input
            id="analytics-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-opacity-50"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label htmlFor="analytics-date-to" className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" aria-hidden="true" />
            End Date (Optional)
          </label>
          <input
            id="analytics-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-opacity-50"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading}
            className="px-6 py-2 rounded-lg font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: colors.primary.red }}
          >
            {isLoading ? 'Generating…' : 'Generate Statistics'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDateFilters;
