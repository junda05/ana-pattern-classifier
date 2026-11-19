import React, { useId } from 'react';
import { colors } from '../../config/colors';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ModalBase from '../ui/ModalBase';
import LoadingSpinner from '../ui/LoadingSpinner';
import PredictionImage from '../ui/PredictionImage';
import { FileText } from 'lucide-react';
import InlineError from '../ui/InlineError';
import RoleBadge from '../ui/RoleBadge';
import {
  formatActorRole,
  formatDateTime,
  getActivityBadgeType,
  getValidationBadgeType,
  formatFieldValue
} from '../../services/utils/traceabilityUtils';
import {
  getPredictionClassBadgeType,
  getConfidenceBadgeType,
  formatConfidenceText
} from '../../config/confidenceConfig';
import { getFormattedClassName, getGeneralClass } from '../../config/classMapping';
import {
  formatDilution,
  extractShortFilename,
  formatDocumentType,
  formatActivityType,
  ACTIVITY_TYPES,
  ENTITY_TYPES,
} from '../../services/utils/constants';
import { pluralize } from '../../services/utils/stringUtils';

/**
 * Plain-language description of password-reset activities (they carry no field changes)
 */
const describePasswordReset = (record) => {
  const user = record.affectedUserName || 'the user';
  switch (record.activityType) {
    case ACTIVITY_TYPES.PASSWORD_RESET_REQUEST:
      return `A password reset was requested for ${user}. The administrator was notified by email.`;
    case ACTIVITY_TYPES.PASSWORD_RESET_COMPLETED:
      return `An administrator set a new password for ${user}.`;
    case ACTIVITY_TYPES.PASSWORD_RESET_EXPIRED:
      return `A password reset link for ${user} was opened after it had expired.`;
    default:
      return null;
  }
};

/** A titled block of the detail view, exposed to assistive technology as a region named by its title. */
const DetailSection = ({ title, className = 'mb-8', children }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: colors.primary.red }} />
        <h4 id={headingId} className="text-lg font-semibold" style={{ color: colors.text.dark }}>
          {title}
        </h4>
      </div>
      {children}
    </section>
  );
};

