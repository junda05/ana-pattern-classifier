import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DashboardHome from './DashboardHome';
import DashboardAnalytics from './DashboardAnalytics';
import DashboardReports from './DashboardReports';
import NotFoundPage from '../NotFound/NotFoundPage';
import ReportModal from '../../components/reports/ReportModal';
import resultsService from '../../services/api/resultsService';
import reportsService from '../../services/api/reportsService';
import axiosClient from '../../config/axios';
import { NotificationProvider } from '../../context/NotificationContext';
import { formatDate } from '../../services/utils/dateUtils';

jest.mock('../../config/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../../services/api/resultsService', () => ({
  __esModule: true,
  default: { getResults: jest.fn(), getResultById: jest.fn(), updateStatus: jest.fn(), getStatistics: jest.fn() },
}));
jest.mock('../../services/api/reportsService', () => ({
  __esModule: true,
  default: { getReportById: jest.fn(), searchReports: jest.fn() },
}));

const withProviders = (ui) => (
  <NotificationProvider>
    <MemoryRouter>{ui}</MemoryRouter>
  </NotificationProvider>
);

const pendingPage = {
  data: [
    {
      resultId: 5,
      dateAndHour: '2026-09-24T13:55:00.000Z',
      status: 'PENDING',
      patient: { patientId: 9, fullName: 'Jane Doe', documentType: 'PASSPORT', documentNumber: 'X1234567' },
      predictionsCount: 2,
    },
  ],
  total: 1,
  page: 1,
  limit: 5,
  totalPages: 1,
};

