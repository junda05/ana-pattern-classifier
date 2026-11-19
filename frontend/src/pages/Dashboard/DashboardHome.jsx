import React, { useCallback, useState } from 'react';
import { colors } from '../../config/colors';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import ExamDetailModal from '../../components/common/ExamDetailModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import InlineError from '../../components/ui/InlineError';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import useNotifications from '../../hooks/useNotifications';
import useResults from '../../hooks/useResults';
import resultsService from '../../services/api/resultsService';
import { transformBackendResultsToFrontend } from '../../services/utils/resultsUtils';
import { formatDocumentTypeShort } from '../../services/utils/constants';
import { getApiErrorMessage } from '../../services/utils/apiErrors';

const DashboardHome = () => {
  const [selectedExam, setSelectedExam] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [examToVerify, setExamToVerify] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { showSuccess, showError } = useNotifications();

  // The patient search runs on the server (debounced, from page 1)
  const {
    results,
    pagination,
    filters,
    searchTerm,
    isLoading,
    error,
    changePage,
    changeSearchTerm,
    refresh
  } = useResults({
    initialPage: 1,
    initialLimit: 5,
    initialStatus: 'PENDING',
    autoLoad: true,
    showErrorNotifications: false
  });

  const filteredResults = transformBackendResultsToFrontend(results);

  const handleSearchChange = (e) => {
    changeSearchTerm(e.target.value);
  };

  // Verification is final, so it is confirmed first
  const handleConfirmVerify = async () => {
    setIsVerifying(true);
    try {
      await resultsService.updateStatus(examToVerify, 'VERIFIED');

      showSuccess('Exam verified successfully.', {
        title: 'Verification Complete'
      });

      setExamToVerify(null);
      setSelectedExam(null);
      refresh();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Could not verify the exam. Please try again.'), {
        title: 'Verification Failed'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const closeVerifyDialog = useCallback(() => setExamToVerify(null), []);

  /**
   * Loads the full exam, including its predictions, before opening the modal.
   */
  const handleViewDetails = async (exam) => {
    setIsLoadingDetails(true);
    try {
      const examDetails = await resultsService.getResultById(exam.id);
      setSelectedExam(examDetails);
    } catch (err) {
      showError(getApiErrorMessage(err, 'Could not load the exam details.'), {
        title: 'Could Not Load Details'
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedExam(null);
  };

  const handlePageChange = (page) => {
    changePage(page);
  };

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-left"
          style={{ color: colors.primary.red }}
        >
          Home
        </h1>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2
              className="text-xl font-semibold text-left"
              style={{ color: colors.primary.red }}
            >
              Pending Exams
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Results awaiting professional verification.
            </p>
          </div>
          <div className="flex items-center">
            <SearchInput
              id="search-patients"
              ariaLabel="Search patients"
              placeholder="Search patients…"
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-64"
            />
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner label="Loading pending exams…" />
          </div>
        )}

        {!isLoading && error && (
          <InlineError message={error} onRetry={refresh} />
        )}

        {!isLoading && !error && filteredResults.length === 0 && (
          <EmptyState
            message={filters.search
              ? "No exams match your search."
              : "There are no pending exams."
            }
          />
        )}

        {!isLoading && !error && filteredResults.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr
                    style={{ backgroundColor: colors.overlay.light }}
                  >
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">
                      Patient Name
                    </th>
                    <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
                      Document
                    </th>
                    <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
                      Phone / Email
                    </th>
                    <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
                      Date and Time
                    </th>
                    <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b transition-colors hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm text-gray-700 text-left">
                        {item.patientName}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 text-center">
                        ({formatDocumentTypeShort(item.documentType)}) {item.documentNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-center gap-1">
                          {item.patientEmail && item.patientPhoneNumber ? (
                            <>
                              <div className="text-sm truncate" style={{ color: colors.text.dark }}>
                                {item.patientEmail}
                              </div>
                              <div className="text-sm truncate" style={{ color: colors.text.secondary }}>
                                {item.patientPhonePrefix} {item.patientPhoneNumber}
                              </div>
                            </>
                          ) : item.patientEmail ? (
                            <div className="text-sm truncate" style={{ color: colors.text.dark }}>
                              {item.patientEmail}
                            </div>
                          ) : item.patientPhoneNumber ? (
                            <div className="text-sm truncate" style={{ color: colors.text.dark }}>
                              {item.patientPhonePrefix} {item.patientPhoneNumber}
                            </div>
                          ) : (
                            <div className="text-sm" style={{ color: colors.text.secondary }}>
                              -
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 text-center">
                        {item.dateTime}
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        <Button
                          variant="primary"
                          size="table"
                          onClick={() => handleViewDetails(item)}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </div>

      <ExamDetailModal
        exam={selectedExam}
        onClose={handleCloseModal}
        onVerify={setExamToVerify}
        isLoading={isLoadingDetails}
      />

      <ConfirmDialog
        isOpen={examToVerify !== null}
        title="Verify Exam?"
        confirmLabel="Verify"
        loading={isVerifying}
        onConfirm={handleConfirmVerify}
        onCancel={closeVerifyDialog}
      >
        The exam will be marked as Verified and its results become final. Verified exams appear in Reports.
      </ConfirmDialog>
    </div>
  );
};

export default DashboardHome;
