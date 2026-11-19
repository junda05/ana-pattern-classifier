/**
 * Color palette of ANA Pattern Classifier.
 * The values live in `tokens.js` (the single design-token source, shared with Tailwind);
 * this module re-exports them with the shape the components import.
 */
import tokens from './tokens';

export const { colors, shadows } = tokens;

/**
 * Custom Tailwind class strings
 */
export const customClasses = {
  // Brand-styled inputs
  input: 'w-full px-5 border border-gray-300 border-l-4 border-l-brand-red rounded bg-gray-50 text-base font-sans transition-all duration-300 ease-in-out focus:outline-none focus:border-brand-red focus:shadow-lg focus:shadow-brand-red/10 focus:bg-white hover:bg-white hover:border-brand-red',
  
  // Buttons
  button: {
    primary: 'py-2 px-8 border-0 rounded-md text-base font-semibold cursor-pointer transition-all duration-300 ease-in-out tracking-wider bg-brand-red text-white hover:bg-brand-red-hover hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-red/30',
    secondary: 'py-2 px-8 border border-brand-red rounded-md text-base font-semibold cursor-pointer transition-all duration-300 ease-in-out tracking-wider bg-white text-brand-red hover:bg-brand-red hover:text-white',
  },
  
  // Containers
  container: {
    main: 'flex h-screen md:flex-row flex-col',
    form: 'flex-1 bg-white p-8 md:p-8 p-6 flex flex-col justify-center relative md:h-auto h-3/4',
    brand: 'flex-1 bg-brand-red flex flex-col justify-center items-center p-8 md:p-8 p-4 relative md:h-auto h-1/4',
  }
};

