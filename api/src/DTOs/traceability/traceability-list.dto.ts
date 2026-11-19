/**
 * Audit-trail list DTO
 *
 * Holds the summary information shown in the audit-trail table
 *
 * Table columns:
 * - User: full name of the user who performed the action
 * - Date and time: timestamp of the action
 * - Activity type: activity label (clients branch on `activityType`, not the label)
 * - Entity: affected entity type code (`entityType`, e.g. for the CSV export)
 * - Details: link to the full record
 */

import {
  ActivityType,
  EntityType,
} from '../../entities/traceabilities/traceability.types';
import { UserRole } from '../../entities/users/user.types';

export class TraceabilityListDto {
  traceabilityId: number;

  // User who performed the activity ("System" and a null role for system actions)
  userFullName: string;
  userRole: UserRole | null; // User role code

  // Timestamp
  dateAndHour: Date;

  // Activity type
  activityType: ActivityType; // ActivityType code, e.g. "CREATE", "UPDATE", "DELETE"
  activityTypeLabel: string; // Display label, e.g. "Create", "Update", "Delete"

  // Affected entity
  entityType: EntityType; // EntityType code, e.g. "USER", "PATIENT", "RESULT", "CORRECTION"
}