describe('Home', () => {
  beforeEach(() => {
    axiosClient.get.mockResolvedValue({ data: new Blob(['x']) });
  });

  it('shows an inline error with a retry, not "no pending exams", when the list fails', async () => {
    resultsService.getResults.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(pendingPage);
    render(withProviders(<DashboardHome />));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load results.');
    expect(screen.queryByText('There are no pending exams.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  });

  it('labels the patient search field', async () => {
    resultsService.getResults.mockResolvedValue(pendingPage);
    render(withProviders(<DashboardHome />));

    expect(screen.getByLabelText('Search patients')).toBeInTheDocument();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  });

  it('searches on the server, debounced, starting again from page 1', async () => {
    const user = userEvent.setup();
    resultsService.getResults.mockReset();
    resultsService.getResults.mockImplementation(async ({ page }) => ({ ...pendingPage, page, total: 15, totalPages: 3 }));
    render(withProviders(<DashboardHome />));
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(resultsService.getResults).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    const callsBeforeSearch = resultsService.getResults.mock.calls.length;

    await user.type(screen.getByLabelText('Search patients'), 'X123');

    await waitFor(() => expect(resultsService.getResults).toHaveBeenLastCalledWith({ page: 1, limit: 5, status: 'PENDING', search: 'X123' }));
    expect(resultsService.getResults.mock.calls.length).toBe(callsBeforeSearch + 1);
  });

  it('shows the server results for a search without filtering them again', async () => {
    const user = userEvent.setup();
    resultsService.getResults.mockReset();
    resultsService.getResults.mockResolvedValue(pendingPage);
    render(withProviders(<DashboardHome />));
    await screen.findByText('Jane Doe');

    // The API matched this patient on a field the page does not show (e.g. accents or part of the document)
    await user.type(screen.getByLabelText('Search patients'), 'zzz');
    await waitFor(() => expect(resultsService.getResults).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'zzz' })));

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('announces the loading state', () => {
    resultsService.getResults.mockReturnValue(new Promise(() => {}));
    render(withProviders(<DashboardHome />));

    expect(screen.getByRole('status')).toHaveTextContent('Loading pending exams…');
  });

  it('asks for confirmation before verifying an exam', async () => {
    resultsService.getResults.mockResolvedValue(pendingPage);
    resultsService.getResultById.mockResolvedValue({ ...pendingPage.data[0], predictions: [] });
    resultsService.updateStatus.mockResolvedValue({});
    render(withProviders(<DashboardHome />));

    await userEvent.click(await screen.findByRole('button', { name: 'View Details' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Verify Exam' }));

    expect(screen.getByText('Verify Exam?')).toBeInTheDocument();
    expect(resultsService.updateStatus).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(resultsService.updateStatus).toHaveBeenCalledWith(5, 'VERIFIED'));
  });
});

describe('Analytics', () => {
  it('shows the load error inline with a retry', async () => {
    resultsService.getStatistics.mockRejectedValueOnce(new Error('Network Error'));
    render(withProviders(<DashboardAnalytics />));

    await userEvent.click(screen.getByRole('button', { name: /Generate Statistics/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the statistics.');
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });
});

describe('Reports', () => {
  const reportsPage = (page) => ({
    data: [{ resultId: page, dateAndHour: '2026-09-24T13:55:00.000Z', patient: { fullName: `Patient ${page}` } }],
    total: 15,
    page,
    limit: 5,
    totalPages: 3,
  });

  it('retries a failed new search from page 1 after browsing another page', async () => {
    const user = userEvent.setup();
    reportsService.searchReports.mockReset();
    reportsService.searchReports
      .mockResolvedValueOnce(reportsPage(1))
      .mockResolvedValueOnce(reportsPage(2))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(reportsPage(1));
    render(withProviders(<DashboardReports />));

    await user.type(screen.getByLabelText('Patient Name'), 'Jane');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(reportsService.searchReports).toHaveBeenCalledTimes(2));

    await user.clear(screen.getByLabelText('Patient Name'));
    await user.type(screen.getByLabelText('Patient Name'), 'John');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not search reports.');

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => expect(reportsService.searchReports).toHaveBeenCalledTimes(4));
    expect(reportsService.searchReports).toHaveBeenLastCalledWith(expect.objectContaining({ patientName: 'John', page: 1 }));
  });
});

describe('ReportModal', () => {
  const report = {
    resultId: 5,
    dateAndHour: '2026-09-20T09:30:00.000Z',
    lastModifiedAt: '2026-09-22T15:45:00.000Z',
    verifiedAt: '2026-09-22T15:45:00.000Z',
    verifiedBy: { userId: 2, fullName: 'Dr. John Smith' },
    status: 'VERIFIED',
    observations: '',
    patient: { fullName: 'Jane Doe', gender: 'F', birthDate: '1990-05-15', documentType: 'PASSPORT', documentNumber: 'X1234567', email: 'jane.doe@example.com' },
    medic: { fullName: 'Dr. John Smith', professionalCard: 'LIC-2' },
    predictions: [],
  };

  it('prints the stored exam and result dates, not the current time', async () => {
    reportsService.getReportById.mockResolvedValue(report);
    render(<ReportModal isOpen reportId={5} onClose={() => {}} />);

    expect(await screen.findByText('CLINICAL REPORT')).toBeInTheDocument();
    expect(screen.getByText(formatDate(report.dateAndHour))).toBeInTheDocument();
    expect(screen.getAllByText(formatDate(report.lastModifiedAt)).length).toBeGreaterThan(0);
    expect(screen.getByText('Email: jane.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('May 15, 1990')).toBeInTheDocument();
  });

  it('shows who verified the result', async () => {
    reportsService.getReportById.mockResolvedValue(report);
    render(<ReportModal isOpen reportId={5} onClose={() => {}} />);

    expect(await screen.findByText(`Verified by Dr. John Smith on ${formatDate(report.verifiedAt)}`)).toBeInTheDocument();
  });

  it('is a modal dialog that closes on Escape', async () => {
    reportsService.getReportById.mockResolvedValue(report);
    const onClose = jest.fn();
    render(<ReportModal isOpen reportId={5} onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'Clinical Report' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(await screen.findByText('CLINICAL REPORT')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prints the report from an accessible Print button', async () => {
    const print = jest.spyOn(window, 'print').mockImplementation(() => {});
    reportsService.getReportById.mockResolvedValue(report);
    render(<ReportModal isOpen reportId={5} onClose={() => {}} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Print' }));

    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('prints only the report: no app chrome, no buttons, no page break inside a prediction', async () => {
    reportsService.getReportById.mockResolvedValue({
      ...report,
      predictions: [{ predictionId: 11, finalPattern: 'NUCLEAR_HOMOGENEOUS', dilution: '80', imageUrl: null, imagePath: null }],
    });
    const view = render(<ReportModal isOpen reportId={5} onClose={() => {}} />);
    await screen.findByText('CLINICAL REPORT');

    /* eslint-disable testing-library/no-node-access -- the print stylesheet targets ancestor classes
       (.report-print-root, .print-hidden, .print-avoid-break), which Testing Library queries cannot express */
    // The report is rendered at the top of <body>, outside the app, which print hides
    const printRoot = screen.getByRole('dialog', { name: 'Clinical Report' }).closest('.report-print-root');
    expect(printRoot.parentElement).toBe(document.body);
    expect(document.body).toHaveClass('report-print-active');

    const hiddenWhenPrinted = (element) => element.closest('.print-hidden') !== null;
    expect(hiddenWhenPrinted(screen.getByRole('button', { name: 'Print' }))).toBe(true);
    expect(hiddenWhenPrinted(screen.getByRole('button', { name: 'Close' }))).toBe(true);
    expect(hiddenWhenPrinted(screen.getByText('CLINICAL REPORT'))).toBe(false);
    expect(screen.getByText('Final Pattern').closest('.print-avoid-break')).not.toBeNull();
    /* eslint-enable testing-library/no-node-access */

    view.unmount();
    expect(document.body).not.toHaveClass('report-print-active');
  });

  it('offers a retry when the report cannot be loaded', async () => {
    reportsService.getReportById.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(report);
    render(<ReportModal isOpen reportId={5} onClose={() => {}} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the report.');
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('CLINICAL REPORT')).toBeInTheDocument();
  });
});

describe('NotFoundPage', () => {
  it('goes back to Home with client-side navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/missing']}>
        <Routes>
          <Route path="/" element={<p>Start page</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /Back to Home/ }));

    expect(screen.getByText('Start page')).toBeInTheDocument();
  });
});
