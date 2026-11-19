import React from 'react';
import { colors } from '../../config/colors';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import {
  formatActorRole,
  formatDateTime,
  getActivityBadgeType,
} from '../../services/utils/traceabilityUtils';
import { formatActivityType } from '../../services/utils/constants';

/**
 * Table listing audit-trail records
 * Reuses the existing Badge, Button and EmptyState components
 */
const TraceabilityTable = ({ data, onViewDetails }) => {

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No Records Found"
        description="No records match the search criteria. Try adjusting the filters."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr
            className="border-b-2"
            style={{ borderColor: colors.primary.red }}
          >
            <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">
              User
            </th>
            <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
              Date and Time
            </th>
            <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
              Activity Type
            </th>
            <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
              Change Details
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((record, index) => (
            <tr
              key={record.id}
              className={`border-b ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              } hover:bg-gray-100 transition-colors`}
            >
              <td className="py-3 px-4 text-sm">
                <div className="text-gray-700 font-medium">{record.userName}</div>
                <div className="text-xs text-gray-400">{formatActorRole(record.userRole, record.userName)}</div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-600 text-center">
                {formatDateTime(record.dateTime)}
              </td>
              <td className="py-3 px-4 text-sm text-center">
                <div className="flex justify-center">
                  <Badge
                    type={getActivityBadgeType(record.activityType)}
                    className="px-1 py-1.5 min-w-[100px]"
                  >
                    {record.activityTypeLabel || formatActivityType(record.activityType) || 'Not specified'}
                  </Badge>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-center">
                <Button
                  size="table"
                  variant="primary"
                  onClick={() => onViewDetails(record)}
                >
                  View Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TraceabilityTable;
