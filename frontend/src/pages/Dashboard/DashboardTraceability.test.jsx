import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardTraceability from './DashboardTraceability';
import RecordDetailModal from '../../components/traceability/RecordDetailModal';
import TraceabilityTable from '../../components/traceability/TraceabilityTable';
import traceabilityService from '../../services/api/traceabilityService';
import { NotificationProvider } from '../../context/NotificationContext';
import { exportToCSV } from '../../services/utils/traceabilityUtils';

jest.mock('../../services/api/traceabilityService', () => ({
  __esModule: true,
  default: { getRecords: jest.fn(), getRecordById: jest.fn() },
}));

jest.mock('../../services/utils/traceabilityUtils', () => ({
  ...jest.requireActual('../../services/utils/traceabilityUtils'),
  exportToCSV: jest.fn(),
}));

const listPage = {
  data: [
    { traceabilityId: 1, userFullName: 'Dr. Jane Doe', userRole: 'ADMIN', dateAndHour: '2026-09-24T13:55:00.000Z', activityType: 'DELETE', activityTypeLabel: 'Delete' },
    { traceabilityId: 2, userFullName: 'System', userRole: null, dateAndHour: '2026-09-24T12:00:00.000Z', activityType: 'CREATE', activityTypeLabel: 'Create' },
  ],
  total: 2,
  page: 1,
  limit: 10,
  totalPages: 1,
};

const baseRecord = {
  id: 7,
  dateTime: '2026-09-24T13:55:00.000Z',
  userName: 'Dr. Jane Doe',
  userRole: 'ADMIN',
  predictions: [],
  fieldChanges: [],
};

const renderPage = () =>
  render(
    <NotificationProvider>
      <DashboardTraceability />
    </NotificationProvider>
  );

