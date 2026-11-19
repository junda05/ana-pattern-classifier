import React from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../../config/colors';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ModalBase from '../ui/ModalBase';
import LoadingSpinner from '../ui/LoadingSpinner';
import PredictionImage from '../ui/PredictionImage';
import { FileText } from 'lucide-react';
import { getFormattedClassName } from '../../config/classMapping';
import { getConfidenceBadgeType, formatConfidenceText, getPredictionClassBadgeType, getConfidenceColors } from '../../config/confidenceConfig';
import { formatFieldValue, getValidationBadgeType } from '../../services/utils/traceabilityUtils';
import { formatDate } from '../../services/utils/dateUtils';
import { formatDilution, formatDocumentWithNumber, formatGender, extractShortFilename } from '../../services/utils/constants';

/**
 * Full details of an exam awaiting verification, including every per-image
 * prediction.
 */
const ExamDetailModal = ({ exam, onClose, onVerify, isLoading = false }) => {
  const navigate = useNavigate();

  if (!exam && !isLoading) return null;

  return (
    <ModalBase
      isOpen={!!exam || isLoading}
      onClose={onClose}
      title="Exam Details"
      subtitle="Awaiting professional verification."
      icon={FileText}
      maxWidth="max-w-4xl"
      footer={
        !isLoading && exam && (
          <div className="flex justify-between gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  sessionStorage.removeItem('processedResultId');

                  // Pass only the result ID; AnalysisPage loads the full data from the API.
                  navigate('/dashboard/analysis', {
                    state: {
                      continueResultId: exam.resultId,
                      timestamp: Date.now() // Forces a refresh when the same result is reopened
                    }
                  });
                  onClose();
                }}
              >
                Continue Analysis
              </Button>
              <Button
                variant="verified"
                onClick={() => onVerify(exam.resultId)}
              >
                Verify Exam
              </Button>
            </div>
          </div>
        )
      }
    >
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner label="Loading exam…" />
        </div>
      ) : (
        <div className="px-8 py-6">
        {/* Exam information */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1 h-5 rounded-full"
              style={{ backgroundColor: colors.primary.red }}
            />
            <h4 className="text-lg font-semibold" style={{ color: colors.text.dark }}>
              General Information
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                Date and Time
              </span>
              <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                {exam.dateAndHour ? formatDate(exam.dateAndHour) : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                Status
              </span>
              <div className="mt-1">
                <Badge type={getValidationBadgeType(exam.status)}>
                  {formatFieldValue('status', exam.status)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Patient information */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1 h-5 rounded-full"
              style={{ backgroundColor: colors.primary.red }}
            />
            <h4 className="text-lg font-semibold" style={{ color: colors.text.dark }}>
              Patient Information
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                Full Name
              </span>
              <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                {exam.patient?.fullName || '-'}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                Document
              </span>
              <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                {formatDocumentWithNumber(exam.patient?.documentType, exam.patient?.documentNumber)}
              </p>
            </div>
            {exam.patient?.gender && (
              <div>
                <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Gender
                </span>
                <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                  {formatGender(exam.patient.gender)}
                </p>
              </div>
            )}
            {exam.patient?.email && (
              <div>
                <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Email
                </span>
                <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                  {exam.patient.email}
                </p>
              </div>
            )}
            {exam.patient?.phoneNumber && (
              <div>
                <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Phone Number
                </span>
                <p className="text-base mt-1" style={{ color: colors.text.primary }}>
                  {exam.patient.phonePrefix || ''} {exam.patient.phoneNumber}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Per-image predictions */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1 h-5 rounded-full"
              style={{ backgroundColor: colors.primary.red }}
            />
            <h4 className="text-lg font-semibold" style={{ color: colors.text.dark }}>
              Image Predictions ({exam.predictions?.length || 0})
            </h4>
          </div>
          {exam.predictions && exam.predictions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {exam.predictions.map((prediction, index) => (
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

                    <div>
                      <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                        Prediction
                      </span>
                      <Badge type={getPredictionClassBadgeType(prediction.prediction)}>
                        {getFormattedClassName(prediction.prediction)}
                      </Badge>
                    </div>

                    <div>
                      <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                        Confidence
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${prediction.confidencePercentage}%`,
                              backgroundColor: getConfidenceColors(prediction.confidencePercentage).bg
                            }}
                          />
                        </div>
                        <Badge type={getConfidenceBadgeType(prediction.confidencePercentage)}>
                          {formatConfidenceText(prediction.confidencePercentage)}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                        Dilution
                      </span>
                      <p className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                        {formatDilution(prediction.dilution)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto mb-3 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                No predictions are available for this exam.
              </p>
            </div>
          )}
        </div>

        {exam.observations && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: colors.primary.red }}
              />
              <h4 className="text-lg font-semibold" style={{ color: colors.text.dark }}>
                Observations
              </h4>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm" style={{ color: colors.text.primary }}>
                {exam.observations}
              </p>
            </div>
          </div>
        )}
        </div>
      )}
    </ModalBase>
  );
};

export default ExamDetailModal;
