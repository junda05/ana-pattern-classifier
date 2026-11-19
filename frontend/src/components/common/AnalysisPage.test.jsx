import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import AnalysisPage from './AnalysisPage';
import { NotificationProvider } from '../../context/NotificationContext';
import { predictImages } from '../../services/api/predictionService';
import resultsService from '../../services/api/resultsService';
import patientsService from '../../services/api/patientsService';
import axiosClient from '../../config/axios';
import useAuth from '../../hooks/useAuth';

jest.mock('../../config/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../../hooks/useAuth', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../services/api/predictionService', () => ({
  predictImages: jest.fn(),
  PREDICTION_UNAVAILABLE_MESSAGE: 'The prediction service is unavailable. Please try again in a moment.',
}));
jest.mock('../../services/api/resultsService', () => ({
  __esModule: true,
  default: {
    getResultById: jest.fn(),
    createResultBatchWithFiles: jest.fn(),
    addPredictionsToResult: jest.fn(),
    updateResult: jest.fn(),
    createCorrectionsBatch: jest.fn(),
  },
}));
jest.mock('../../services/api/patientsService', () => ({
  __esModule: true,
  default: { getPatientByDocument: jest.fn(), createPatient: jest.fn() },
}));

// Tiny in-memory stand-ins for images (PNG signature bytes only; never a real image).
const pngFile = (name) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

const patient = { patientId: 9, fullName: 'Jane Doe', documentType: 'PASSPORT', documentNumber: 'X1234567' };

const okResult = ({ id, file }, predictionKey = 'NUCLEAR_HOMOGENEOUS') => ({
  id,
  fileName: file.name,
  error: false,
  predictionKey,
  classificationLevel: 'competent',
  confidence: 91.5,
  formattedPattern: `Pattern of ${file.name}`,
  imageSha256: `sha-${file.name}`,
  signature: `sig-${file.name}`,
});

const failedResult = ({ id, file }) => ({
  id,
  fileName: file.name,
  error: true,
  errorMessage: 'The prediction service is unavailable. Please try again in a moment.',
  confidence: 0,
  formattedPattern: 'Processing Error',
  details: 'Error: The prediction service is unavailable. Please try again in a moment.',
});

const savedResult = {
  resultId: 42,
  status: 'PENDING',
  observations: null,
  patient,
  predictions: [
    { predictionId: 501, prediction: 'NUCLEAR_SPECKLED', confidencePercentage: 88, dilution: '80', imagePath: 'abc-1700000000-saved1.png', imageUrl: 'http://api/files/predictions/abc-1700000000-saved1.png' },
    { predictionId: 502, prediction: 'NEGATIVE', confidencePercentage: 97, dilution: '160', imagePath: 'abc-1700000001-saved2.png', imageUrl: 'http://api/files/predictions/abc-1700000001-saved2.png' },
  ],
};

const renderPage = (entry = '/dashboard/analysis') =>
  render(
    <NotificationProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/dashboard/analysis" element={<AnalysisPage title="ANA Analysis" description="Upload images." />} />
          <Route path="/dashboard/home" element={<p>Home page</p>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>
  );

// Moves around the app from outside the page, like the sidebar does
const Navigator = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/dashboard/analysis')}>Open new analysis</button>
      <button type="button" onClick={() => navigate('/dashboard/reports')}>Open reports</button>
    </>
  );
};

