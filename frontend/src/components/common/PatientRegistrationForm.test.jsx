import { render, screen } from '@testing-library/react';
import PatientRegistrationForm from './PatientRegistrationForm';
import { NotificationProvider } from '../../context/NotificationContext';

jest.mock('../../services/api/patientsService', () => ({
  __esModule: true,
  default: { getPatientByDocument: jest.fn(), createPatient: jest.fn() },
}));

describe('PatientRegistrationForm', () => {
  it('gives every field a programmatic label', () => {
    render(
      <NotificationProvider>
        <PatientRegistrationForm onPatientSelected={() => {}} />
      </NotificationProvider>
    );

    expect(screen.getByLabelText('Document Type').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Document Number')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Gender').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Date of Birth')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Phone Prefix').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  });
});
