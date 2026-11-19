import React from 'react';
import { colors } from '../../config/colors';
import ExamTable from '../common/ExamTable';
import ReportActions from '../common/ReportActions';

/**
 * Report search results table: ExamTable configured with the report search columns.
 */
const ExamResultsTable = ({ 
  results = [], 
  isLoading = false, 
  onViewReport,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems = 0,
  itemsPerPage = 5
}) => {
  const columns = [
    {
      label: 'Patient Name',
      field: 'patientName',
      align: 'text-left'
    },
    {
      label: 'Document',
      field: 'patientDocument',
      align: 'text-center'
    },
    {
      label: 'Phone / Email',
      align: 'text-center',
      render: (report) => (
        <div className="flex flex-col items-center gap-1">
          {report.patientEmail && report.patientPhoneNumber ? (
            <>
              <div className="text-sm truncate" style={{ color: colors.text.dark }}>
                {report.patientEmail}
              </div>
              <div className="text-sm truncate" style={{ color: colors.text.secondary }}>
                {report.patientPhonePrefix} {report.patientPhoneNumber}
              </div>
            </>
          ) : report.patientEmail ? (
            <div className="text-sm truncate" style={{ color: colors.text.dark }}>
              {report.patientEmail}
            </div>
          ) : report.patientPhoneNumber ? (
            <div className="text-sm truncate" style={{ color: colors.text.dark }}>
              {report.patientPhonePrefix} {report.patientPhoneNumber}
            </div>
          ) : (
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              -
            </div>
          )}
        </div>
      )
    },
    {
      label: 'Date and Time',
      field: 'dateTime',
      align: 'text-center'
    }
  ];

  return (
    <ExamTable
      exams={results}
      isLoading={isLoading}
      title="Search Results"
      showPagination={true}
      emptyMessage="No results match your search."
      columns={columns}
      pagination={{
        currentPage,
        totalPages,
        totalItems,
        itemsPerPage
      }}
      onPageChange={onPageChange}
      renderActions={(report) => (
        <ReportActions 
          exam={report}
          onViewReport={onViewReport}
          showDownload={false}
        />
      )}
    />
  );
};

export default ExamResultsTable;