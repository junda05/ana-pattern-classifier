import React, { useState } from 'react';
import Badge from './Badge';
import Button from './Button';
import CompareImageModal from './CompareImageModal';
import { getConfidenceBadgeType, formatConfidenceText } from '../../config/confidenceConfig';

/**
 * Grid of analyzed images with their predicted pattern and confidence.
 * Hovering an image (or tabbing to it) reveals a Compare button that opens the reference-image modal.
 */
const AnalysisResults = ({ results, className = "" }) => {
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  if (!results || results.length === 0) {
    return null;
  }

  const handleCompare = (result) => {
    setSelectedImage(result);
    setShowCompareModal(true);
  };

  return (
    <>
      <div className={className}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((result, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-gray-100 rounded-md mb-3 overflow-hidden relative group">
                <img
                  src={result.imageUrl}
                  alt={`Result ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Compare button, shown on hover and on keyboard focus */}
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="primary"
                    onClick={() => handleCompare(result)}
                    className="shadow-lg"
                  >
                    Compare
                  </Button>
                </div>
              </div>
            
            <div className="text-center">
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">
                {result.fileName}
              </h4>
              
              <div className="mb-2">
                <Badge type={getConfidenceBadgeType(result.confidence)}>
                  {formatConfidenceText(result.confidence)}
                </Badge>
              </div>
              
              {result.formattedPattern && (
                <p className="text-sm text-gray-600">
                  Pattern: {result.formattedPattern}
                </p>
              )}
              
              {result.details && (
                <p className="text-sm text-gray-500 mt-1">
                  {result.details}
                </p>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>

      <CompareImageModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        selectedImage={selectedImage}
      />
    </>
  );
};

export default AnalysisResults;
