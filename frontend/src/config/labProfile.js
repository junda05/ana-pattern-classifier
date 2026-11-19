/**
 * Laboratory identity printed in the header of clinical reports.
 * Configure per deployment through environment variables.
 */
export const labProfile = {
  name: process.env.REACT_APP_LAB_NAME || 'Clinical Immunology Laboratory',
  department: process.env.REACT_APP_LAB_DEPARTMENT || 'Special Immunology',
  address: process.env.REACT_APP_LAB_ADDRESS || '',
};
