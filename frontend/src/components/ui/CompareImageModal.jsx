import React, { useState, useEffect, useCallback } from 'react';
import { colors } from '../../config/colors';
import Button from './Button';
import ModalBase from './ModalBase';
import ModalSelect from './ModalSelect';
import LoadingSpinner from './LoadingSpinner';
import Badge from './Badge';
import InteractiveImageCanvas from './InteractiveImageCanvas';
import filesService from '../../services/api/filesService';
import { getConfidenceBadgeType, formatConfidenceText } from '../../config/confidenceConfig';
import { getFormattedClassName, normalizePredictionToEnum } from '../../config/classMapping';
import { Images, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Modal that compares an analyzed image with the reference-image gallery
 * The gallery is keyed by pattern class (PredictionClass values); the user
 * picks a pattern and a specific reference image for visual comparison.
 * The gallery opens on the class predicted for the image when it has reference
 * images, otherwise on the first available class. When no reference images
 * exist, an empty state replaces the gallery.
 */
const CompareImageModal = ({ isOpen, onClose, selectedImage }) => {
  // { [classKey]: [{ filename, url }] } – only classes with at least one image
  const [referenceImages, setReferenceImages] = useState({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedReferenceImage, setSelectedReferenceImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSelectorsVisible, setIsSelectorsVisible] = useState(true);

  /**
   * Loads the available pattern classes and their reference images
   * - Empty class list, or every class without images → empty state
   * - A failed request (non-2xx) with nothing loaded → error with retry
   *
   * @param {string} [predictedClass] - Class predicted for the analyzed image, preselected when it has images
   */
  const loadReferenceImages = useCallback(async (predictedClass) => {
    try {
      setLoading(true);
      setError(null);
      setReferenceImages({});
      setSelectedClass('');
      setSelectedReferenceImage('');

      // Pattern classes that have a reference folder
      const classes = await filesService.getReferenceClasses();

      // Load the images of every class in parallel
      const settled = await Promise.allSettled(
        classes.map(className => filesService.getReferenceImagesByClass(className))
      );

      const imagesData = {};
      let failedRequests = 0;
      settled.forEach((outcome, index) => {
        const className = classes[index];
        if (outcome.status === 'fulfilled') {
          if (outcome.value && outcome.value.length > 0) {
            imagesData[className] = outcome.value;
          }
        } else {
          failedRequests += 1;
        }
      });

      // Real errors with nothing to show: surface them (retry button)
      if (failedRequests > 0 && Object.keys(imagesData).length === 0) {
        throw new Error('Could not load reference images');
      }

      setReferenceImages(imagesData);

      // Preselect the predicted class if it has images, otherwise the first available one
      const predictedKey = normalizePredictionToEnum(predictedClass);
      const availableClasses = Object.keys(imagesData);
      const initialClass = availableClasses.find(
        (className) => predictedKey && normalizePredictionToEnum(className) === predictedKey
      ) || availableClasses[0];
      if (initialClass) {
        setSelectedClass(initialClass);
        setSelectedReferenceImage(imagesData[initialClass][0].url);
      }
    } catch (error) {
      setError('Could not load the reference images.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the reference gallery whenever the modal opens
  const predictedClass = selectedImage?.prediction || selectedImage?.predictionKey;
  useEffect(() => {
    if (isOpen) {
      loadReferenceImages(predictedClass);
    }
  }, [isOpen, predictedClass, loadReferenceImages]);

  const hasReferenceImages = Object.keys(referenceImages).length > 0;

  /**
   * Handles a change of the selected pattern class
   */
  const handleClassChange = (e) => {
    const newClass = e.target.value;
    setSelectedClass(newClass);
    // Select the first image of the new class
    if (referenceImages[newClass] && referenceImages[newClass].length > 0) {
      setSelectedReferenceImage(referenceImages[newClass][0].url);
    }
  };

  /**
   * Handles a change of the selected reference image
   */
  const handleReferenceImageChange = (e) => {
    setSelectedReferenceImage(e.target.value);
  };

  /**
   * Renders the analyzed image panel
   */
  const renderAnalyzedImage = () => (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border" style={{ borderColor: colors.border.light }}>
      {/* Header with gradient */}
      <div className="px-4 py-2.5 border-b" style={{
        borderColor: colors.border.light,
        background: `linear-gradient(to right, ${colors.background.slate}, ${colors.background.white})`
      }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary.red }}></div>
          <h4 className="text-sm font-semibold" style={{ color: colors.text.dark }}>
            Analyzed Image
          </h4>
        </div>
      </div>

      {/* Interactive canvas */}
      <div className="flex-1 p-2">
        <InteractiveImageCanvas
          imageUrl={selectedImage?.imageUrl}
          alt={`Analyzed image: ${selectedImage?.fileName || 'Untitled'}`}
          className="h-full"
        />
      </div>

      {/* Footer with file name and details */}
      <div className="px-4 py-2.5 border-t flex justify-between items-center bg-gray-50" style={{ borderColor: colors.border.light }}>
        <div className="flex-1 min-w-0 mr-2">
          {selectedImage?.fileName && (
            <p className="text-xs truncate" style={{ color: colors.text.secondary }} title={selectedImage.fileName}>
              {selectedImage.fileName}
            </p>
          )}
          {selectedImage?.formattedPattern && (
            <p className="text-xs font-medium mt-0.5" style={{ color: colors.text.dark }}>
              {selectedImage.formattedPattern}
            </p>
          )}
        </div>
        {selectedImage?.confidence !== undefined && (
          <Badge type={getConfidenceBadgeType(selectedImage.confidence)}>
            {formatConfidenceText(selectedImage.confidence)}
          </Badge>
        )}
      </div>
    </div>
  );

  /**
   * Renders the empty state shown instead of the gallery when there are no reference images
   */
  const renderNoReferenceImages = () => (
    <div className="flex flex-col h-full items-center justify-center bg-white rounded-lg shadow-sm border p-8 text-center" style={{ borderColor: colors.border.light }}>
      <Images size={48} style={{ color: colors.text.light }} className="mx-auto mb-3" />
      <h4 className="text-lg font-semibold mb-2" style={{ color: colors.text.dark }}>
        No Reference Images Yet
      </h4>
      <p className="text-sm max-w-sm" style={{ color: colors.text.secondary }}>
        An administrator can add reference images for each pattern. You can still review the uploaded image on its own.
      </p>
    </div>
  );

  /**
   * Renders the selectors and the reference image
   */
  const renderReferenceImage = () => {
    const classOptions = Object.keys(referenceImages).map(className => ({
      value: className,
      label: getFormattedClassName(className)
    }));

    const imageOptions = selectedClass && referenceImages[selectedClass]
      ? referenceImages[selectedClass].map(image => ({
          value: image.url,
          label: filesService.getImageName(image.filename)
        }))
      : [];

    const currentImage = referenceImages[selectedClass]?.find(img => img.url === selectedReferenceImage);
    const currentImageName = currentImage ? filesService.getImageName(currentImage.filename) : '';

    return (
      <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border" style={{ borderColor: colors.border.light }}>
        {/* Header with toggle */}
        <div className="px-4 py-2.5 border-b flex justify-between items-center" style={{
          borderColor: colors.border.light,
          background: `linear-gradient(to right, ${colors.background.slate}, ${colors.background.white})`
        }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.state.success }}></div>
            <h4 className="text-sm font-semibold" style={{ color: colors.text.dark }}>
              Reference Image
            </h4>
          </div>
          <button
            onClick={() => setIsSelectorsVisible(!isSelectorsVisible)}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: isSelectorsVisible ? colors.background.selected : 'transparent'
            }}
            title={isSelectorsVisible ? 'Hide selectors' : 'Show selectors'}
          >
            {isSelectorsVisible ? (
              <ChevronUp size={16} style={{ color: colors.primary.red }} />
            ) : (
              <ChevronDown size={16} style={{ color: colors.text.secondary }} />
            )}
          </button>
        </div>

        {/* Collapsible selectors */}
        {isSelectorsVisible && (
          <div className="px-4 py-2.5 border-b bg-gray-50" style={{ borderColor: colors.border.light }}>
            <div className="grid grid-cols-2 gap-3">
              <ModalSelect
                label="Pattern"
                value={selectedClass}
                onChange={handleClassChange}
                options={classOptions}
                placeholder="Select a pattern"
              />

              {selectedClass && imageOptions.length > 0 && (
                <ModalSelect
                  label="Image"
                  value={selectedReferenceImage}
                  onChange={handleReferenceImageChange}
                  options={imageOptions}
                  placeholder="Select an image"
                />
              )}
            </div>
          </div>
        )}

        {/* Interactive canvas */}
        {selectedReferenceImage ? (
          <div className="flex-1 p-2">
            <InteractiveImageCanvas
              imageUrl={selectedReferenceImage}
              alt={`Reference image: ${currentImageName}`}
              className="h-full"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Images size={48} style={{ color: colors.text.light }} className="mx-auto mb-3" />
              <p style={{ color: colors.text.secondary }}>
                Select a pattern and a reference image.
              </p>
            </div>
          </div>
        )}

        {/* Footer with file name */}
        {selectedReferenceImage && (
          <div className="px-4 py-2.5 border-t bg-gray-50" style={{ borderColor: colors.border.light }}>
            <div className="flex justify-between items-center">
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-xs truncate" style={{ color: colors.text.secondary }} title={currentImageName}>
                  {currentImageName}
                </p>
                {selectedClass && (
                  <p className="text-xs font-medium mt-0.5" style={{ color: colors.text.dark }}>
                    Pattern: {getFormattedClassName(selectedClass)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Compare Images"
      subtitle="Hold Ctrl and scroll to zoom; drag to pan."
      icon={Images}
      maxWidth="max-w-7xl"
      footer={
        <div className="flex justify-end w-full px-2">
          <Button
            variant="primary"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="px-6 py-5" style={{ backgroundColor: colors.background.subtle }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 bg-white rounded-lg shadow-sm p-12 border" role="status" style={{
            height: '600px',
            borderColor: colors.border.light
          }}>
            <LoadingSpinner size="lg" type="circle" color="primary" label={null} />
            <p className="font-medium" style={{ color: colors.text.dark }}>
              Loading reference images…
            </p>
            <p className="text-sm" style={{ color: colors.text.secondary }}>
              Please wait a moment.
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center space-y-4 bg-white rounded-lg shadow-sm p-12 border" style={{
            height: '600px',
            borderColor: colors.border.light
          }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-100 mb-2">
              <Images size={32} className="text-red-600" />
            </div>
            <p className="text-red-600 font-medium text-lg">{error}</p>
            <p className="text-sm" style={{ color: colors.text.secondary }}>
              Something went wrong while loading the images.
            </p>
            <Button
              variant="primary"
              onClick={() => loadReferenceImages(predictedClass)}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ height: '600px' }}>
            {renderAnalyzedImage()}
            {hasReferenceImages ? renderReferenceImage() : renderNoReferenceImages()}
          </div>
        )}
      </div>
    </ModalBase>
  );
};

export default CompareImageModal;