const renderWithNavigator = (entry) =>
  render(
    <NotificationProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Navigator />
        <Routes>
          <Route path="/dashboard/analysis" element={<AnalysisPage title="ANA Analysis" description="Upload images." />} />
          <Route path="/dashboard/home" element={<p>Home page</p>} />
          <Route path="/dashboard/reports" element={<p>Reports page</p>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>
  );

const findPatient = async (user) => {
  await user.selectOptions(screen.getByLabelText('Document Type'), 'PASSPORT');
  await user.type(screen.getByLabelText('Document Number'), 'X1234567');
  await user.click(screen.getByRole('button', { name: 'Find Patient' }));
  await screen.findByText('Upload Images');
};

const LOCKED_MESSAGE = 'This result is verified and locked. Only an administrator can correct it.';

const continueSavedResult = () =>
  renderPage({ pathname: '/dashboard/analysis', state: { continueResultId: 42, timestamp: 1 } });

const upload = async (user, names) => {
  await user.upload(screen.getByLabelText('Select Files'), names.map(pngFile));
};

const pickDilution = async (user, fileName, label) => {
  const group = screen.getByRole('group', { name: `Sample dilution for ${fileName}` });
  await user.click(within(group).getByRole('button', { name: label }));
};

const removeImage = async (user, fileName) => {
  await user.click(screen.getByRole('button', { name: `Remove ${fileName}` }));
  await user.click(await screen.findByRole('button', { name: 'Remove Image' }));
};

describe('AnalysisPage', () => {
  let objectUrls;

  beforeEach(() => {
    objectUrls = 0;
    URL.createObjectURL = jest.fn(() => `blob:preview-${++objectUrls}`);
    URL.revokeObjectURL = jest.fn();
    useAuth.mockReturnValue({ user: { userId: 1, fullName: 'Dr. Jane Doe', role: 'STANDARD' } });
    axiosClient.get.mockResolvedValue({ data: new Blob(['x']) });
    patientsService.getPatientByDocument.mockResolvedValue(patient);
    resultsService.getResultById.mockResolvedValue(savedResult);
    resultsService.createResultBatchWithFiles.mockResolvedValue({ resultId: 1 });
    resultsService.addPredictionsToResult.mockResolvedValue({ resultId: 42, predictions: [] });
    resultsService.updateResult.mockResolvedValue({ resultId: 42 });
    resultsService.createCorrectionsBatch.mockResolvedValue([]);
    predictImages.mockImplementation(async (images) => images.map((image) => okResult(image)));
  });

  it('keeps each dilution with its own image after an earlier image is removed', async () => {
    const user = userEvent.setup();
    renderPage();
    await findPatient(user);
    await upload(user, ['a.png', 'b.png', 'c.png']);

    await pickDilution(user, 'b.png', '1:160');
    await pickDilution(user, 'c.png', '1:320');
    await removeImage(user, 'a.png');
    await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
    await user.click(await screen.findByRole('button', { name: 'Save for Later' }));

    await waitFor(() => expect(resultsService.createResultBatchWithFiles).toHaveBeenCalledTimes(1));
    const [data, files] = resultsService.createResultBatchWithFiles.mock.calls[0];
    expect(files.map((file) => file.name)).toEqual(['b.png', 'c.png']);
    expect(data.predictions.map((p) => p.dilution)).toEqual(['160', '320']);
    expect(data).toMatchObject({ patientId: 9, status: 'PENDING' });
    expect(data).not.toHaveProperty('userId');
  });

  it('attaches dilutions and corrections to the right image when another image fails', async () => {
    predictImages.mockImplementation(async (images) =>
      images.map((image) => (image.file.name === 'b.png' ? failedResult(image) : okResult(image)))
    );
    const user = userEvent.setup();
    renderPage();
    await findPatient(user);
    await upload(user, ['a.png', 'b.png', 'c.png']);
    await pickDilution(user, 'c.png', '1:640');

    await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
    await user.click(await screen.findByRole('button', { name: 'Verify Results' }));
    await user.click(screen.getByRole('button', { name: 'Correct' }));
    await user.selectOptions(screen.getByLabelText('Corrected classification for c.png'), 'NUCLEAR_SPECKLED');
    await user.click(screen.getByRole('button', { name: 'Save Corrections' }));

    await waitFor(() => expect(resultsService.createResultBatchWithFiles).toHaveBeenCalledTimes(1));
    const [data, files] = resultsService.createResultBatchWithFiles.mock.calls[0];
    expect(files.map((file) => file.name)).toEqual(['a.png', 'c.png']);
    expect(data.predictions.map((p) => [p.prediction, p.dilution])).toEqual([
      ['NUCLEAR_HOMOGENEOUS', '80'],
      ['NUCLEAR_HOMOGENEOUS', '640'],
    ]);
    expect(data.corrections).toEqual([{ imageIndex: 1, correctedPrediction: 'NUCLEAR_SPECKLED' }]);
  });

  it('saves an observation-only change as one append request without images', async () => {
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await user.type(screen.getByLabelText('Observations'), 'Faint staining.');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledWith(42, { observations: 'Faint staining.' }, []));
    expect(resultsService.updateResult).not.toHaveBeenCalled();
  });

  it('does not send a request when nothing changed on an existing result', async () => {
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('There are no changes to save.')).toBeInTheDocument();
    expect(resultsService.updateResult).not.toHaveBeenCalled();
    expect(resultsService.addPredictionsToResult).not.toHaveBeenCalled();
  });

  it('saves a dilution-only change of a saved image as one append request without images', async () => {
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await pickDilution(user, 'saved1.png', '1:320');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(1));
    expect(resultsService.addPredictionsToResult).toHaveBeenCalledWith(42, { updatedDilutions: [{ predictionId: 501, dilution: '320' }] }, []);
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('sends a dilution change together with changed observations', async () => {
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await pickDilution(user, 'saved2.png', '1:80');
    await user.type(screen.getByLabelText('Observations'), 'Rechecked.');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledWith(
      42,
      { updatedDilutions: [{ predictionId: 502, dilution: '80' }], observations: 'Rechecked.' },
      []
    ));
  });

  it('sends saved-dilution edits together with new images in the same request', async () => {
    resultsService.addPredictionsToResult.mockResolvedValue({ resultId: 42, predictions: [] });
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await upload(user, ['new.png']);
    await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
    await screen.findByRole('button', { name: 'Save for Later' });
    await pickDilution(user, 'saved1.png', '1:320');
    await user.click(screen.getByRole('button', { name: 'Save for Later' }));

    await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(1));
    const [resultId, data, files] = resultsService.addPredictionsToResult.mock.calls[0];
    expect(resultId).toBe(42);
    expect(files.map((file) => file.name)).toEqual(['new.png']);
    expect(data.newPredictions).toHaveLength(1);
    expect(data.updatedDilutions).toEqual([{ predictionId: 501, dilution: '320' }]);
  });

  it('saves new images, their corrections and saved-image corrections in ONE append request', async () => {
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await upload(user, ['n1.png', 'n2.png']);
    await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
    await pickDilution(user, 'saved1.png', '1:320');
    await user.type(screen.getByLabelText('Observations'), 'Page note.');
    await user.click(await screen.findByRole('button', { name: 'Verify Results' }));
    await user.click(screen.getByRole('button', { name: 'Correct' }));
    await user.selectOptions(screen.getByLabelText('Corrected classification for n2.png'), 'NUCLEAR_SPECKLED');
    await user.selectOptions(screen.getByLabelText('Corrected classification for saved2.png'), 'NUCLEAR_HOMOGENEOUS');
    await user.type(screen.getByLabelText('Correction Notes'), 'Correction note.');
    await user.click(screen.getByRole('button', { name: 'Save Corrections' }));

    await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(1));
    const [resultId, data, files] = resultsService.addPredictionsToResult.mock.calls[0];
    expect(resultId).toBe(42);
    expect(files.map((file) => file.name)).toEqual(['n1.png', 'n2.png']);
    expect(data).toEqual({
      newPredictions: [
        expect.objectContaining({ signature: 'sig-n1.png' }),
        expect.objectContaining({ signature: 'sig-n2.png' }),
      ],
      updatedDilutions: [{ predictionId: 501, dilution: '320' }],
      corrections: [{ imageIndex: 1, correctedPrediction: 'NUCLEAR_SPECKLED', observations: 'Correction note.' }],
      existingCorrections: [{ predictionId: 502, correctedPrediction: 'NUCLEAR_HOMOGENEOUS', observations: 'Correction note.' }],
      observations: 'Page note.',
    });
    expect(resultsService.createCorrectionsBatch).not.toHaveBeenCalled();
    expect(resultsService.updateResult).not.toHaveBeenCalled();
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('confirms a continued result with one append request that sets VERIFIED', async () => {
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await upload(user, ['n1.png']);
    await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
    await user.click(await screen.findByRole('button', { name: 'Verify Results' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(1));
    const [, data, files] = resultsService.addPredictionsToResult.mock.calls[0];
    expect(files.map((file) => file.name)).toEqual(['n1.png']);
    expect(data).toEqual({ newPredictions: [expect.objectContaining({ signature: 'sig-n1.png' })], status: 'VERIFIED' });
    expect(resultsService.updateResult).not.toHaveBeenCalled();
  });

  it('confirms a continued result without new images through the same append request', async () => {
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await user.click(screen.getByRole('button', { name: 'Verify Results' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledWith(42, { status: 'VERIFIED' }, []));
    expect(resultsService.updateResult).not.toHaveBeenCalled();
  });

  it('lets a failed append be retried with the same single request, and sends nothing after it succeeds', async () => {
    resultsService.addPredictionsToResult
      .mockRejectedValueOnce(Object.assign(new Error('Request failed'), { response: { status: 503, data: {} } }))
      .mockResolvedValueOnce({ ...savedResult, predictions: [...savedResult.predictions, { predictionId: 600, prediction: 'NEGATIVE' }], addedPredictionIds: [600] });
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    await upload(user, ['n1.png']);
    await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
    await user.click(await screen.findByRole('button', { name: 'Save for Later' }));
    expect(await screen.findByText('Could not save the results.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save for Later' }));
    expect(await screen.findByText('Home page')).toBeInTheDocument();

    expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(2);
    const [first, second] = resultsService.addPredictionsToResult.mock.calls;
    expect(second[1]).toEqual(first[1]);
    expect(second[2]).toEqual(first[2]);
    expect(first[1]).not.toHaveProperty('status');
    expect(resultsService.createCorrectionsBatch).not.toHaveBeenCalled();
  });

  it('shows the lock message and reloads the result when it was verified meanwhile', async () => {
    resultsService.addPredictionsToResult.mockRejectedValue(
      Object.assign(new Error('Request failed'), { response: { status: 409, data: { statusCode: 409, message: 'Verified results cannot be modified.' } } })
    );
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');
    resultsService.getResultById.mockResolvedValue({
      ...savedResult,
      status: 'VERIFIED',
      predictions: [...savedResult.predictions, { predictionId: 503, prediction: 'NEGATIVE', confidencePercentage: 90, dilution: '80', imagePath: 'abc-1700000002-saved3.png' }],
    });

    await user.type(screen.getByLabelText('Observations'), 'Late note.');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Verified results cannot be modified.')).toBeInTheDocument();
    expect(await screen.findByText('Existing Predictions (3)')).toBeInTheDocument();
    expect(resultsService.getResultById).toHaveBeenCalledTimes(2);
    expect(screen.getByText(LOCKED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(screen.getByLabelText('Observations')).toBeDisabled();
  });

  describe('a verified result', () => {
    const verifiedResult = { ...savedResult, status: 'VERIFIED' };
    const asAdmin = () => useAuth.mockReturnValue({ user: { userId: 2, fullName: 'Dr. Ada Admin', role: 'ADMIN' } });

    const expectEverythingLocked = () => {
      expect(screen.getByText(LOCKED_MESSAGE)).toBeInTheDocument();
      expect(screen.getByLabelText('Select Files')).toBeDisabled();
      const savedGroup = screen.getByRole('group', { name: 'Sample dilution for saved1.png' });
      within(savedGroup).getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
      expect(screen.getByLabelText('Observations')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Verify Results' })).toBeDisabled();
    };

    it('is shown locked to a standard user, with no way to change it', async () => {
      resultsService.getResultById.mockResolvedValue(verifiedResult);
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');

      expectEverythingLocked();
      expect(screen.queryByRole('button', { name: 'Correct Result' })).not.toBeInTheDocument();
      expect(screen.queryByText(/You can add and analyze new images/)).not.toBeInTheDocument();
    });

    it('can only be corrected by an administrator, with a request that carries just the corrections', async () => {
      asAdmin();
      resultsService.getResultById.mockResolvedValue(verifiedResult);
      const user = userEvent.setup();
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');
      expectEverythingLocked();

      await user.click(screen.getByRole('button', { name: 'Correct Result' }));
      expect(screen.getByRole('dialog', { name: 'Correct Classification' })).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText('Corrected classification for saved2.png'), 'NUCLEAR_HOMOGENEOUS');
      await user.type(screen.getByLabelText('Correction Notes'), 'Admin review.');
      await user.click(screen.getByRole('button', { name: 'Save Corrections' }));

      await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(1));
      expect(resultsService.addPredictionsToResult).toHaveBeenCalledWith(
        42,
        { existingCorrections: [{ predictionId: 502, correctedPrediction: 'NUCLEAR_HOMOGENEOUS', observations: 'Admin review.' }] },
        []
      );
      expect(await screen.findByText('Home page')).toBeInTheDocument();
    });

    it('locks after a conflict reload, and an administrator correction leaves the unsaved edits out', async () => {
      asAdmin();
      resultsService.addPredictionsToResult
        .mockRejectedValueOnce(
          Object.assign(new Error('Request failed'), { response: { status: 409, data: { statusCode: 409, message: 'Verified results cannot be modified.' } } })
        )
        .mockResolvedValueOnce({ ...verifiedResult, status: 'CORRECTED' });
      const user = userEvent.setup();
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');
      resultsService.getResultById.mockResolvedValue(verifiedResult);

      await pickDilution(user, 'saved1.png', '1:320');
      await user.type(screen.getByLabelText('Observations'), 'Late note.');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(await screen.findByText(LOCKED_MESSAGE)).toBeInTheDocument();
      expectEverythingLocked();

      await user.click(screen.getByRole('button', { name: 'Correct Result' }));
      await user.selectOptions(screen.getByLabelText('Corrected classification for saved1.png'), 'NEGATIVE');
      await user.click(screen.getByRole('button', { name: 'Save Corrections' }));

      await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(2));
      expect(resultsService.addPredictionsToResult.mock.calls[1]).toEqual([
        42,
        { existingCorrections: [{ predictionId: 501, correctedPrediction: 'NEGATIVE' }] },
        [],
      ]);
    });
  });

  describe('observations', () => {
    it('keeps the page observations as the result observations when correcting a new result', async () => {
      const user = userEvent.setup();
      renderPage();
      await findPatient(user);
      await upload(user, ['a.png']);
      await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
      await user.type(await screen.findByLabelText('Observations'), 'Page note.');
      await user.click(screen.getByRole('button', { name: 'Verify Results' }));
      await user.click(screen.getByRole('button', { name: 'Correct' }));
      await user.selectOptions(screen.getByLabelText('Corrected classification for a.png'), 'NUCLEAR_SPECKLED');
      await user.type(screen.getByLabelText('Correction Notes'), 'Correction note.');
      await user.click(screen.getByRole('button', { name: 'Save Corrections' }));

      await waitFor(() => expect(resultsService.createResultBatchWithFiles).toHaveBeenCalledTimes(1));
      const [data] = resultsService.createResultBatchWithFiles.mock.calls[0];
      expect(data.observations).toBe('Page note.');
      expect(data.corrections).toEqual([{ imageIndex: 0, correctedPrediction: 'NUCLEAR_SPECKLED', observations: 'Correction note.' }]);
    });

    it('does not turn correction notes into result observations when continuing a result', async () => {
      resultsService.getResultById.mockResolvedValue({ ...savedResult, observations: 'Saved note.' });
      const user = userEvent.setup();
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');

      await user.click(screen.getByRole('button', { name: 'Verify Results' }));
      await user.click(screen.getByRole('button', { name: 'Correct' }));
      await user.selectOptions(screen.getByLabelText('Corrected classification for saved1.png'), 'NEGATIVE');
      await user.type(screen.getByLabelText('Correction Notes'), 'Correction note.');
      await user.click(screen.getByRole('button', { name: 'Save Corrections' }));

      await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(1));
      expect(resultsService.addPredictionsToResult).toHaveBeenCalledWith(
        42,
        { existingCorrections: [{ predictionId: 501, correctedPrediction: 'NEGATIVE', observations: 'Correction note.' }] },
        []
      );
    });

    it('sends null when the observations of a continued result are cleared', async () => {
      resultsService.getResultById.mockResolvedValue({ ...savedResult, observations: 'Saved note.' });
      const user = userEvent.setup();
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');

      await user.clear(screen.getByLabelText('Observations'));
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledWith(42, { observations: null }, []));
    });

    it('sends null observations when a new result has none', async () => {
      const user = userEvent.setup();
      renderPage();
      await findPatient(user);
      await upload(user, ['a.png']);
      await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
      await user.type(await screen.findByLabelText('Observations'), '   ');
      await user.click(screen.getByRole('button', { name: 'Save for Later' }));

      await waitFor(() => expect(resultsService.createResultBatchWithFiles).toHaveBeenCalledTimes(1));
      expect(resultsService.createResultBatchWithFiles.mock.calls[0][0].observations).toBeNull();
    });
  });

  describe('image limits and the dropzone', () => {
    it('holds at most 20 images per result, counting the saved ones', async () => {
      const user = userEvent.setup();
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');

      await upload(user, Array.from({ length: 19 }, (_, index) => `n${index + 1}.png`));

      expect(await screen.findByText('A result can hold at most 20 images.')).toBeInTheDocument();
      expect(screen.getByText('n18.png')).toBeInTheDocument();
      expect(screen.queryByText('n19.png')).not.toBeInTheDocument();
    });

    it('disables the dropzone while the images are being analyzed', async () => {
      let finish;
      predictImages.mockImplementation((images) => new Promise((resolve) => { finish = () => resolve(images.map((image) => okResult(image))); }));
      const user = userEvent.setup();
      renderPage();
      await findPatient(user);
      await upload(user, ['a.png']);

      await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
      expect(screen.getByLabelText('Select Files')).toBeDisabled();

      finish();
      await waitFor(() => expect(screen.getByLabelText('Select Files')).toBeEnabled());
    });
  });

  it('says the patient was found (not registered) after a lookup', async () => {
    const user = userEvent.setup();
    renderPage();

    await findPatient(user);

    expect(await screen.findByText('Patient found. You can now upload images for analysis.')).toBeInTheDocument();
    expect(screen.queryByText(/Patient registered/)).not.toBeInTheDocument();
  });

  it('disables Save for Later while the result is being saved', async () => {
    let finishSave;
    resultsService.createResultBatchWithFiles.mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));
    const user = userEvent.setup();
    renderPage();
    await findPatient(user);
    await upload(user, ['a.png']);
    await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
    await user.click(await screen.findByRole('button', { name: 'Save for Later' }));

    expect(screen.getByRole('button', { name: /Save for Later|Loading/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify Results' })).toBeDisabled();

    finishSave({ resultId: 1 });
    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(resultsService.createResultBatchWithFiles).toHaveBeenCalledTimes(1);
  });

  it('asks before discarding the analysis and revokes the preview URLs', async () => {
    const user = userEvent.setup();
    const view = renderPage();
    await findPatient(user);
    await upload(user, ['a.png', 'b.png']);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Discard Analysis?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('a.png')).toBeInTheDocument();

    await removeImage(user, 'a.png');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
  });

  it('offers Compare for every saved image without hovering, so keyboard users can reach it', async () => {
    const user = userEvent.setup();
    continueSavedResult();
    await screen.findByText('Existing Predictions (2)');

    const compareButtons = screen.getAllByRole('button', { name: 'Compare' });
    expect(compareButtons).toHaveLength(2);

    for (let step = 0; step < 60 && !compareButtons[0].matches(':focus'); step += 1) {
      await user.tab();
    }
    expect(compareButtons[0]).toHaveFocus();
  });

  describe('unsaved work', () => {
    const beforeUnloadPrevented = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    it('asks the browser before unloading while there are unsaved images, and not after they are saved', async () => {
      const user = userEvent.setup();
      renderPage();
      await findPatient(user);
      expect(beforeUnloadPrevented()).toBe(false);

      await upload(user, ['a.png']);
      expect(beforeUnloadPrevented()).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
      await user.click(await screen.findByRole('button', { name: 'Save for Later' }));
      expect(await screen.findByText('Home page')).toBeInTheDocument();
      expect(beforeUnloadPrevented()).toBe(false);
    });

    it('asks the browser before unloading edited observations of a continued result', async () => {
      const user = userEvent.setup();
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');
      expect(beforeUnloadPrevented()).toBe(false);

      await user.type(screen.getByLabelText('Observations'), 'Draft.');

      expect(beforeUnloadPrevented()).toBe(true);
    });

    it('asks the browser before unloading an edited dilution of a saved image', async () => {
      const user = userEvent.setup();
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');

      await pickDilution(user, 'saved1.png', '1:320');

      expect(beforeUnloadPrevented()).toBe(true);
    });
  });

  describe('continue mode', () => {
    const continueEntry = { pathname: '/dashboard/analysis', state: { continueResultId: 42, timestamp: 1 } };

    it('leaves the continued result when the page is opened again without one', async () => {
      const user = userEvent.setup();
      renderWithNavigator(continueEntry);
      await screen.findByText('Existing Predictions (2)');

      await user.click(screen.getByRole('button', { name: 'Open new analysis' }));

      expect(await screen.findByLabelText('Document Type')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Existing Predictions/ })).not.toBeInTheDocument();
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });

    it('does not navigate or notify when a result load fails after the page was left', async () => {
      let failLoad;
      resultsService.getResultById.mockReturnValue(new Promise((resolve, reject) => { failLoad = reject; }));
      const user = userEvent.setup();
      renderWithNavigator(continueEntry);

      await user.click(screen.getByRole('button', { name: 'Open reports' }));
      expect(screen.getByText('Reports page')).toBeInTheDocument();

      await act(async () => {
        failLoad(Object.assign(new Error('Request failed'), { response: { status: 500, data: {} } }));
      });

      expect(screen.getByText('Reports page')).toBeInTheDocument();
      expect(screen.queryByText('Home page')).not.toBeInTheDocument();
      expect(screen.queryByText('Could Not Load Result')).not.toBeInTheDocument();
    });
  });

  describe('prediction signatures', () => {
    it('sends each image signature and classification level with its prediction, in upload order', async () => {
      const levels = { 'a.png': 'general', 'b.png': 'competent', 'c.png': 'expert' };
      predictImages.mockImplementation(async (images) =>
        images.map((image) => ({ ...okResult(image), classificationLevel: levels[image.file.name] }))
      );
      const user = userEvent.setup();
      renderPage();
      await findPatient(user);
      await upload(user, ['a.png', 'b.png', 'c.png']);
      await removeImage(user, 'b.png');

      await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
      await user.click(await screen.findByRole('button', { name: 'Save for Later' }));

      await waitFor(() => expect(resultsService.createResultBatchWithFiles).toHaveBeenCalledTimes(1));
      const [data, files] = resultsService.createResultBatchWithFiles.mock.calls[0];
      expect(files.map((file) => file.name)).toEqual(['a.png', 'c.png']);
      expect(data.predictions).toEqual([
        { prediction: 'NUCLEAR_HOMOGENEOUS', confidencePercentage: 91.5, classificationLevel: 'general', signature: 'sig-a.png', dilution: '80' },
        { prediction: 'NUCLEAR_HOMOGENEOUS', confidencePercentage: 91.5, classificationLevel: 'expert', signature: 'sig-c.png', dilution: '80' },
      ]);
    });

    it('sends the signature and classification level of images appended to a saved result', async () => {
      const user = userEvent.setup();
      continueSavedResult();
      await screen.findByText('Existing Predictions (2)');

      await upload(user, ['n1.png', 'n2.png']);
      await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
      await user.click(await screen.findByRole('button', { name: 'Save for Later' }));

      await waitFor(() => expect(resultsService.addPredictionsToResult).toHaveBeenCalledTimes(1));
      const [, data, files] = resultsService.addPredictionsToResult.mock.calls[0];
      expect(files.map((file) => file.name)).toEqual(['n1.png', 'n2.png']);
      expect(data.newPredictions).toEqual([
        { prediction: 'NUCLEAR_HOMOGENEOUS', confidencePercentage: 91.5, classificationLevel: 'competent', signature: 'sig-n1.png', dilution: '80' },
        { prediction: 'NUCLEAR_HOMOGENEOUS', confidencePercentage: 91.5, classificationLevel: 'competent', signature: 'sig-n2.png', dilution: '80' },
      ]);
    });

    it('blocks saving an unsigned image until it is analyzed again, then sends the new signature', async () => {
      predictImages.mockImplementationOnce(async (images) =>
        images.map((image) => ({ ...okResult(image), signature: image.file.name === 'b.png' ? null : `sig-${image.file.name}` }))
      );
      predictImages.mockImplementationOnce(async (images) =>
        images.map((image) => ({ ...okResult(image), signature: `resigned-${image.file.name}` }))
      );
      const user = userEvent.setup();
      renderPage();
      await findPatient(user);
      await upload(user, ['a.png', 'b.png']);

      await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
      await user.click(await screen.findByRole('button', { name: 'Save for Later' }));

      expect(await screen.findByText(/b\.png has no prediction signature/)).toBeInTheDocument();
      expect(resultsService.createResultBatchWithFiles).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Analyze Images' }));
      await waitFor(() => expect(predictImages).toHaveBeenCalledTimes(2));
      expect(predictImages.mock.calls[1][0].map((image) => image.file.name)).toEqual(['b.png']);

      await user.click(screen.getByRole('button', { name: 'Save for Later' }));
      await waitFor(() => expect(resultsService.createResultBatchWithFiles).toHaveBeenCalledTimes(1));
      const [data] = resultsService.createResultBatchWithFiles.mock.calls[0];
      expect(data.predictions.map((p) => p.signature)).toEqual(['sig-a.png', 'resigned-b.png']);
    });
  });
});
