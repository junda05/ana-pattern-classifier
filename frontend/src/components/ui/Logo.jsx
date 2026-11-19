import React from 'react';
import PropTypes from 'prop-types';
import { colors } from '../../config/colors';

const HEIGHTS = { small: 48, medium: 96, large: 144 };
const FONT = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';

/**
 * Typographic product logo: an "ANA" monogram tile, optionally followed by the product name.
 * Pure SVG, so it scales cleanly and needs no image assets.
 *
 * Pass `decorative` where the product name is already present as text nearby: the logo is
 * then hidden from assistive technology instead of being announced twice.
 */
const Logo = ({ size = 'medium', tone = 'brand', showName = true, decorative = false, className = '', ...props }) => {
  const height = HEIGHTS[size] ?? HEIGHTS.medium;
  const inverse = tone === 'inverse';
  const viewWidth = showName ? 430 : 100;

  return (
    <svg
      {...(decorative
        ? { 'aria-hidden': 'true' }
        : { role: 'img', 'aria-label': 'ANA Pattern Classifier' })}
      viewBox={`0 0 ${viewWidth} 100`}
      height={height}
      width={(height * viewWidth) / 100}
      className={className}
      {...props}
    >
      <rect width="100" height="100" rx="18" fill={inverse ? colors.background.white : colors.primary.red} />
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="34"
        fontWeight="700"
        fill={inverse ? colors.primary.red : colors.text.white}
      >
        ANA
      </text>
      {showName && (
        <g fontFamily={FONT} fontSize="30" fill={inverse ? colors.text.white : colors.text.dark}>
          <text x="120" y="46" fontWeight="700">ANA Pattern</text>
          <text x="120" y="82">Classifier</text>
        </g>
      )}
    </svg>
  );
};

Logo.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  tone: PropTypes.oneOf(['brand', 'inverse']),
  showName: PropTypes.bool,
  decorative: PropTypes.bool,
  className: PropTypes.string,
};

export default Logo;
