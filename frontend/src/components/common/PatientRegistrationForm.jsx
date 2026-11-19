import React from 'react';
import { colors } from '../../config/colors';
import ModalInput from '../ui/ModalInput';
import ModalSelect from '../ui/ModalSelect';
import Button from '../ui/Button';
import useForm from '../../hooks/useForm';
import useNotifications from '../../hooks/useNotifications';
import patientsService from '../../services/api/patientsService';
import {
  createPatientValidators,
  DOCUMENT_TYPES,
  GENDERS,
  PHONE_PREFIXES,
} from '../../services/utils/patientValidators';
import { DEFAULT_PHONE_PREFIX } from '../../services/utils/constants';
import { getApiErrorMessage } from '../../services/utils/apiErrors';
import { User, CreditCard, Calendar, Phone, Mail, Search, FileText } from 'lucide-react';

/**
 * Inline patient registration form, styled like the modal forms. Also lets the
 * user look up an existing patient by document before registering a new one.
 *
 * @param {Function} onPatientSelected - Called with (patient, 'found' | 'registered')
 */
const PatientRegistrationForm = ({ onPatientSelected }) => {
  const { showSuccess, showError, showInfo } = useNotifications();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);

  const initialValues = {
    fullName: '',
    documentType: '',
    documentNumber: '',
    gender: '',
    birthDate: '',
    phonePrefix: DEFAULT_PHONE_PREFIX,
    phoneNumber: '',
    email: '',
  };

  const { values, errors, onChange, isValid, reset } =
    useForm(initialValues, createPatientValidators);

  const handleSearchPatient = async () => {
    if (!values.documentType || !values.documentNumber) {
      showError('Enter the document type and number to search.', {
        title: 'Required Fields'
      });
      return;
    }

    setIsSearching(true);
    try {
      const patient = await patientsService.getPatientByDocument(
        values.documentType,
        values.documentNumber
      );

      // No notification here: the parent shows its own confirmation.
      if (patient) {
        onPatientSelected(patient, 'found');
      }
    } catch (error) {
      // A 404 is the expected "not registered yet" outcome, not an error.
      if (error.response?.status === 404) {
        showInfo('No patient has this document yet. Complete the form to register them.', {
          title: 'Patient Not Found'
        });
      } else {
        showError(getApiErrorMessage(error, 'Could not search for the patient.'), {
          title: 'Search Error'
        });
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isValid()) {
      showError('Please fix the errors in the form.', {
        title: 'Form Errors'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Optional fields are sent as undefined when empty; the date input already yields YYYY-MM-DD.
      const patientData = {
        ...values,
        birthDate: values.birthDate || undefined,
        email: values.email?.trim() || undefined,
      };

      const createdPatient = await patientsService.createPatient(patientData);

      showSuccess('Patient registered successfully.', {
        title: 'Registration Successful'
      });

      reset();
      onPatientSelected(createdPatient, 'registered');
    } catch (error) {
      if (error.response?.status === 409) {
        showError('A patient with this document already exists. Use Find Patient to continue with them.', {
          title: 'Duplicate Patient'
        });
      } else {
        showError(getApiErrorMessage(error, 'Could not register the patient. Please try again.'), {
          title: 'Registration Error'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    reset();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <User
            size={24}
            style={{ color: colors.primary.red }}
            className="mr-2"
          />
          <h2
            className="text-xl font-semibold"
            style={{ color: colors.primary.red }}
          >
            Patient Registration
          </h2>
        </div>
        <p className="text-gray-600 text-sm">
          Enter the patient's details to continue with the analysis.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Identification */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
            <CreditCard size={18} className="mr-2" style={{ color: colors.primary.red }} />
            Identification
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModalSelect
              icon={FileText}
              label="Document Type"
              name="documentType"
              options={DOCUMENT_TYPES}
              placeholder="Select type"
              value={values.documentType}
              onChange={onChange}
              error={errors.documentType}
              required
            />

            <ModalInput
              icon={CreditCard}
              label="Document Number"
              name="documentNumber"
              type="text"
              placeholder="Enter number"
              value={values.documentNumber}
              onChange={onChange}
              error={errors.documentNumber}
              required
            />

            <div className="flex items-end">
              <Button
                type="button"
                variant="primary"
                onClick={handleSearchPatient}
                disabled={!values.documentType || !values.documentNumber || isSubmitting}
                loading={isSearching}
                className="w-full"
              >
                <Search size={18} className="mr-2" />
                Find Patient
              </Button>
            </div>
          </div>
        </div>

        {/* Personal information */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
            <User size={18} className="mr-2" style={{ color: colors.primary.red }} />
            Personal Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModalInput
              icon={User}
              label="Full Name"
              name="fullName"
              type="text"
              placeholder="Enter full name"
              value={values.fullName}
              onChange={onChange}
              error={errors.fullName}
              required
            />

            <ModalSelect
              icon={User}
              label="Gender"
              name="gender"
              options={GENDERS}
              placeholder="Select gender"
              value={values.gender}
              onChange={onChange}
              error={errors.gender}
              required
            />

            <ModalInput
              icon={Calendar}
              label="Date of Birth"
              name="birthDate"
              type="date"
              value={values.birthDate}
              onChange={onChange}
              error={errors.birthDate}
              required
            />
          </div>
        </div>

        {/* Contact information */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
            <Phone size={18} className="mr-2" style={{ color: colors.primary.red }} />
            Contact Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModalSelect
              icon={Phone}
              label="Phone Prefix"
              name="phonePrefix"
              options={PHONE_PREFIXES}
              value={values.phonePrefix}
              onChange={onChange}
              error={errors.phonePrefix}
              required
            />

            <ModalInput
              icon={Phone}
              label="Phone Number"
              name="phoneNumber"
              type="tel"
              placeholder="Enter phone number"
              value={values.phoneNumber}
              onChange={onChange}
              error={errors.phoneNumber}
              required
              className="md:col-span-1"
            />

            <ModalInput
              icon={Mail}
              label="Email"
              name="email"
              type="email"
              placeholder="name@example.com (optional)"
              value={values.email}
              onChange={onChange}
              error={errors.email}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            disabled={isSubmitting}
          >
            Clear
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={isSearching}
            loading={isSubmitting}
          >
            Register Patient
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PatientRegistrationForm;
