import React, { useState } from 'react';
import { colors } from '../../config/colors';
import reportsService from '../../services/api/reportsService';
import { formatDate } from '../../services/utils/dateUtils';
import PatientSearchForm from '../../components/reports/PatientSearchForm';
import ExamResultsTable from '../../components/reports/ExamResultsTable';
import ReportModal from '../../components/reports/ReportModal';
import InlineError from '../../components/ui/InlineError';
import { getApiErrorMessage } from '../../services/utils/apiErrors';

const DashboardReports = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [lastSearchParams, setLastSearchParams] = useState(null);
  const [searchError, setSearchError] = useState(null);

  const pageSize = 5;

  const [lastPage, setLastPage] = useState(1);

  const handleSearch = async (searchData) => {
    setIsLoading(true);
    setHasSearched(true);
    setSearchError(null);
    // A new search starts on page 1, so Retry re-runs this search (not a page of the previous one)
    setLastPage(1);

    try {
      // Kept so page changes re-run the same search
      setLastSearchParams(searchData);

      const response = await reportsService.searchReports({
        patientName: searchData.patientName,
        patientDocument: searchData.patientDocument,
        page: 1,
        limit: pageSize
      });

      const resultsWithFormattedDate = response.data.map(report => ({
        ...report,
        id: report.resultId, // table and modal key reports by id
        dateTime: formatDate(report.dateAndHour)
      }));

      setSearchResults(resultsWithFormattedDate);
      setCurrentPage(response.page);
      setTotalPages(response.totalPages);
      setTotalItems(response.total);
    } catch (error) {
      setSearchError(getApiErrorMessage(error, 'Could not search reports.'));
      setSearchResults([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > totalPages || !lastSearchParams) return;

    setLastPage(newPage);
    setIsLoading(true);
    setSearchError(null);

    try {
      const response = await reportsService.searchReports({
        patientName: lastSearchParams.patientName,
        patientDocument: lastSearchParams.patientDocument,
        page: newPage,
        limit: pageSize
      });

      const resultsWithFormattedDate = response.data.map(report => ({
        ...report,
        id: report.resultId,
        dateTime: formatDate(report.dateAndHour)
      }));

      setSearchResults(resultsWithFormattedDate);
      setCurrentPage(response.page);
      setTotalPages(response.totalPages);
      setTotalItems(response.total);
    } catch (error) {
      setSearchError(getApiErrorMessage(error, 'Could not load this page of results.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewReport = (report) => {
    setSelectedReportId(report.id || report.resultId);
    setShowReportModal(true);
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setSelectedReportId(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: colors.primary.red }}
        >
          Reports
        </h1>
        <p className="text-gray-600 mt-2">
          Search and view clinical reports for completed exams.
        </p>
      </div>

      <PatientSearchForm
        onSearch={handleSearch}
        isLoading={isLoading}
      />

      {searchError && hasSearched && (
        <InlineError
          className="mb-4"
          message={searchError}
          onRetry={() => (lastPage > 1 ? handlePageChange(lastPage) : handleSearch(lastSearchParams))}
        />
      )}

      {hasSearched && (
        <ExamResultsTable
          results={searchResults}
          isLoading={isLoading}
          onViewReport={handleViewReport}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={pageSize}
          onPageChange={handlePageChange}
        />
      )}

      <ReportModal
        isOpen={showReportModal}
        onClose={closeReportModal}
        reportId={selectedReportId}
      />
    </div>
  );
};

export default DashboardReports;
