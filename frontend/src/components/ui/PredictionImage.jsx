import React, { useState, useEffect } from 'react';
import { colors } from '../../config/colors';
import useAuthorizedImage from '../../hooks/useAuthorizedImage';

/**
 * Displays a prediction image fetched with JWT authentication.
 *
 * The API returns the full imageUrl; the image is downloaded as a blob (so the
 * auth header is sent) and rendered from an object URL that is revoked on cleanup. Shows a spinner while
 * loading and a placeholder when the image is missing or fails to load.
 *
 * @param {string} imageUrl - Full URL returned by the API
 * @param {string} imagePath - File name or path (used for the caption)
 * @param {string} alt - Alternative text for the image
 * @param {string} className - Additional CSS classes
 * @param {boolean} showFilename - Whether to show the file name below the image
 */
const PredictionImage = ({ 
  imageUrl,
  imagePath,
  alt = 'Prediction image',
  className = '',
  showFilename = false 
}) => {
  const { src: blobUrl, error: downloadError } = useAuthorizedImage(imageUrl);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [decodeError, setDecodeError] = useState(false);
  const imageError = downloadError || decodeError;

  // A new image starts loading again
  useEffect(() => {
    setImageLoaded(false);
    setDecodeError(false);
  }, [blobUrl]);

  const filename = imagePath && (imagePath.includes('/') || imagePath.includes('\\'))
    ? imagePath.split(/[/\\]/).pop()
    : imagePath;

  if (!imageUrl || imageError) {
    return (
      <div className="flex flex-col h-full">
        <div 
          className={`bg-gray-100 rounded-lg flex flex-col items-center justify-center h-full ${className}`}
          style={{ borderColor: colors.border.light }}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 text-gray-400 mb-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="1.5" 
              d={imageError 
                ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                : "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              } 
            />
          </svg>
          <span className="text-gray-400 text-xs text-center px-2">
            {imageError ? 'Could not load image' : 'No image'}
          </span>
        </div>
        {showFilename && filename && (
          <p 
            className="text-xs mt-1 truncate text-center"
            style={{ color: colors.text.secondary }}
            title={filename}
          >
            {filename}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div 
        className={`relative overflow-hidden rounded-lg border h-full ${className}`}
        style={{ borderColor: colors.border.light }}
      >
        {!imageLoaded && blobUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: colors.primary.red }}></div>
          </div>
        )}

        {blobUrl && (
          <img
            src={blobUrl}
            alt={alt}
            className={`w-full h-full object-cover ${imageLoaded ? 'block' : 'hidden'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setDecodeError(true)}
          />
        )}
      </div>

      {showFilename && filename && (
        <p 
          className="text-xs mt-1 truncate text-center"
          style={{ color: colors.text.secondary }}
          title={filename}
        >
          {filename}
        </p>
      )}
    </div>
  );
};

export default PredictionImage;
