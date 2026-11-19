import React, { useState } from 'react';
import { colors } from '../../config/colors';
import Button from '../ui/Button';
import SearchInput from '../ui/SearchInput';

/**
 * Patient search form on the Reports page (by name and/or document number).
 */
const PatientSearchForm = ({ onSearch, isLoading = false }) => {
  const [searchData, setSearchData] = useState({
    patientName: '',
    patientDocument: ''
  });

  const handleInputChange = (field, value) => {
    setSearchData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // At least one field is required
    if (!searchData.patientName.trim() && !searchData.patientDocument.trim()) {
      return;
    }

    onSearch(searchData);
  };

  const handleClear = () => {
    setSearchData({
      patientName: '',
      patientDocument: ''
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <div className="mb-6">
        <h2 
          className="text-xl font-semibold mb-2"
          style={{ color: colors.primary.red }}
        >
          Patient Search
        </h2>
        <p className="text-gray-600 text-sm">
          Enter the patient's name or document number.
        </p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[250px]">
            <SearchInput
              id="patient-name"
              label="Patient Name"
              placeholder="e.g. Jane Doe"
              value={searchData.patientName}
              onChange={(e) => handleInputChange('patientName', e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="flex-1 min-w-[250px]">
            <SearchInput
              id="patient-document"
              label="Document Number"
              placeholder="e.g. 1234567890"
              value={searchData.patientDocument}
              onChange={(e) => handleInputChange('patientDocument', e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-end gap-2 min-w-[200px]">
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || (!searchData.patientName.trim() && !searchData.patientDocument.trim())}
              loading={isLoading}
              className="py-2 px-6 whitespace-nowrap"
            >
              Search
            </Button>
            
            {(searchData.patientName.trim() || searchData.patientDocument.trim()) && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleClear}
                disabled={isLoading}
                className="py-2 px-4 whitespace-nowrap"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default PatientSearchForm;