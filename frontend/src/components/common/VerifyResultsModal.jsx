import React, { useEffect, useState } from 'react';
import { colors } from '../../config/colors';
import ModalBase from '../ui/ModalBase';
import SimpleClassSelector from '../ui/SimpleClassSelector';
import Button from '../ui/Button';
import PredictionImage from '../ui/PredictionImage';
import CompareImageModal from '../ui/CompareImageModal';
import Badge from '../ui/Badge';
import { CheckCircle, AlertCircle, FileEdit } from 'lucide-react';
import { getFormattedClassName } from '../../config/classMapping';
import { extractShortFilename, formatDocumentTypeShort } from '../../services/utils/constants';
import { pluralize } from '../../services/utils/stringUtils';

// Correction keys: saved predictions by prediction id, new results by image id
const existingKey = (predictionId) => `existing:${predictionId}`;
const newKey = (imageId) => `new:${imageId}`;

/**
 * Lets the user confirm or correct the classification results of an analysis.
 *
 * Flow:
 * 1. Asks whether the classification is correct.
 * 2. "Confirm" runs onConfirm and closes the modal.
 * 3. "Correct" expands a form with a SimpleClassSelector per image.
 *
 * Handles both existing predictions (when an exam is continued) and newly
 * analyzed results (successfully analyzed ones only, each with its image id).
 * onConfirm/onCorrect resolve to true on success; the modal stays open otherwise.
 * With `correctionOnly` (a locked result an administrator corrects) it opens on the
 * correction form, since there is nothing left to confirm.
 */
const VerifyResultsModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  onCorrect,
  results = [],
  existingPredictions = [], // Predictions already saved when an exam is continued
  patient = null,
  correctionOnly = false
}) => {
  const [correctionRequested, setCorrectionRequested] = useState(false);
  const showCorrectionForm = correctionOnly || correctionRequested;
  const [corrections, setCorrections] = useState({});
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedImageForCompare, setSelectedImageForCompare] = useState(null);

  const handleReset = () => {
    setCorrectionRequested(false);
    setCorrections({});
    setObservations('');
    setIsSubmitting(false);
  };

  // Closed by the page (e.g. after a save conflict): open fresh next time
  useEffect(() => {
    if (!isOpen) handleReset();
  }, [isOpen]);

  // The modal cannot be dismissed while a save is running (Escape, close button, overlay or Cancel)
  const handleClose = () => {
    if (isSubmitting) return;
    handleReset();
    onClose();
  };

  const closeAfterSave = () => {
    handleReset();
    onClose();
  };

  /**
   * Confirms the results without corrections.
   */
  const handleConfirm = async () => {
    setIsSubmitting(true);
    const saved = await onConfirm();
    setIsSubmitting(false);
    if (saved) closeAfterSave();
  };

  const handleShowCorrection = () => {
    setCorrectionRequested(true);
  };

  const handleCorrectionChange = (imageIndex, correctedValue) => {
    setCorrections(prev => ({
      ...prev,
      [imageIndex]: correctedValue
    }));
  };

  const handleSubmitCorrections = async () => {
    const newCorrections = {};
    const existingCorrections = {};
    Object.entries(corrections).forEach(([key, value]) => {
      if (!value) return;
      const separator = key.indexOf(':');
      const id = key.slice(separator + 1);
      if (key.slice(0, separator) === 'new') newCorrections[id] = value;
      else existingCorrections[id] = value;
    });

    setIsSubmitting(true);
    const saved = await onCorrect({ newCorrections, existingCorrections, observations });
    setIsSubmitting(false);
    if (saved) closeAfterSave();
  };

  // Notes are stored with the corrections, so they alone cannot be saved
  const hasPendingCorrections = () => Object.values(corrections).some(Boolean);

  const handleCompareImage = (imageData) => {
    setSelectedImageForCompare(imageData);
    setShowCompareModal(true);
  };

  return (
    <>
    <ModalBase
      isOpen={isOpen}
      onClose={handleClose}
      title={showCorrectionForm ? 'Correct Classification' : 'Confirm Classification?'}
      icon={showCorrectionForm ? FileEdit : CheckCircle}
      maxWidth={showCorrectionForm ? "max-w-7xl" : "max-w-md"}
      closeOnOverlayClick={!showCorrectionForm && !isSubmitting}
      closeOnEscape={!isSubmitting}
      showCloseButton={!isSubmitting}
      footer={showCorrectionForm && (
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          
          <Button
            variant="primary"
            onClick={handleSubmitCorrections}
            disabled={!hasPendingCorrections()}
            loading={isSubmitting}
          >
            Save Corrections
          </Button>
        </div>
      )}
    >
      <div className={showCorrectionForm ? "px-8 py-6" : "px-6 py-4"}>
        {!showCorrectionForm ? (
          /* Initial view: confirmation prompt */
          <div className="text-center py-4">
            <div 
              className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: `${colors.primary.red}15` }}
            >
              <AlertCircle size={24} style={{ color: colors.primary.red }} />
            </div>
            
            <p className="text-gray-700 text-base mb-2">
              {existingPredictions.length > 0 && results.length > 0 ? (
                <>{pluralize(existingPredictions.length, 'existing prediction')} found and {pluralize(results.length, 'new image')} analyzed.</>
              ) : existingPredictions.length > 0 ? (
                <>{pluralize(existingPredictions.length, 'existing prediction')} found.</>
              ) : (
                <>{pluralize(results.length, 'image')} analyzed.</>
              )}
            </p>
            <p className="text-gray-600 text-sm mb-6">
              Are the classification results correct?
            </p>

            <div className="flex gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={handleShowCorrection}
                disabled={isSubmitting}
              >
                <FileEdit size={18} className="mr-2" />
                Correct
              </Button>
              
              <Button
                variant="primary"
                onClick={handleConfirm}
                loading={isSubmitting}
              >
                <CheckCircle size={18} className="mr-2" aria-hidden="true" />
                Confirm
              </Button>
            </div>
          </div>
        ) : (
          /* Expanded view: correction form */
          <div className="space-y-6">
            <div 
              className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6"
            >
              <p className="text-sm text-blue-800">
                <strong>Instructions:</strong> Select the correct classification for each image that
                needs a correction. Images you leave unchanged keep their original result.
              </p>
            </div>

            {/* Patient information */}
            {patient && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div 
                    className="w-1 h-5 rounded-full"
                    style={{ backgroundColor: colors.primary.red }}
                  />
                  <h3 className="text-lg font-semibold" style={{ color: colors.text.dark }}>
                    Patient Information
                  </h3>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs font-medium" style={{ color: colors.text.secondary }}>
                        Full Name
                      </span>
                      <p className="text-sm mt-1 font-medium" style={{ color: colors.text.primary }}>
                        {patient.fullName || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium" style={{ color: colors.text.secondary }}>
                        Document Type
                      </span>
                      <div className="mt-1">
                        <Badge type="neutral" size="sm">
                          {formatDocumentTypeShort(patient.documentType) || '-'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium" style={{ color: colors.text.secondary }}>
                        Document Number
                      </span>
                      <p className="text-sm mt-1 font-medium" style={{ color: colors.text.primary }}>
                        {patient.documentNumber || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results to correct */}
            <div className="space-y-6">
              {/* Existing predictions */}
              {existingPredictions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div 
                      className="w-1 h-5 rounded-full"
                      style={{ backgroundColor: colors.primary.red }}
                    />
                    <h3 className="text-lg font-semibold" style={{ color: colors.text.dark }}>
                      Existing Predictions ({existingPredictions.length})
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {existingPredictions.map((prediction, index) => (
                      <div 
                        key={`existing-${prediction.predictionId || index}`}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        style={{ borderColor: colors.border.light }}
                      >
                        <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden relative group">
                          <PredictionImage
                            imageUrl={prediction.imageUrl}
                            imagePath={prediction.imagePath}
                            alt={prediction.imagePath ? extractShortFilename(prediction.imagePath) : `Prediction ${index + 1}`}
                            className="w-full h-full object-cover"
                            showFilename={false}
                          />
                          {/* Compare button, shown on hover and on keyboard focus */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 focus-within:bg-opacity-40 flex items-center justify-center transition-opacity rounded-lg opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              variant="primary"
                              onClick={() => handleCompareImage({
                                imageUrl: prediction.imageUrl,
                                imagePath: prediction.imagePath,
                                fileName: prediction.imagePath ? extractShortFilename(prediction.imagePath) : `Prediction ${index + 1}`,
                                prediction: prediction.prediction,
                                confidence: prediction.confidencePercentage,
                                formattedPattern: getFormattedClassName(prediction.prediction)
                              })}
                              className="shadow-lg"
                            >
                              Compare
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-700 block mb-1 truncate" title={prediction.imagePath ? extractShortFilename(prediction.imagePath) : `Prediction ${index + 1}`}>
                              {prediction.imagePath ? extractShortFilename(prediction.imagePath) : `Prediction ${index + 1}`}
                            </span>
                            {prediction.confidencePercentage !== undefined && (
                              <span className="text-xs text-gray-500 block mb-2">
                                Confidence: {prediction.confidencePercentage}%
                              </span>
                            )}
                            {/* Current prediction, highlighted */}
                            <div className="mt-2">
                              <span className="text-xs font-medium text-gray-600 block mb-1">
                                Pattern:
                              </span>
                              <span
                                className="inline-block text-xs font-medium px-2.5 py-1.5 rounded-lg"
                                style={{
                                  backgroundColor: `${colors.primary.red}10`,
                                  color: colors.primary.red,
                                  border: `1px solid ${colors.primary.red}30`
                                }}
                              >
                                {getFormattedClassName(prediction.prediction)}
                              </span>
                            </div>
                          </div>

                          <SimpleClassSelector
                            label="Corrected Classification"
                            ariaLabel={`Corrected classification for ${prediction.imagePath ? extractShortFilename(prediction.imagePath) : `prediction ${index + 1}`}`}
                            value={corrections[existingKey(prediction.predictionId)] || ''}
                            onChange={(e) => handleCorrectionChange(existingKey(prediction.predictionId), e.target.value)}
                            placeholder="Keep original prediction"
                            excludedValue={prediction.prediction}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New results */}
              {results.length > 0 && (
                <div>
                  {existingPredictions.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-1 h-5 rounded-full"
                        style={{ backgroundColor: colors.primary.red }}
                      />
                      <h3 className="text-lg font-semibold" style={{ color: colors.text.dark }}>
                        New Results ({results.length})
                      </h3>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.map((result, index) => (
                      <div 
                        key={result.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        style={{ borderColor: colors.border.light }}
                      >
                        {result.imageUrl ? (
                          <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden relative group">
                            <img 
                              src={result.imageUrl} 
                              alt={result.fileName || `Image ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {/* Compare button, shown on hover and on keyboard focus */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 focus-within:bg-opacity-40 flex items-center justify-center transition-opacity rounded-lg opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                              <Button
                                variant="primary"
                                onClick={() => handleCompareImage({
                                  imageUrl: result.imageUrl,
                                  fileName: result.fileName || `Image ${index + 1}`,
                                  prediction: result.predictionKey,
                                  confidence: result.confidence,
                                  formattedPattern: result.formattedPattern || getFormattedClassName(result.predictionKey)
                                })}
                                className="shadow-lg"
                              >
                                Compare
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                            <span className="text-gray-400 text-xs">No image</span>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-700 block mb-1 truncate" title={result.fileName || `Image ${index + 1}`}>
                              {result.fileName || `Image ${index + 1}`}
                            </span>
                            {result.confidence !== undefined && (
                              <span className="text-xs text-gray-500 block mb-2">
                                Confidence: {result.confidence}%
                              </span>
                            )}
                            {/* Current prediction, highlighted */}
                            <div className="mt-2">
                              <span className="text-xs font-medium text-gray-600 block mb-1">
                                Pattern:
                              </span>
                              <span 
                                className="inline-block text-xs font-medium px-2.5 py-1.5 rounded-lg"
                                style={{ 
                                  backgroundColor: `${colors.primary.red}10`,
                                  color: colors.primary.red,
                                  border: `1px solid ${colors.primary.red}30`
                                }}
                              >
                                {result.formattedPattern || getFormattedClassName(result.predictionKey)}
                              </span>
                            </div>
                          </div>

                          <SimpleClassSelector
                            label="Corrected Classification"
                            ariaLabel={`Corrected classification for ${result.fileName || `image ${index + 1}`}`}
                            value={corrections[newKey(result.id)] || ''}
                            onChange={(e) => handleCorrectionChange(newKey(result.id), e.target.value)}
                            placeholder="Keep original prediction"
                            excludedValue={result.predictionKey}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <label htmlFor="verify-observations" className="block text-sm font-medium text-gray-700 mb-2">
                Correction Notes
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Saved with each correction. The result observations are edited on the analysis page.
              </p>
              <textarea
                id="verify-observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                disabled={isSubmitting}
                maxLength={1000}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ 
                  '--tw-ring-color': colors.primary.red
                }}
                rows="4"
                placeholder="Add observations about these corrections…"
              />
            </div>
          </div>
        )}
      </div>
    </ModalBase>

    {/* Image comparison */}
    <CompareImageModal
      isOpen={showCompareModal}
      onClose={() => setShowCompareModal(false)}
      selectedImage={selectedImageForCompare}
    />
    </>
  );
};

export default VerifyResultsModal;
