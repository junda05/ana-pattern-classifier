import React, { useMemo, useState } from 'react';
import { colors } from '../../config/colors';
import useTraceability from '../../hooks/useTraceability';
import useNotifications from '../../hooks/useNotifications';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import TraceabilityTable from '../../components/traceability/TraceabilityTable';
import RecordDetailModal from '../../components/traceability/RecordDetailModal';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import SearchInput from '../../components/ui/SearchInput';
import SearchSelect from '../../components/ui/SearchSelect';
import InlineError from '../../components/ui/InlineError';
import { exportToCSV, buildTraceabilityQuery, fetchAllTraceabilityRecords } from '../../services/utils/traceabilityUtils';
import { ACTIVITY_TYPES, formatActivityType } from '../../services/utils/constants';
import { pluralize } from '../../services/utils/stringUtils';

const ACTIVITY_OPTIONS = Object.values(ACTIVITY_TYPES).map((code) => ({ value: code, label: formatActivityType(code) }));
const EXPORT_ERROR = 'Could not export the audit trail. Please try again.';
const DATE_RANGE_ERROR = 'Start date must be on or before the end date.';
const NO_DATES = { from: '', to: '' };

// Dates are yyyy-mm-dd strings, so they compare in calendar order
const isReversedRange = ({ from, to }) => from !== '' && to !== '' && from > to;

/**
 * Audit Trail page: every recorded action in the system, filtered on the server
 * (user name, activity, local days) with a CSV export of every matching record.
 */
const DashboardTraceability = () => {
  const { showSuccess, showInfo, showError } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  // The dates as typed, and the last valid range, which is the one sent to the API
  const [dates, setDates] = useState(NO_DATES);
  const [appliedDates, setAppliedDates] = useState(NO_DATES);
  const [activityType, setActivityType] = useState('');
  const [exportProgress, setExportProgress] = useState(null); // { loaded, total } while exporting

  // The user name is sent after a pause in typing; dates and activity apply at once
  const userName = useDebouncedValue(searchTerm, 300);
  const query = useMemo(
    () => buildTraceabilityQuery({ userName, dateFrom: appliedDates.from, dateTo: appliedDates.to, activityType }),
    [userName, appliedDates, activityType]
  );

  // A reversed range is flagged on the field and not sent: the list keeps the last valid range
  const dateRangeError = isReversedRange(dates) ? DATE_RANGE_ERROR : null;
  const changeDate = (field) => (event) => {
    const next = { ...dates, [field]: event.target.value };
    setDates(next);
    if (!isReversedRange(next)) setAppliedDates(next);
  };

  const {
    data,
    totalRecords,
    isLoading,
    error,
    isLoadingDetail,
    detailError,
    currentPage,
    totalPages,
    itemsPerPage,
    changePage,
    isDetailOpen,
    selectedRecord,
    selectRecord,
    retryRecordDetails,
    closeRecordDetails,
    refresh
  } = useTraceability(query);

  const handleClearFilters = () => {
    setSearchTerm('');
    setDates(NO_DATES);
    setAppliedDates(NO_DATES);
    setActivityType('');
    showInfo('Filters cleared.');
  };

  const hasActiveFilters = searchTerm !== '' || dates.from !== '' || dates.to !== '' || activityType !== '';
  const isExporting = exportProgress !== null;

  // Exports every record that matches the filters (all pages), not only the rows shown
  const handleExport = async () => {
    setExportProgress({ loaded: 0, total: totalRecords });
    try {
      const records = await fetchAllTraceabilityRecords(query, setExportProgress);
      if (records.length === 0) {
        showInfo('There are no records to export.');
        return;
      }

      const filename = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
      exportToCSV(records, filename);
      showSuccess(`${pluralize(records.length, 'record')} exported successfully.`);
    } catch (err) {
      showError(EXPORT_ERROR, { title: 'Export Failed' });
    } finally {
      setExportProgress(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: colors.primary.red }}
        >
          Audit Trail
        </h1>
        <p className="text-gray-600 mt-2">
          A record of every action performed in the system.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="mb-4">
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: colors.primary.red }}
          >
            Filters
          </h2>
          <p className="text-gray-600 text-sm">
            Narrow down the audit records.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SearchInput
            id="user-search"
            name="searchTerm"
            label="Search by User"
            placeholder="e.g. Jane Doe"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <SearchSelect
            id="activity-type"
            name="activityType"
            label="Activity"
            placeholder="All Activities"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            options={ACTIVITY_OPTIONS}
          />

          <SearchInput
            id="date-from"
            name="dateFrom"
            type="date"
            label="Start Date"
            value={dates.from}
            onChange={changeDate('from')}
            error={dateRangeError}
          />

          <SearchInput
            id="date-to"
            name="dateTo"
            type="date"
            label="End Date"
            value={dates.to}
            onChange={changeDate('to')}
          />
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="secondary"
              size="small"
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600">
            {totalRecords > 0 && (
              <span className="font-medium">
                {pluralize(totalRecords, 'record')} found
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="medium"
              onClick={refresh}
              disabled={isLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleExport}
              disabled={totalRecords === 0 || isLoading || isExporting || dateRangeError !== null}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              {isExporting
                ? `Exporting ${exportProgress.loaded} of ${pluralize(exportProgress.total, 'record')}…`
                : 'Export CSV'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" type="circle" color="red" label="Loading audit records…" />
          </div>
        ) : error ? (
          <InlineError message={error} onRetry={refresh} />
        ) : (
          <>
            <TraceabilityTable
              data={data}
              onViewDetails={selectRecord}
            />

            {totalRecords > 0 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalRecords}
                  itemsPerPage={itemsPerPage}
                  onPageChange={changePage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {isDetailOpen && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={closeRecordDetails}
          isLoading={isLoadingDetail}
          error={detailError}
          onRetry={retryRecordDetails}
        />
      )}
    </div>
  );
};

export default DashboardTraceability;
