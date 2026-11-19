import React from 'react';
import Button from '../ui/Button';

/**
 * Report action buttons for a table row.
 *
 * @param {Object} exam - Exam the actions apply to
 * @param {Function} onViewReport - Opens the report
 * @param {Function} onDownloadReport - Downloads the report
 * @param {boolean} showDownload - Whether to show the Download button (default true)
 */
const ReportActions = ({ 
  exam, 
  onViewReport, 
  onDownloadReport, 
  showDownload = true 
}) => {
  return (
    <div className="flex space-x-2 justify-center">
      <Button
        variant="primary"
        size="table"
        onClick={() => onViewReport && onViewReport(exam)}
      >
        View Report
      </Button>
      
      {showDownload && (
        <Button
          variant="secondary"
          size="table"
          onClick={() => onDownloadReport && onDownloadReport(exam)}
        >
          Download
        </Button>
      )}
    </div>
  );
};

export default ReportActions;