const RecordDetailModal = ({ record, onClose, isLoading = false, error = null, onRetry }) => {
  if (!record && !isLoading && !error) return null;

  // Branch on the activity/entity codes, never on their display labels
  const isCreateActivity = record?.activityType === ACTIVITY_TYPES.CREATE;
  const isCorrectionEntity = record?.entityType === ENTITY_TYPES.CORRECTION;

  const renderEntityInfo = () => {
    const { entityTypeLabel, affectedUserName, predictions } = record;

    // Affected user
    if (affectedUserName) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
              Name
            </span>
            <p className="text-base mt-1" style={{ color: colors.text.primary }}>
              {record.affectedUserName || '-'}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
              Username
            </span>
            <p className="text-base mt-1" style={{ color: colors.text.primary }}>
              {record.affectedUserUsername || '-'}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
              Role
            </span>
            <div className="mt-1">
              <RoleBadge role={record.affectedUserRole} />
            </div>
          </div>
          <div>
            <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
              Email
            </span>
            <p className="text-base mt-1" style={{ color: colors.text.primary }}>
              {record.affectedUserEmail || '-'}
            </p>
          </div>
        </div>
      );
    }

    // Correction information
    if (isCorrectionEntity && predictions && predictions.length > 0) {
      // Were new images added to an existing result? (same logic as for results)
      const hasNewPredictions = record.newPredictionsAdded > 0;

      // Split into previous and newly added predictions
      const previousPredictions = hasNewPredictions
        ? predictions.slice(0, predictions.length - record.newPredictionsAdded)
        : [];
      const newPredictions = hasNewPredictions
        ? record.addedPredictions || predictions.slice(-record.newPredictionsAdded)
        : predictions;

      const renderCorrectionsGrid = (preds) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {preds.map((prediction, index) => {
            const formattedOriginal = getFormattedClassName(prediction.prediction);
            const generalClass = getGeneralClass(prediction.prediction);
            const predictionBadgeType = getPredictionClassBadgeType(generalClass || prediction.prediction);
            const confidenceBadgeType = getConfidenceBadgeType(prediction.confidencePercentage);

            return (
              <div key={prediction.predictionId || index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="aspect-square bg-gray-100 rounded-md mb-3 overflow-hidden">
                  <PredictionImage
                    imageUrl={prediction.imageUrl}
                    imagePath={prediction.imagePath}
                    alt={`Correction ${index + 1}`}
                    className="w-full h-full object-cover"
                    showFilename={false}
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                      File
                    </span>
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: colors.text.primary }}
                      title={prediction.imagePath}
                    >
                      {prediction.imagePath ? extractShortFilename(prediction.imagePath) : `Image ${index + 1}`}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                      Original Prediction
                    </span>
                    <Badge type={predictionBadgeType} size="sm">
                      {formattedOriginal}
                    </Badge>
                  </div>

                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                      Confidence
                    </span>
                    <Badge type={confidenceBadgeType} size="sm">
                      {formatConfidenceText(prediction.confidencePercentage)}
                    </Badge>
                  </div>

                  {prediction.correction && (
                    <div>
                      <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                        Corrected To
                      </span>
                      <Badge type={getPredictionClassBadgeType(getGeneralClass(prediction.correction.correctedPrediction) || prediction.correction.correctedPrediction)} size="sm">
                        {getFormattedClassName(prediction.correction.correctedPrediction)}
                      </Badge>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                      Dilution
                    </span>
                    <p className="text-xs" style={{ color: colors.text.primary }}>
                      {formatDilution(prediction.dilution)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );

      return (
        <div>
          {/* Final corrections (newly added images) */}
          {hasNewPredictions && (
            <div className="mb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
                <span className="text-lg font-semibold" style={{ color: colors.text.dark }}>
                  Final Corrections ({pluralize(newPredictions.length, 'new image')})
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium" style={{ color: colors.text.secondary }}>Date:</span>
                  <span className="text-base font-medium" style={{ color: colors.text.primary }}>
                    {record.dateTime ? formatDateTime(record.dateTime) : '-'}
                  </span>
                </div>
              </div>
              {renderCorrectionsGrid(newPredictions)}

              {newPredictions.some(p => p.correction?.observations) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-semibold block mb-2" style={{ color: colors.text.dark }}>
                    Observations
                  </span>
                  <p className="text-sm" style={{ color: colors.text.primary }}>
                    {newPredictions.find(p => p.correction?.observations)?.correction?.observations}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Previous corrections (original images) */}
          {hasNewPredictions && previousPredictions.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
                <span className="text-lg font-semibold" style={{ color: colors.text.dark }}>
                  Previous Corrections ({pluralize(previousPredictions.length, 'original image')})
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium" style={{ color: colors.text.secondary }}>Date:</span>
                  <span className="text-base font-medium" style={{ color: colors.text.primary }}>
                    {record.originalResultDateTime ? formatDateTime(record.originalResultDateTime) : '-'}
                  </span>
                </div>
              </div>
              {renderCorrectionsGrid(previousPredictions)}

              {previousPredictions.some(p => p.correction?.observations) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-semibold block mb-2" style={{ color: colors.text.dark }}>
                    Observations
                  </span>
                  <p className="text-sm" style={{ color: colors.text.primary }}>
                    {previousPredictions.find(p => p.correction?.observations)?.correction?.observations}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No images were added: show every prediction together */}
          {!hasNewPredictions && (
            <div className="mb-4">
              <span className="text-sm font-medium block mb-3" style={{ color: colors.text.secondary }}>
                {predictions.length > 1 ? `Corrections (${predictions.length})` : 'Correction'}
              </span>
              {renderCorrectionsGrid(newPredictions)}

              {newPredictions.some(p => p.correction?.observations) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-semibold block mb-2" style={{ color: colors.text.dark }}>
                    Observations
                  </span>
                  <p className="text-sm" style={{ color: colors.text.primary }}>
                    {newPredictions.find(p => p.correction?.observations)?.correction?.observations}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Result
    if (record.predictions && record.predictions.length > 0) {
      const hasNewPredictions = record.newPredictionsAdded > 0;

      // Split into previous and newly added predictions
      const previousPredictions = hasNewPredictions
        ? record.predictions.slice(0, record.predictions.length - record.newPredictionsAdded)
        : [];
      const newPredictions = hasNewPredictions
        ? record.addedPredictions || record.predictions.slice(-record.newPredictionsAdded)
        : record.predictions;

      const renderPredictionsGrid = (predictions, showCorrections = true) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {predictions.map((prediction, index) => {
            const formattedPrediction = getFormattedClassName(prediction.prediction);
            const generalClass = getGeneralClass(prediction.prediction);
            const predictionBadgeType = getPredictionClassBadgeType(generalClass || prediction.prediction);
            const confidenceBadgeType = getConfidenceBadgeType(prediction.confidencePercentage);

            return (
              <div
                key={prediction.predictionId || index}
                className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-100 rounded-md mb-3 overflow-hidden">
                  <PredictionImage
                    imageUrl={prediction.imageUrl}
                    imagePath={prediction.imagePath}
                    alt={`Prediction ${index + 1}`}
                    className="w-full h-full object-cover"
                    showFilename={false}
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                      File
                    </span>
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: colors.text.primary }}
                      title={prediction.imagePath}
                    >
                      {prediction.imagePath ? extractShortFilename(prediction.imagePath) : `Image ${index + 1}`}
                    </p>
                  </div>

                  {/* Original prediction (always shown) */}
                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                      {showCorrections && prediction.correction ? 'Original Prediction' : 'Prediction'}
                    </span>
                    <Badge type={predictionBadgeType}>
                      {formattedPrediction}
                    </Badge>
                  </div>

                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                      Confidence
                    </span>
                    <Badge type={confidenceBadgeType}>
                      {formatConfidenceText(prediction.confidencePercentage)}
                    </Badge>
                  </div>

                  {/* Correction, if any */}
                  {showCorrections && prediction.correction && (
                    <div>
                      <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                        Corrected To
                      </span>
                      <Badge type={getPredictionClassBadgeType(getGeneralClass(prediction.correction.correctedPrediction) || prediction.correction.correctedPrediction)}>
                        {getFormattedClassName(prediction.correction.correctedPrediction)}
                      </Badge>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                      Dilution
                    </span>
                    <p className="text-sm" style={{ color: colors.text.primary }}>
                      {formatDilution(prediction.dilution)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );

      return (
        <div>
          {/* Final results (newly added images) */}
          {hasNewPredictions && (
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
                <span className="text-lg font-semibold" style={{ color: colors.text.dark }}>
                  Final Results
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium" style={{ color: colors.text.secondary }}>Date:</span>
                  <span className="text-base font-medium" style={{ color: colors.text.secondary }}>
                    {record.dateTime ? formatDateTime(record.dateTime) : '-'}
                  </span>
                </div>
              </div>
              {renderPredictionsGrid(newPredictions)}
            </div>
          )}

          {/* Previous results (original images) */}
          {hasNewPredictions && previousPredictions.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
                <span className="text-lg font-semibold" style={{ color: colors.text.dark }}>
                  Previous Results
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium" style={{ color: colors.text.secondary }}>Date:</span>
                  <span className="text-base font-medium" style={{ color: colors.text.secondary }}>
                    {record.originalResultDateTime ? formatDateTime(record.originalResultDateTime) : '-'}
                  </span>
                </div>
              </div>
              {renderPredictionsGrid(previousPredictions)}
            </div>
          )}

          {/* No images were added: show every prediction together */}
          {!hasNewPredictions && (
            <div className="mb-6">
              <span className="text-sm font-medium block mb-3" style={{ color: colors.text.secondary }}>
                Predictions ({record.predictions.length})
              </span>
              {renderPredictionsGrid(newPredictions)}
            </div>
          )}

          {/* Additional result information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Result status - show the value at the time of the activity */}
            <div>
              <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                Result Status
              </span>
              <div className="mt-1">
                <Badge type={getValidationBadgeType(
                  isCreateActivity
                    ? (record.fieldChanges?.find(c => c.fieldName === 'status')?.newValue || record.resultStatus)
                    : record.resultStatus
                )}>
                  {formatFieldValue('status',
                    isCreateActivity
                      ? (record.fieldChanges?.find(c => c.fieldName === 'status')?.newValue || record.resultStatus)
                      : record.resultStatus
                  )}
                </Badge>
              </div>
            </div>

            {/* Result date and time - show the value at the time of the activity */}
            {!hasNewPredictions && (
              <div>
                <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Date and Time
                </span>
                <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                  {isCreateActivity
                    ? formatDateTime(record.dateTime)
                    : (record.resultDateTime ? formatDateTime(record.resultDateTime) : '-')}
                </p>
              </div>
            )}

            {/* Observations - show the value at the time of the activity */}
            {(() => {
              let observationsValue = '';
              if (isCreateActivity) {
                // On create, show the initial observations (from the new value)
                const obsChange = record.fieldChanges?.find(c => c.fieldName === 'observations');
                observationsValue = obsChange?.newValue || '';
              } else {
                // Otherwise, show the current observations
                observationsValue = record.resultObservations || '';
              }

              return observationsValue ? (
                <div className="md:col-span-2">
                  <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                    Analysis Observations
                  </span>
                  <p className="text-base mt-1 p-3 bg-gray-50 rounded-md" style={{ color: colors.text.primary }}>
                    {observationsValue}
                  </p>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <p className="text-sm text-gray-500">
          {entityTypeLabel || 'No information available'}
        </p>
      </div>
    );
  };

  const getEntityTitle = () => {
    const { affectedUserName } = record;

    if (affectedUserName) return 'User Information';
    if (isCorrectionEntity) return 'Correction Information';
    if (record.predictions && record.predictions.length > 0) return 'Result Information';
    return 'Entity Information';
  };

  const renderFieldChanges = () => {
    const { fieldChanges, activityType } = record;

    // Filter out fields that are not shown (IDs and patient fields)
    const filteredChanges = fieldChanges?.filter(change =>
      change.fieldName !== 'patientId' &&
      change.fieldName !== 'predictionId' &&
      change.fieldName !== 'resultId' &&
      change.fieldName !== 'userId' &&
      change.fieldName !== 'correctedResultId' &&
      change.fieldName !== 'patientFullName' &&
      change.fieldName !== 'patientDocumentType' &&
      change.fieldName !== 'patientDocumentNumber' &&
      change.fieldName !== 'patientGender' &&
      change.fieldName !== 'patientBirthDate' &&
      change.fieldName !== 'patientEmail' &&
      change.fieldName !== 'patientPhonePrefix' &&
      change.fieldName !== 'patientPhoneNumber'
    ) || [];

    // Corrections come from record.predictions, not from fieldChanges
    const hasCorrectionsData = record.predictions && record.predictions.length > 0 &&
                                record.predictions.some(pred => pred.correction);

    const passwordResetDescription = describePasswordReset(record);
    if (passwordResetDescription && filteredChanges.length === 0) {
      return (
        <div className="text-sm text-center py-4 bg-gray-50 rounded-lg" style={{ color: colors.text.primary }}>
          {passwordResetDescription}
        </div>
      );
    }

    if (filteredChanges.length === 0 && !hasCorrectionsData) {
      return (
        <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
          {activityType === ACTIVITY_TYPES.CREATE
            ? 'This is a create activity. All the information is shown in the section above.'
            : activityType === ACTIVITY_TYPES.DELETE
            ? 'This is a delete activity. The deleted information is shown in the section above.'
            : 'No specific field changes were recorded for this activity.'}
        </div>
      );
    }

    // When both originalPrediction and correctedPrediction changed, show them as one pair
    const originalPredChange = filteredChanges.find(c => c.fieldName === 'originalPrediction');
    const correctedPredChange = filteredChanges.find(c => c.fieldName === 'correctedPrediction');
    const shouldGroupPredictions = originalPredChange && correctedPredChange;

    // Skip the grouped prediction fields and the raw 'corrections' field
    const otherChanges = filteredChanges.filter(c => {
      if (shouldGroupPredictions && (c.fieldName === 'originalPrediction' || c.fieldName === 'correctedPrediction')) {
        return false;
      }
      if (c.fieldName === 'corrections') {
        return false; // Rendered separately above
      }
      return true;
    });

    return (
      <div className="space-y-3">
        {/* 1. Individual corrections first */}
        {hasCorrectionsData && record.predictions.filter(pred => pred.correction).map((prediction, index) => {
          const formattedOriginal = getFormattedClassName(prediction.prediction);
          const formattedCorrected = getFormattedClassName(prediction.correction.correctedPrediction);
          const fileName = prediction.imagePath ? extractShortFilename(prediction.imagePath) : `Image ${index + 1}`;

          return (
            <div
              key={prediction.predictionId || index}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              style={{ borderColor: colors.border.light }}
            >
              {/* Field header */}
              <div
                className="px-4 py-2 border-b"
                style={{
                  backgroundColor: colors.background.subtle,
                  borderColor: colors.border.light
                }}
              >
                <h5 className="text-sm font-semibold" style={{ color: colors.text.dark }}>
                  Correction: {fileName}
                </h5>
              </div>

              {/* Previous and new values */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-y md:divide-y-0" style={{ borderColor: colors.border.light }}>
                <div className="px-4 py-3 bg-red-50">
                  <span className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: colors.primary.red }}>
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
                    Original Prediction
                  </span>
                  <p className="text-sm mt-2 font-medium min-h-[24px]">
                    <span className="text-red-700">
                      {formattedOriginal}
                    </span>
                  </p>
                </div>
                <div className="px-4 py-3 bg-green-50">
                  <span className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: colors.text.success }}>
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    Corrected To
                  </span>
                  <p className="text-sm mt-2 font-medium min-h-[24px]">
                    <span className="text-green-700 font-semibold">
                      {formattedCorrected}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* 2. Grouped original/corrected prediction (single corrections) */}
        {shouldGroupPredictions && (
          <div
            className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            style={{ borderColor: colors.border.light }}
          >
            {/* Field header */}
            <div
              className="px-4 py-2 border-b"
              style={{
                backgroundColor: colors.background.subtle,
                borderColor: colors.border.light
              }}
            >
              <h5 className="text-sm font-semibold" style={{ color: colors.text.dark }}>
                Prediction Correction
              </h5>
            </div>

            {/* One row: original (left) and corrected (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-y md:divide-y-0" style={{ borderColor: colors.border.light }}>
              <div className="px-4 py-3 bg-red-50">
                <span className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: colors.primary.red }}>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
                  Original Prediction
                </span>
                <p className="text-sm mt-2 font-medium min-h-[24px]">
                  <span className="text-red-700">
                    {formatFieldValue('originalPrediction', originalPredChange.newValue)}
                  </span>
                </p>
              </div>
              <div className="px-4 py-3 bg-green-50">
                <span className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: colors.text.success }}>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  Corrected Prediction
                </span>
                <p className="text-sm mt-2 font-medium min-h-[24px]">
                  <span className="text-green-700 font-semibold">
                    {formatFieldValue('correctedPrediction', correctedPredChange.newValue)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. Remaining field changes */}
        {otherChanges.map((change, index) => {
          const isDeletion = change.previousValue && !change.newValue;

          const formattedPreviousValue = formatFieldValue(change.fieldName, change.previousValue);
          const formattedNewValue = formatFieldValue(change.fieldName, change.newValue);

          return (
            <div
              key={index}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              style={{ borderColor: colors.border.light }}
            >
              {/* Field header */}
              <div
                className="px-4 py-2 border-b"
                style={{
                  backgroundColor: colors.background.subtle,
                  borderColor: colors.border.light
                }}
              >
                <h5 className="text-sm font-semibold" style={{ color: colors.text.dark }}>
                  {change.fieldLabel || change.fieldName}
                </h5>
              </div>

              {/* Previous and new values */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-y md:divide-y-0" style={{ borderColor: colors.border.light }}>
                <div className="px-4 py-3 bg-red-50">
                  <span className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: colors.primary.red }}>
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
                    Previous Value
                  </span>
                  <p className="text-sm mt-2 font-medium min-h-[24px]">
                    <span className={isDeletion ? 'line-through text-red-600' : 'text-red-600'}>
                      {formattedPreviousValue}
                    </span>
                  </p>
                </div>
                <div className="px-4 py-3 bg-green-50">
                  <span className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color: colors.text.success }}>
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    New Value
                  </span>
                  <p className="text-sm mt-2 font-medium min-h-[24px]">
                    <span className="text-green-700 font-semibold">
                      {formattedNewValue}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ModalBase
      isOpen
      onClose={onClose}
      title="Record Details"
      subtitle="Full details of this activity."
      icon={FileText}
      footer={
        <div className="flex justify-end">
          <Button variant="primary" size="medium" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex justify-center items-center py-12" role="status">
          <LoadingSpinner size="lg" type="circle" color="red" label={null} />
          <span className="ml-3 text-gray-600">Loading record…</span>
        </div>
      ) : error || !record ? (
        <div className="px-8 py-6">
          <InlineError message={error || 'Could not load the audit record details.'} onRetry={onRetry} />
        </div>
      ) : (
        <div className="px-8 py-6">
          <DetailSection title="General Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Date and Time
                </span>
                <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                  {formatDateTime(record.dateTime)}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Activity Type
                </span>
                <div className="mt-1">
                  <Badge type={getActivityBadgeType(record.activityType)}>
                    {record.activityTypeLabel || formatActivityType(record.activityType) || 'Not specified'}
                  </Badge>
                </div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Performed By">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Name
                </span>
                <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                  {record.userName || '-'}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Role
                </span>
                <div className="mt-1">
                  <RoleBadge role={record.userRole} label={formatActorRole(record.userRole, record.userName)} />
                </div>
              </div>
            </div>
          </DetailSection>

          {/* Associated patient, if any */}
          {record.patientName && (
            <DetailSection title="Patient Information">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                    Full Name
                  </span>
                  <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                    {record.patientName || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                    Document Type
                  </span>
                  <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                    {formatDocumentType(record.patientDocumentType) || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                    Document Number
                  </span>
                  <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                    {record.patientDocument || '-'}
                  </p>
                </div>
                {record.patientGender && (
                  <div>
                    <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                      Gender
                    </span>
                    <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                      {formatFieldValue('gender', record.patientGender)}
                    </p>
                  </div>
                )}
                {record.patientBirthDate && (
                  <div>
                    <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                      Date of Birth
                    </span>
                    <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                      {formatFieldValue('birthDate', record.patientBirthDate)}
                    </p>
                  </div>
                )}
                {record.patientEmail && (
                  <div>
                    <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                      Email
                    </span>
                    <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                      {record.patientEmail}
                    </p>
                  </div>
                )}
                {(record.patientPhonePrefix || record.patientPhoneNumber) && (
                  <div>
                    <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                      Phone Number
                    </span>
                    <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                      {record.patientPhonePrefix && record.patientPhoneNumber
                        ? `${record.patientPhonePrefix} ${record.patientPhoneNumber}`
                        : record.patientPhoneNumber || '-'}
                    </p>
                  </div>
                )}
              </div>
            </DetailSection>
          )}

          {/* Affected entity (user, correction or result) */}
          <DetailSection title={getEntityTitle()}>
            {renderEntityInfo()}
          </DetailSection>

          {/* Activity details (changed fields) */}
          <DetailSection title="Activity Details" className="mb-6">

            {renderFieldChanges()}
          </DetailSection>
        </div>
      )}
    </ModalBase>
  );
};

export default RecordDetailModal;
