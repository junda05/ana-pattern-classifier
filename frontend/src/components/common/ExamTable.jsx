import React from 'react';
import { colors } from '../../config/colors';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import Pagination from '../ui/Pagination';

/**
 * Generic exam table used by the Reports search results (ExamResultsTable).
 *
 * @param {Array} exams - Exams to display
 * @param {boolean} isLoading - Shows a spinner instead of the table
 * @param {string} title - Table title
 * @param {string} subtitle - Table subtitle
 * @param {Function} renderActions - Renders the action cell of each row
 * @param {Object} pagination - { currentPage, totalPages, totalItems, itemsPerPage }
 * @param {Function} onPageChange - Called with the new page number
 * @param {string} emptyMessage - Message shown when there are no exams
 * @param {boolean} showPagination - Whether to show the pagination controls
 * @param {Array} columns - Column definitions
 * @param {Function} renderRow - Renders custom cells for a row
 */
const ExamTable = ({
  exams = [],
  isLoading = false,
  title,
  subtitle,
  renderActions,
  pagination,
  onPageChange,
  emptyMessage = "No exams available.",
  showPagination = true,
  columns = [],
  renderRow
}) => {

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner label="Loading exams…" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h3 
              className="text-lg font-semibold"
              style={{ color: colors.primary.red }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-gray-600 text-sm mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {exams.length === 0 ? (
        <EmptyState 
          icon={
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-12 w-12 mx-auto mb-4 text-gray-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="1" 
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
              />
            </svg>
          }
          description={emptyMessage}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ backgroundColor: colors.overlay.light }}>
                  {columns.map((col, index) => (
                    <th 
                      key={index} 
                      className={`py-3 px-4 text-sm font-semibold text-gray-700 ${col.align || 'text-center'}`}
                    >
                      {col.label}
                    </th>
                  ))}
                  {renderActions && (
                    <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {exams.map((exam, index) => (
                  <tr 
                    key={exam.id || index} 
                    className="border-b hover:bg-gray-50 transition-colors duration-150"
                  >
                    {renderRow ? renderRow(exam) : (
                      columns.map((col, colIndex) => (
                        <td 
                          key={colIndex} 
                          className={`py-3 px-4 text-sm text-gray-700 ${col.align || 'text-center'}`}
                        >
                          {col.render ? col.render(exam) : exam[col.field]}
                        </td>
                      ))
                    )}
                    {renderActions && (
                      <td className="py-3 px-4 text-sm text-center">
                        {renderActions(exam)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showPagination && pagination && (
            <div className="mt-6">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                itemsPerPage={pagination.itemsPerPage}
                onPageChange={onPageChange}
              />
            </div>
          )}

          {/* Recent searches note (unpaginated list) */}
          {!showPagination && exams.length >= 5 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                Showing the {exams.length} most recent searches.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExamTable;
