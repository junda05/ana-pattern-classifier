import React, { useEffect, useRef, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { RotateCcw } from 'lucide-react';
import { colors } from '../../config/colors';
import LoadingSpinner from './LoadingSpinner';
import useAuthorizedImage from '../../hooks/useAuthorizedImage';

// Stable reference so the listener can be removed (a new arrow function never matches)
const preventContextMenu = (event) => event.preventDefault();

/**
 * Interactive canvas image viewer.
 * Supports zoom (Ctrl + mouse wheel) and pan (drag).
 */
const InteractiveImageCanvas = ({
  imageUrl,
  alt = 'Image',
  className = '',
  showControls = true
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  
  const { src, error: downloadError } = useAuthorizedImage(imageUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  const [transform, setTransform] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0
  });
  
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0
  });

  const eventRef = useRef({
    isMouseDown: false,
    startTransform: null
  });

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const image = imageRef.current;
    
    if (!canvas || !container || !image || !image.complete) return;
    
    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(transform.scale, 0, 0, transform.scale, transform.translateX, transform.translateY);
    
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const imgAspect = imageDimensions.width / imageDimensions.height;
    const canvasAspect = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight;
    
    // Scale the image to cover the whole container (like background-size: cover)
    if (imgAspect > canvasAspect) {
      // Wider image: fit to height
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * imgAspect;
    } else {
      // Taller image: fit to width
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imgAspect;
    }
    
    // Draw centered
    const drawX = (canvasWidth - drawWidth) / 2;
    const drawY = (canvasHeight - drawHeight) / 2;
    
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  }, [transform, imageDimensions]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) return;
      
      const worldX = (mouseX - transform.translateX) / transform.scale;
      const worldY = (mouseY - transform.translateY) / transform.scale;
      
      const zoomFactor = e.deltaY > 0 ? 0.85 : 1.15;
      const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.05), 8);
      
      if (Math.abs(newScale - transform.scale) < 0.001) return;
      
      const newTranslateX = mouseX - worldX * newScale;
      const newTranslateY = mouseY - worldY * newScale;
      
      if (!isFinite(newScale) || !isFinite(newTranslateX) || !isFinite(newTranslateY)) return;
      
      setTransform({
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY
      });
    }
  }, [transform]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    
    eventRef.current.isMouseDown = true;
    eventRef.current.startTransform = { ...transform };
    
    dragStateRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY
    };
    
    e.preventDefault();
  }, [transform]);

  const handleMouseMove = useCallback((e) => {
    if (!dragStateRef.current.isDragging || !eventRef.current.isMouseDown) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - dragStateRef.current.lastX;
    const deltaY = e.clientY - dragStateRef.current.lastY;
    
    if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
      setTransform(prev => {
        const newTranslateX = prev.translateX + deltaX;
        const newTranslateY = prev.translateY + deltaY;
        
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return prev;
        
        const rect = canvas.getBoundingClientRect();
        const maxPan = Math.max(rect.width, rect.height) * 2;
        
        return {
          ...prev,
          translateX: Math.max(-maxPan, Math.min(maxPan, newTranslateX)),
          translateY: Math.max(-maxPan, Math.min(maxPan, newTranslateY))
        };
      });
      
      dragStateRef.current.lastX = e.clientX;
      dragStateRef.current.lastY = e.clientY;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    eventRef.current.isMouseDown = false;
    eventRef.current.startTransform = null;
    
    dragStateRef.current = {
      isDragging: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0
    };
  }, []);

  const resetTransform = useCallback(() => {
    setTransform({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  }, []);

  // Decode the downloaded (or local) image once its URL is available
  useEffect(() => {
    resetTransform();
    if (!src) {
      setIsLoading(!downloadError);
      return undefined;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    const img = new Image();
    img.onload = () => {
      if (!active) return;
      imageRef.current = img;
      setImageDimensions({ width: img.width, height: img.height });
      setIsLoading(false);
    };
    img.onerror = () => {
      if (!active) return;
      setError('Could not load the image.');
      setIsLoading(false);
    };
    img.src = src;

    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, downloadError, resetTransform]);

  useEffect(() => {
    if (!isLoading && imageDimensions.width > 0) {
      drawImage();
    }
  }, [transform, imageDimensions, isLoading, drawImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initializeEvents = () => {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      canvas.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('contextmenu', preventContextMenu);
    };

    if (canvas.getBoundingClientRect().width > 0) {
      initializeEvents();
    } else {
      const timer = setTimeout(initializeEvents, 50);
      return () => {
        clearTimeout(timer);
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('contextmenu', preventContextMenu);
      };
    }

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        drawImage();
      }, 100);
    });

    resizeObserver.observe(container);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [drawImage]);

  const displayError = error || (downloadError ? 'Could not load the image.' : null);

  if (displayError) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ minHeight: '200px' }}
      >
        <p className="text-red-600 text-sm">{displayError}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="relative bg-gray-100 rounded-lg overflow-hidden"
        style={{ 
          width: '100%',
          height: '100%',
          cursor: dragStateRef.current.isDragging ? 'grabbing' : 'grab'
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <LoadingSpinner size="lg" type="circle" color="primary" label="Loading image…" />
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          role="img"
          aria-label={alt}
        />
      </div>

      {showControls && (
        <div className="absolute top-4 right-4 z-20">
          <button
            type="button"
            onClick={resetTransform}
            aria-label="Reset view"
            className="p-2.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 backdrop-blur-md shadow-lg border"
            style={{
              backgroundColor: colors.background.frosted,
              border: `1px solid ${colors.border.light}`
            }}
            title="Reset view"
          >
            <RotateCcw
              size={20}
              style={{ color: colors.text.secondary }}
            />
          </button>
        </div>
      )}
    </div>
  );
};

InteractiveImageCanvas.propTypes = {
  imageUrl: PropTypes.string.isRequired,
  alt: PropTypes.string,
  className: PropTypes.string,
  showControls: PropTypes.bool
};

export default InteractiveImageCanvas;