describe('audit trail', () => {
  beforeEach(() => {
    traceabilityService.getRecords.mockResolvedValue(listPage);
  });

  it('labels system records as System instead of "Unknown role"', async () => {
    renderPage();

    const [systemRow] = await screen.findAllByRole('row', { name: (accessibleName) => accessibleName.includes('System') });
    expect(within(systemRow).getAllByText('System')).toHaveLength(2);
    expect(screen.queryByText('Unknown role')).not.toBeInTheDocument();
  });

  it('shows an inline error with a retry instead of "No Records Found" when the list fails', async () => {
    traceabilityService.getRecords.mockRejectedValueOnce(new Error('Network Error'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the audit trail.');
    expect(screen.queryByText('No Records Found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Dr. Jane Doe')).toBeInTheDocument();
  });

  it('opens the detail with a spinner while the record loads', async () => {
    let finish;
    traceabilityService.getRecordById.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'View Details' }))[0]);

    expect(screen.getByText('Record Details')).toBeInTheDocument();
    expect(screen.getByText('Loading record…')).toBeInTheDocument();

    finish({
      traceabilityId: 1,
      generalInfo: { dateAndHour: '2026-09-24T13:55:00.000Z', activityType: 'DELETE', activityTypeLabel: 'Delete' },
      userInfo: { userId: 1, fullName: 'Dr. Jane Doe', role: 'ADMIN' },
      fieldChanges: [],
    });
    expect(await screen.findByText('Performed By')).toBeInTheDocument();
  });

  it('uses the same badge for a DELETE activity in the table and in the detail', () => {
    const { container: table } = render(
      <TraceabilityTable data={[{ id: 1, userName: 'Dr. Jane Doe', userRole: 'ADMIN', dateTime: null, activityType: 'DELETE', activityTypeLabel: 'Delete' }]} onViewDetails={() => {}} />
    );
    const tableBadge = within(table).getByText('Delete');

    render(<RecordDetailModal record={{ ...baseRecord, activityType: 'DELETE', activityTypeLabel: 'Delete' }} onClose={() => {}} />);
    const detailBadge = within(screen.getByRole('region', { name: 'General Information' })).getByText('Delete');

    expect(detailBadge.getAttribute("style")).toBe(tableBadge.getAttribute("style"));
    expect(detailBadge.className.trim()).toBe(tableBadge.className.replace("px-1 py-1.5 min-w-[100px]", "").trim());
  });

  it('shows the patient date of birth and keeps it out of the field changes', () => {
    render(
      <RecordDetailModal
        record={{
          ...baseRecord,
          activityType: 'UPDATE',
          patientName: 'Jane Doe',
          patientBirthDate: '1990-05-15',
          fieldChanges: [{ fieldName: 'patientBirthDate', fieldLabel: 'Patient date of birth', previousValue: '1990-05-14', newValue: '1990-05-15' }],
        }}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Date of Birth')).toBeInTheDocument();
    expect(screen.getByText('May 15, 1990')).toBeInTheDocument();
    expect(screen.queryByText('Patient date of birth')).not.toBeInTheDocument();
  });

  it('describes a password reset record instead of showing no details', () => {
    render(
      <RecordDetailModal
        record={{
          ...baseRecord,
          activityType: 'PASSWORD_RESET_COMPLETED',
          activityTypeLabel: 'Password reset completed',
          affectedUserName: 'John Smith',
          affectedUserUsername: 'jsmith',
          affectedUserRole: 'STANDARD',
        }}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("An administrator set a new password for John Smith.")).toBeInTheDocument();
    expect(screen.queryByText('No specific field changes were recorded for this activity.')).not.toBeInTheDocument();
  });

  it('shows System as the role of a system record in the detail', () => {
    render(<RecordDetailModal record={{ ...baseRecord, userName: 'System', userRole: null, activityType: 'CREATE' }} onClose={() => {}} />);

    const performedBy = screen.getByRole('region', { name: 'Performed By' });
    expect(within(performedBy).getAllByText('System')).toHaveLength(2);
    expect(screen.queryByText('Unknown role')).not.toBeInTheDocument();
  });

  describe('server-side filters and export', () => {
    const detail = (id, fullName) => ({
      traceabilityId: id,
      generalInfo: { dateAndHour: '2026-09-24T13:55:00.000Z', activityType: 'CREATE', activityTypeLabel: 'Create' },
      userInfo: { userId: id, fullName, role: 'ADMIN' },
      fieldChanges: [],
    });

    beforeEach(() => {
      traceabilityService.getRecords.mockReset();
      traceabilityService.getRecords.mockResolvedValue(listPage);
      exportToCSV.mockReset();
    });

    it('sends the user, activity and local-day filters to the API, from page 1', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findAllByText('Dr. Jane Doe');

      await user.type(screen.getByLabelText('Search by User'), 'Jane');
      fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-09-24' } });
      fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-09-24' } });
      await user.selectOptions(screen.getByLabelText('Activity'), 'UPDATE');

      await waitFor(() => expect(traceabilityService.getRecords).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        userName: 'Jane',
        from: new Date(2026, 8, 24).toISOString(),
        to: new Date(2026, 8, 25).toISOString(),
        activityType: 'UPDATE',
      }));
    });

    it('flags a start date after the end date on the field and sends no request for it', async () => {
      renderPage();
      await screen.findAllByText('Dr. Jane Doe');
      fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-09-20' } });
      await waitFor(() => expect(traceabilityService.getRecords).toHaveBeenLastCalledWith(expect.objectContaining({ to: expect.any(String) })));
      const requestsBefore = traceabilityService.getRecords.mock.calls.length;

      fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-09-24' } });

      // Date filters apply at once, so a request for the range would already have gone out
      expect(traceabilityService.getRecords).toHaveBeenCalledTimes(requestsBefore);
      const startDate = screen.getByLabelText('Start Date');
      expect(startDate).toBeInvalid();
      expect(startDate).toHaveAccessibleDescription('Start date must be on or before the end date.');
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();

      // Fixing the range clears the error and applies the filter
      fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-09-18' } });
      expect(startDate).toBeValid();
      expect(screen.queryByText('Start date must be on or before the end date.')).not.toBeInTheDocument();
      await waitFor(() => expect(traceabilityService.getRecords).toHaveBeenLastCalledWith(expect.objectContaining({
        from: new Date(2026, 8, 18).toISOString(),
        to: new Date(2026, 8, 21).toISOString(),
      })));
    });

    it('shows the rows the API returns for a filter without filtering them again', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findAllByText('Dr. Jane Doe');

      await user.type(screen.getByLabelText('Search by User'), 'zzz');
      await waitFor(() => expect(traceabilityService.getRecords).toHaveBeenLastCalledWith(expect.objectContaining({ userName: 'zzz' })));

      expect(screen.getAllByText('Dr. Jane Doe').length).toBeGreaterThan(0);
    });

    it('exports every page of the filtered records, not only the rows shown', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findAllByText('Dr. Jane Doe');
      await user.selectOptions(screen.getByLabelText('Activity'), 'DELETE');
      await waitFor(() => expect(traceabilityService.getRecords).toHaveBeenLastCalledWith(expect.objectContaining({ activityType: 'DELETE' })));

      let finishSecondPage;
      traceabilityService.getRecords
        .mockResolvedValueOnce({ ...listPage, total: 3, limit: 100, totalPages: 2 })
        .mockReturnValueOnce(new Promise((resolve) => { finishSecondPage = resolve; }));
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(await screen.findByRole('button', { name: /Exporting 2 of 3/ })).toBeDisabled();
      finishSecondPage({ data: [listPage.data[0]], total: 3, page: 2, limit: 100, totalPages: 2 });

      await waitFor(() => expect(exportToCSV).toHaveBeenCalledTimes(1));
      expect(exportToCSV.mock.calls[0][0]).toHaveLength(3);
      expect(traceabilityService.getRecords).toHaveBeenCalledWith({ activityType: 'DELETE', page: 1, limit: 100 });
      expect(traceabilityService.getRecords).toHaveBeenCalledWith({ activityType: 'DELETE', page: 2, limit: 100 });
      expect(await screen.findByText('3 records exported successfully.')).toBeInTheDocument();
    });

    it('reports an export that fails part-way and exports nothing', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findAllByText('Dr. Jane Doe');
      traceabilityService.getRecords
        .mockResolvedValueOnce({ ...listPage, total: 3, limit: 100, totalPages: 2 })
        .mockRejectedValueOnce(new Error('Network Error'));

      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(await screen.findByText('Could not export the audit trail. Please try again.')).toBeInTheDocument();
      expect(exportToCSV).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    });

    it('ignores a detail response that arrives after another record was opened', async () => {
      let finishFirst;
      traceabilityService.getRecordById
        .mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }))
        .mockResolvedValueOnce(detail(2, 'Second Reviewer'));
      const user = userEvent.setup();
      renderPage();

      const viewButtons = await screen.findAllByRole('button', { name: 'View Details' });
      await user.click(viewButtons[0]);
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await user.click(screen.getAllByRole('button', { name: 'View Details' })[1]);
      expect(await screen.findByText('Second Reviewer')).toBeInTheDocument();

      finishFirst(detail(1, 'First Reviewer'));
      await waitFor(() => expect(traceabilityService.getRecordById).toHaveBeenCalledTimes(2));

      expect(screen.getByText('Second Reviewer')).toBeInTheDocument();
      expect(screen.queryByText('First Reviewer')).not.toBeInTheDocument();
    });
  });
});
