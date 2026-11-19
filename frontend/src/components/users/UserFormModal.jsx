import React from 'react';
import { colors } from '../../config/colors';
import Button from '../ui/Button';
import ModalBase from '../ui/ModalBase';
import ModalInput from '../ui/ModalInput';
import ModalSelect from '../ui/ModalSelect';
import ModalPasswordField from '../ui/ModalPasswordField';
import useNotifications from '../../hooks/useNotifications';
import usersService from '../../services/api/usersService';
import { createUserValidators, updateUserValidators } from '../../services/utils/userValidators';
import { USER_ROLES } from '../../services/utils/constants';
import { formatDate, getCurrentDateTime } from '../../services/utils/dateUtils';
import { User, Mail, CreditCard, Shield, Key, Calendar, UserPlus } from 'lucide-react';

/**
 * Modal for creating a user or editing an existing one.
 * The form works with the API values: role codes ('ADMIN' | 'STANDARD') and
 * the isActive flag ('true' | 'false' in the select); labels are display only.
 */

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const UserFormModal = ({ isOpen, onClose, user, onSave }) => {
  const { showError } = useNotifications();

  const [formData, setFormData] = React.useState({
    fullName: '',
    username: '',
    email: '',
    professionalCard: '',
    role: 'STANDARD',
    isActive: 'true',
    joinDate: getCurrentDateTime(),
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = React.useState({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditMode = !!user;

  React.useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        username: user.username || '',
        email: user.email || '',
        professionalCard: user.professionalCard || '',
        role: user.role || 'STANDARD',
        isActive: String(user.isActive !== false),
        joinDate: user.dateJoined ? formatDate(user.dateJoined) : 'N/A',
        password: '',
        confirmPassword: '',
      });
    } else {
      setFormData({
        fullName: '',
        username: '',
        email: '',
        professionalCard: '',
        role: 'STANDARD',
        isActive: 'true',
        joinDate: getCurrentDateTime(),
        password: '',
        confirmPassword: '',
      });
    }
    setErrors({});
  }, [user, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Once a field shows an error, re-validate it on every change
    if (errors[name]) {
      const validators = isEditMode ? updateUserValidators : createUserValidators;
      const validator = validators[name];

      if (validator) {
        const error = validator(value, formData);
        setErrors(prev => ({
          ...prev,
          [name]: error || ''
        }));
      } else {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const validators = isEditMode ? updateUserValidators : createUserValidators;

    // Validate every field with the centralized validators
    Object.keys(validators).forEach(field => {
      const validator = validators[field];
      const value = formData[field];

      const error = validator(value, formData);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (isEditMode) {
        const dataToUpdate = {};

        // Send only the fields that changed
        if (formData.fullName !== user.fullName) dataToUpdate.fullName = formData.fullName;
        if (formData.email !== user.email) dataToUpdate.email = formData.email;
        if (formData.professionalCard !== user.professionalCard) {
          dataToUpdate.professionalCard = formData.professionalCard;
        }

        if (formData.role !== user.role) {
          dataToUpdate.role = formData.role;
        }
        const isActive = formData.isActive === 'true';
        if (isActive !== (user.isActive !== false)) {
          dataToUpdate.isActive = isActive;
        }

        // Only call the API when something changed
        if (Object.keys(dataToUpdate).length > 0) {
          await usersService.updateUser(user.id, dataToUpdate);
          onSave({ id: user.id, ...dataToUpdate });
        }
      } else {
        const newUserData = {
          username: formData.username,
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          professionalCard: formData.professionalCard,
          role: formData.role,
        };

        await usersService.createUser(newUserData);
        onSave(newUserData);
      }

      onClose();
    } catch (error) {
      showError(error.message || 'Could not save the user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit User' : 'New User'}
      subtitle={isEditMode
        ? "Update the user's information."
        : 'Fill in the details to create a new user.'}
      icon={UserPlus}
      footer={
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : (isEditMode ? 'Save Changes' : 'Create User')}
          </Button>
        </div>
      }
    >
      <form className="px-8 py-6">
        {/* Personal information */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1 h-5 rounded-full"
              style={{ backgroundColor: colors.primary.red }}
            />
            <h3
              className="text-lg font-semibold"
              style={{ color: colors.text.dark }}
            >
              Personal Information
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalInput
              icon={User}
              label="Full Name"
              id="fullName"
              name="fullName"
              placeholder="e.g. Dr. Jane Doe"
              value={formData.fullName}
              onChange={handleChange}
              error={errors.fullName}
              required
            />
            <ModalInput
              icon={User}
              label="Username"
              id="username"
              name="username"
              placeholder="e.g. jdoe"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              required
            />
            <ModalInput
              icon={Mail}
              label="Email"
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
            />
              <div className="relative">
                <label
                  htmlFor="joinDate"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: colors.text.secondary }}
                >
                  {isEditMode ? 'Date Joined' : 'Creation Date'}
                </label>
                <div className="relative">
                  <Calendar
                    size={18}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                    style={{ color: colors.text.secondary }}
                  />
                  <input
                    id="joinDate"
                    type="text"
                    value={formData.joinDate}
                    readOnly
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red cursor-not-allowed"
                    style={{
                      color: colors.text.primary,
                      backgroundColor: colors.background.subtle
                    }}
                  />
                </div>
              </div>
          </div>
        </div>

        {/* Professional information */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1 h-5 rounded-full"
              style={{ backgroundColor: colors.primary.red }}
            />
            <h3
              className="text-lg font-semibold"
              style={{ color: colors.text.dark }}
            >
              Professional Information
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalInput
              icon={CreditCard}
              label="Professional License No."
              id="professionalCard"
              name="professionalCard"
              placeholder="e.g. LIC-12345"
              value={formData.professionalCard}
              onChange={handleChange}
              error={errors.professionalCard}
              required={!isEditMode}
            />
          </div>
        </div>

        {/* Permissions and access */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1 h-5 rounded-full"
              style={{ backgroundColor: colors.primary.red }}
            />
            <h3
              className="text-lg font-semibold"
              style={{ color: colors.text.dark }}
            >
              Permissions and Access
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalSelect
              icon={Shield}
              label="System Role"
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              options={USER_ROLES}
              placeholder="Select a role"
            />
            {isEditMode && (
              <ModalSelect
                icon={Shield}
                label="Status"
                id="isActive"
                name="isActive"
                value={formData.isActive}
                onChange={handleChange}
                options={STATUS_OPTIONS}
                placeholder="Select a status"
              />
            )}
          </div>
        </div>

        {/* Security (new users only) */}
        {!isEditMode && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: colors.primary.red }}
              />
              <h3
                className="text-lg font-semibold"
                style={{ color: colors.text.dark }}
              >
                Security
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModalPasswordField
                icon={Key}
                label="Password"
                id="password"
                name="password"
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                required
              />
              <ModalPasswordField
                icon={Key}
                label="Confirm Password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter the password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                required
              />
            </div>
          </div>
        )}
      </form>
    </ModalBase>
  );
};

export default UserFormModal;
