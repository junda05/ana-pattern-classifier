import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { colors } from '../../config/colors';
import Dropzone from '../ui/Dropzone';
import ImagePreview, { DilutionPicker } from '../ui/ImagePreview';
import AnalysisResults from '../ui/AnalysisResults';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import PatientRegistrationForm from './PatientRegistrationForm';
import VerifyResultsModal from './VerifyResultsModal';
import PredictionImage from '../ui/PredictionImage';
import Badge from '../ui/Badge';
import CompareImageModal from '../ui/CompareImageModal';
import useNotifications from '../../hooks/useNotifications';
import useAuth from '../../hooks/useAuth';
import { useUnsavedChangesGuard } from '../../context/NavigationGuardContext';
import { predictImages } from '../../services/api/predictionService';
import resultsService from '../../services/api/resultsService';
import { getFormattedClassName } from '../../config/classMapping';
import { getConfidenceBadgeType, formatConfidenceText, getPredictionClassBadgeType, getConfidenceColors } from '../../config/confidenceConfig';
import { Lock } from 'lucide-react';
import { extractShortFilename, formatDocumentWithNumber } from '../../services/utils/constants';
import { getApiErrorMessage, isConflictError } from '../../services/utils/apiErrors';
import { pluralize } from '../../services/utils/stringUtils';
import {
  createLocalId,
  buildNewPredictions,
  buildNewCorrections,
  buildExistingCorrections,
  buildDilutionUpdates,
  isSignedResult,
  normalizeObservations,
  withCorrectionNotes,
  applyAppendResponse,
  MAX_IMAGES_PER_RESULT,
} from '../../services/utils/analysisPayload';

const DEFAULT_DILUTION = '80';
const INVALID_CORRECTION_MESSAGE = 'Select a recognized pattern for every correction.';
const TOO_MANY_IMAGES_MESSAGE = `A result can hold at most ${MAX_IMAGES_PER_RESULT} images.`;
const LOCKED_MESSAGE = 'This result is verified and locked. Only an administrator can correct it.';

/**
 * Shared image analysis workflow: patient registration, image upload,
 * prediction, and verification or correction of the results. Also supports
 * adding new images to an existing result.
 *
 * Every selected image gets a stable id when it is added; its preview URL,
 * dilution, analysis result and correction are all keyed by that id, so
 * removing or failing one image never shifts data onto another.
 *
 * Saving a continued result is ONE append request carrying the new images, the dilution
 * edits, every correction, the observations and the status (any of them may be sent alone,
 * e.g. a dilution change of a saved image), so a failed save can simply be retried. The correction-form notes are stored only with the corrections; the result
 * observations are always the page's Observations field (blank is sent as null, clearing them).
 *
 * A VERIFIED result (when opened, or after a save conflict reloads it) is locked: nothing
 * can be added or edited, and only an administrator can correct its saved predictions.
 */

const AnalysisPage = ({ title, description }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showInfo, showError } = useNotifications();
  const { user } = useAuth() ?? {};

  // [{ id, file, previewUrl, dilution }] in upload order
  const [images, setImages] = useState([]);
  // Analysis result per image id
  const [resultsById, setResultsById] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [observations, setObservations] = useState('');
  const [analysisError, setAnalysisError] = useState(null);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [existingResult, setExistingResult] = useState(null); // Result being continued, if any
  const [existingPredictions, setExistingPredictions] = useState([]); // Predictions already saved on that result
  const [dilutionEdits, setDilutionEdits] = useState({}); // New dilution per saved prediction id
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedImageForCompare, setSelectedImageForCompare] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null); // { type: 'remove', id } | { type: 'discard', then }
  const wasContinuingRef = useRef(false); // A result was being continued (to reset when leaving that mode)

  // Revoke every preview URL still alive when the page unmounts
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  const analysisResults = useMemo(
    () => images.filter((image) => resultsById[image.id]).map((image) => ({ ...resultsById[image.id], imageUrl: image.previewUrl })),
    [images, resultsById]
  );
  const successfulResults = useMemo(() => analysisResults.filter((result) => !result.error), [analysisResults]);
  // New, failed and unsigned images; analyzing one again replaces its result and signature
  const imagesToAnalyze = images.filter((image) => !isSignedResult(resultsById[image.id]));
  const unanalyzedImages = images.filter((image) => !resultsById[image.id]);
  const unsignedImages = images.filter(
    (image) => resultsById[image.id] && !resultsById[image.id].error && !resultsById[image.id].signature
  );
  const showResults = analysisResults.length > 0;
  const isLocked = existingResult?.status === 'VERIFIED';
  const canCorrectLocked = isLocked && user?.role === 'ADMIN';
  const hasNewPredictions = successfulResults.length > 0;
  const hasUnsavedWork = images.length > 0;
  // Unsaved images, or edited observations or dilutions of a continued result: ask before the page is left
  const hasUnsavedChanges = hasUnsavedWork
    || buildDilutionUpdates(existingPredictions, dilutionEdits).length > 0
    || (existingResult !== null && normalizeObservations(observations) !== normalizeObservations(existingResult.observations));
  useUnsavedChangesGuard(hasUnsavedChanges);

  /**
   * Discards the selected images, their results and the page observations.
   */
  const discardImages = useCallback(() => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setResultsById({});
    setAnalysisError(null);
    setObservations('');
  }, []);

  /**
   * Continuing an existing result: loads its full data from the API by result ID.
   * Opening the page without a result (e.g. from the sidebar) leaves continue mode and
   * starts a new analysis. A load still running when the page is left, or when another
   * result is opened, is ignored (no state update, no navigation).
   */
  const continueResultId = location.state?.continueResultId;
  const continueTimestamp = location.state?.timestamp;
  useEffect(() => {
    let cancelled = false;

    const resetResult = () => {
      discardImages();
      setCurrentPatient(null);
      setExistingResult(null);
      setExistingPredictions([]);
      setDilutionEdits({});
    };

    if (!continueResultId) {
      // Nothing to continue: clear the processed-result marker
      sessionStorage.removeItem('processedResultId');
      if (wasContinuingRef.current) {
        wasContinuingRef.current = false;
        resetResult();
      }
      return undefined;
    }

    // Reset any previous state before loading the new result
    wasContinuingRef.current = true;
    resetResult();

    // Skip a result that is already loaded, unless this is a fresh navigation (it carries a timestamp)
    const processedResultId = sessionStorage.getItem('processedResultId');
    if (!continueTimestamp && processedResultId === String(continueResultId)) {
      return undefined;
    }

    const loadExistingResult = async () => {
      try {
        const result = await resultsService.getResultById(continueResultId);
        if (cancelled) return;

        if (!result.patient || !result.predictions || result.predictions.length === 0) {
          throw new Error('The result is incomplete.');
        }

        setCurrentPatient(result.patient);
        setExistingResult(result);
        setExistingPredictions(result.predictions);
        setObservations(result.observations || '');

        // Remember this result so it is not loaded again
        sessionStorage.setItem('processedResultId', String(result.resultId));

        // A locked result explains itself in a banner: there is nothing to add
        if (result.status !== 'VERIFIED') {
          showInfo(
            'You can add and analyze new images for this patient. Previously analyzed images are listed under Existing Predictions.',
            { title: 'Continue Analysis' }
          );
        }
      } catch (error) {
        if (cancelled) return;
        showError(
          getApiErrorMessage(error, 'Could not load the result. Please try again from the exam list.'),
          { title: 'Could Not Load Result' }
        );
        sessionStorage.removeItem('processedResultId');
        navigate('/dashboard/home');
      }
    };

    loadExistingResult();
    return () => {
      cancelled = true;
    };
  }, [continueResultId, continueTimestamp, discardImages, navigate, showInfo, showError]);

  const handleFilesSelect = (files) => {
    // A result holds at most MAX_IMAGES_PER_RESULT images, saved ones included
    const room = Math.max(MAX_IMAGES_PER_RESULT - existingPredictions.length - images.length, 0);
    if (files.length > room) {
      showError(TOO_MANY_IMAGES_MESSAGE, { title: 'Too Many Images' });
    }
    const added = files.slice(0, room).map((file) => ({
      id: createLocalId(),
      file,
      previewUrl: URL.createObjectURL(file),
      dilution: DEFAULT_DILUTION,
    }));
    if (added.length > 0) setImages((prev) => [...prev, ...added]);
  };

  const handleDilutionChange = (id, dilution) => {
    setImages((prev) => prev.map((image) => (image.id === id ? { ...image, dilution } : image)));
  };

  const removeImage = (id) => {
    const image = images.find((item) => item.id === id);
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImages((prev) => prev.filter((item) => item.id !== id));
    setResultsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const changePatient = () => {
    discardImages();
    setCurrentPatient(null);
  };

  const handleConfirmPending = () => {
    if (pendingConfirmation?.type === 'remove') {
      removeImage(pendingConfirmation.id);
    } else if (pendingConfirmation?.type === 'discard') {
      if (pendingConfirmation.then === 'changePatient') changePatient();
      else discardImages();
    }
    setPendingConfirmation(null);
  };

  const closePendingConfirmation = useCallback(() => setPendingConfirmation(null), []);

  const handleClearFiles = () => {
    setPendingConfirmation({ type: 'discard', then: 'clear' });
  };

  const handleChangePatient = () => {
    if (hasUnsavedWork) {
      setPendingConfirmation({ type: 'discard', then: 'changePatient' });
    } else {
      changePatient();
    }
  };

  /**
   * Opens the comparison modal for a saved prediction.
   */
  const handleCompareExistingImage = (prediction) => {
    setSelectedImageForCompare({
      imageUrl: prediction.imageUrl,
      imagePath: prediction.imagePath,
      fileName: prediction.imagePath ? extractShortFilename(prediction.imagePath) : 'Image',
      prediction: prediction.prediction,
      confidence: prediction.confidencePercentage,
      formattedPattern: getFormattedClassName(prediction.prediction)
    });
    setShowCompareModal(true);
  };

  /**
   * Called when a patient is found by document or registered.
   */
  const handlePatientSelected = (patient, source) => {
    setCurrentPatient(patient);
    if (source === 'found') {
      showInfo('Patient found. You can now upload images for analysis.', {
        title: 'Patient Found'
      });
    }
  };

  /**
   * Analyzes the images that have no successful result yet (new or failed ones).
   */
  const handleAnalyzeImages = async () => {
    if (imagesToAnalyze.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const results = await predictImages(imagesToAnalyze.map(({ id, file }) => ({ id, file })));
      setResultsById((prev) => ({
        ...prev,
        ...Object.fromEntries(results.map((result) => [result.id, result])),
      }));

      const failed = results.filter((result) => result.error);
      if (failed.length === 0) {
        showSuccess('Analysis completed successfully.', { title: 'Analysis Complete' });
      } else if (failed.length < results.length) {
        showInfo(
          `${results.length - failed.length} of ${pluralize(results.length, 'image')} analyzed; ${failed.length} failed. Failed images are not saved.`,
          { title: 'Analysis Partially Completed' }
        );
      } else {
        setAnalysisError(`None of the images could be analyzed. ${failed[0].errorMessage || ''}`.trim());
      }
    } catch (error) {
      setAnalysisError(error.message || 'Could not analyze the images.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Checks that the page can be saved; shows why not otherwise.
   * @returns {boolean} Whether saving may proceed
   */
  const canSave = () => {
    if (!currentPatient) {
      showError('No patient selected.', { title: 'Error' });
      return false;
    }
    if (unanalyzedImages.length > 0) {
      showError('Analyze the new images before saving.', { title: 'Images Not Analyzed' });
      return false;
    }
    if (unsignedImages.length > 0) {
      const names = unsignedImages.map((image) => image.file.name).join(', ');
      showError(
        `${names} ${unsignedImages.length === 1 ? 'has' : 'have'} no prediction signature. Analyze ${unsignedImages.length === 1 ? 'it' : 'them'} again before saving.`,
        { title: 'Prediction Not Signed' }
      );
      return false;
    }
    if (!existingResult && !hasNewPredictions) {
      showError('There are no analyzed images to save.', { title: 'Nothing to Save' });
      return false;
    }
    return true;
  };

  /**
   * Runs a save and returns to Home on success.
   * @returns {Promise<boolean>} Whether the save succeeded
   */
  const runSave = async (save, fallbackMessage) => {
    setIsSubmitting(true);
    try {
      const message = await save();
      if (message === null) {
        return false;
      }
      showSuccess(message, { title: 'Saved' });
      discardImages();
      setShowVerifyModal(false);
      sessionStorage.removeItem('processedResultId');
      navigate('/dashboard/home');
      return true;
    } catch (error) {
      showError(getApiErrorMessage(error, fallbackMessage), { title: 'Could Not Save' });
      if (existingResult && isConflictError(error)) {
        // The result changed meanwhile (e.g. it was verified): show its current state
        setShowVerifyModal(false);
        await reloadExistingResult(existingResult.resultId);
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Loads the current state of the continued result again (after a 409).
   */
  const reloadExistingResult = async (resultId) => {
    try {
      const result = await resultsService.getResultById(resultId);
      setExistingResult(result);
      setExistingPredictions(result.predictions || []);
      setDilutionEdits({});
    } catch (error) {
      // Keep the current view; the save error has already been reported
    }
  };

  const newPredictionsPayload = () => buildNewPredictions(images, resultsById);
  const dilutionUpdates = () => buildDilutionUpdates(existingPredictions, dilutionEdits);
  const pageObservations = () => normalizeObservations(observations);
  const observationsChanged = () => pageObservations() !== normalizeObservations(existingResult?.observations);

  /**
   * Saves everything pending on the continued result in ONE append request. On success the
   * saved images become existing predictions and the new images are cleared, so nothing is
   * ever sent twice.
   *
   * @param {Object} [options]
   * @param {string} [options.status] - VERIFIED when confirming without corrections; omitted otherwise
   * @param {Array} [options.corrections] - Corrections of the new images (by newPredictions index)
   * @param {Array} [options.existingCorrections] - Corrections of saved predictions (by predictionId)
   * @returns {Promise<Object|null>} API response, or null when there was nothing to save
   */
  const appendToExistingResult = async ({ status, corrections = [], existingCorrections = [] } = {}) => {
    const { predictions, files } = newPredictionsPayload();
    const updatedDilutions = dilutionUpdates();
    const data = {
      ...(predictions.length > 0 && { newPredictions: predictions }),
      ...(updatedDilutions.length > 0 && { updatedDilutions }),
      ...(corrections.length > 0 && { corrections }),
      ...(existingCorrections.length > 0 && { existingCorrections }),
      ...(observationsChanged() && { observations: pageObservations() }),
      ...(status && { status }),
    };
    if (Object.keys(data).length === 0) {
      return null;
    }

    const response = await resultsService.addPredictionsToResult(existingResult.resultId, data, files);

    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setResultsById({});
    setDilutionEdits({});
    setExistingPredictions(applyAppendResponse(existingPredictions, predictions, response));
    setExistingResult((previous) => ({ ...previous, ...response }));
    return response;
  };

  const createResult = (fields) => {
    const { predictions, files } = newPredictionsPayload();
    return resultsService.createResultBatchWithFiles(
      { patientId: currentPatient.patientId, predictions, observations: pageObservations(), ...fields },
      files
    );
  };

  /**
   * Save for Later: stores the results as PENDING (a continued result keeps its status).
   */
  const handleValidateLater = () => {
    if (!canSave()) return;

    runSave(async () => {
      if (!existingResult) {
        await createResult({ status: 'PENDING' });
        return 'Results saved for later verification.';
      }

      const response = await appendToExistingResult();
      if (!response) {
        showInfo('There are no changes to save.', { title: 'Nothing to Save' });
        return null;
      }
      return hasNewPredictions ? 'New predictions added for later verification.' : 'Changes saved successfully.';
    }, 'Could not save the results.');
  };

  /**
   * Confirms the results without corrections and saves them as VERIFIED.
   */
  const handleConfirmResults = async () => {
    if (!canSave()) return false;

    return runSave(async () => {
      if (!existingResult) {
        await createResult({ status: 'VERIFIED' });
        return 'Results confirmed and saved successfully.';
      }

      await appendToExistingResult({ status: 'VERIFIED' });
      return hasNewPredictions
        ? 'New predictions added and result confirmed successfully.'
        : 'Result confirmed successfully.';
    }, 'Could not save the confirmed results.');
  };

  /**
   * Saves the original model predictions together with the user's corrections.
   * A result with corrections becomes CORRECTED; without corrections it is VERIFIED.
   * The correction notes go only to the corrections, never to the result observations.
   */
  const handleCorrectResults = async ({ newCorrections, existingCorrections, observations: correctionNotes }) => {
    if (isLocked) return correctLockedResult(existingCorrections, correctionNotes);
    if (!canSave()) return false;

    const { predictions, indexById } = newPredictionsPayload();
    const newCorrectionList = buildNewCorrections(newCorrections, indexById, predictions);
    const existingCorrectionList = buildExistingCorrections(existingCorrections, existingPredictions);
    if (!newCorrectionList || !existingCorrectionList) {
      showError(INVALID_CORRECTION_MESSAGE, { title: 'Invalid Correction' });
      return false;
    }

    const corrections = withCorrectionNotes(newCorrectionList, correctionNotes);
    const savedCorrections = withCorrectionNotes(existingCorrectionList, correctionNotes);
    const hasCorrections = corrections.length > 0 || savedCorrections.length > 0;

    return runSave(async () => {
      if (!existingResult) {
        await createResult({ ...(corrections.length > 0 && { corrections }), status: 'VERIFIED' });
        return hasCorrections ? 'Results and corrections saved successfully.' : 'Results confirmed and saved successfully.';
      }

      await appendToExistingResult({
        corrections,
        existingCorrections: savedCorrections,
        ...(!hasCorrections && { status: 'VERIFIED' }),
      });
      return hasCorrections ? 'Corrections saved successfully.' : 'Result confirmed successfully.';
    }, 'Could not save the corrections.');
  };

  /**
   * An administrator's correction of a locked (VERIFIED) result: the append request carries
   * only the corrections of its saved predictions, never the page's unsaved edits.
   */
  const correctLockedResult = (existingCorrections, correctionNotes) => {
    const corrections = buildExistingCorrections(existingCorrections, existingPredictions);
    if (!corrections) {
      showError(INVALID_CORRECTION_MESSAGE, { title: 'Invalid Correction' });
      return false;
    }

    return runSave(async () => {
      await resultsService.addPredictionsToResult(
        existingResult.resultId,
        { existingCorrections: withCorrectionNotes(corrections, correctionNotes) },
        []
      );
      return 'Corrections saved successfully.';
    }, 'Could not save the corrections.');
  };

  const handleOpenVerifyModal = () => {
    if (canSave()) setShowVerifyModal(true);
  };

  const renderObservations = () => (
    <div className="mt-6">
      <label htmlFor="analysis-observations" className="block text-sm font-medium text-gray-700 mb-2">
        Observations
      </label>
      <textarea
        id="analysis-observations"
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
        disabled={isSubmitting || isLocked}
        maxLength={1000}
        className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:border-transparent"
        style={{ '--tw-ring-color': colors.primary.red }}
        rows="4"
        placeholder="Add observations about these results…"
      />
    </div>
  );

  const renderSaveActions = (saveLabel) => (
    <div className="mt-6 flex justify-end space-x-3">
      <Button variant="secondary" onClick={handleValidateLater} loading={isSubmitting && !isLocked} disabled={isAnalyzing || isLocked}>
        {saveLabel}
      </Button>
      <Button variant="primary" onClick={handleOpenVerifyModal} disabled={isSubmitting || isAnalyzing || isLocked}>
        Verify Results
      </Button>
      {canCorrectLocked && (
        <Button variant="primary" onClick={() => setShowVerifyModal(true)} loading={isSubmitting}>
          Correct Result
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-left"
          style={{ color: colors.primary.red }}
        >
          {title}
        </h1>
        <p className="text-gray-600 mt-2 text-left">
          {description}
        </p>
      </div>

      {/* Patient registration */}
      {!currentPatient && (
        <PatientRegistrationForm onPatientSelected={handlePatientSelected} />
      )}

      {/* Current patient, with the option to change it */}
      {currentPatient && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Patient:</span> {currentPatient.fullName}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Document:</span> {formatDocumentWithNumber(currentPatient.documentType, currentPatient.documentNumber)}
              </p>
            </div>
            {!existingResult && (
              <Button
                variant="secondary"
                onClick={handleChangePatient}
                disabled={isSubmitting || isAnalyzing}
                className="text-sm"
              >
                Change Patient
              </Button>
            )}
          </div>
        </div>
      )}

      {isLocked && (
        <div role="status" className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <Lock aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-blue-700" />
          <p className="text-sm text-blue-900">{LOCKED_MESSAGE}</p>
        </div>
      )}

      {/* Image upload */}
      {currentPatient && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="mb-6">
            <h2
              className="text-xl font-semibold mb-2 text-left"
              style={{ color: colors.primary.red }}
            >
              Upload Images
            </h2>
            <p className="text-gray-600 text-sm text-left">
              Select one or more images to analyze.
            </p>
          </div>

          <Dropzone
            onFilesSelect={handleFilesSelect}
            acceptedFiles="image/*"
            multiple={true}
            disabled={isAnalyzing || isSubmitting || isLocked}
          />

          {analysisError && (
            <div role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
              <p className="text-sm text-red-700 mt-1">{analysisError}</p>
            </div>
          )}

          {images.length > 0 && (
            <>
              <ImagePreview
                images={images}
                onRemove={(id) => setPendingConfirmation({ type: 'remove', id })}
                onDilutionChange={handleDilutionChange}
                disabled={isAnalyzing || isSubmitting || isLocked}
              />

              <div className="mt-6 flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={handleClearFiles}
                  disabled={isAnalyzing || isSubmitting}
                >
                  Clear
                </Button>

                <Button
                  variant="primary"
                  onClick={handleAnalyzeImages}
                  disabled={imagesToAnalyze.length === 0 || isSubmitting || isLocked}
                  loading={isAnalyzing}
                >
                  Analyze Images
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Existing predictions */}
      {existingPredictions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1 h-5 rounded-full"
              style={{ backgroundColor: colors.primary.red }}
            />
            <h2
              className="text-xl font-semibold text-left"
              style={{ color: colors.text.dark }}
            >
              Existing Predictions ({existingPredictions.length})
            </h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Images previously analyzed for this result.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {existingPredictions.map((prediction, index) => {
              const fileName = prediction.imagePath ? extractShortFilename(prediction.imagePath) : `Image ${index + 1}`;
              const dilution = dilutionEdits[prediction.predictionId] || prediction.dilution;

              return (
                <div
                  key={prediction.predictionId}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-square bg-gray-100 rounded-md mb-3 overflow-hidden relative group">
                    <PredictionImage
                      imageUrl={prediction.imageUrl}
                      imagePath={prediction.imagePath}
                      alt={`Existing prediction ${index + 1}`}
                      className="w-full h-full object-cover"
                      showFilename={false}
                    />
                    {/* Compare button, shown on hover and on keyboard focus */}
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        variant="primary"
                        onClick={() => handleCompareExistingImage(prediction)}
                        className="shadow-lg"
                      >
                        Compare
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                        File
                      </p>
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: colors.text.primary }}
                        title={prediction.imagePath}
                      >
                        {fileName}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                        Prediction
                      </p>
                      <Badge type={getPredictionClassBadgeType(prediction.prediction)}>
                        {getFormattedClassName(prediction.prediction)}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-xs font-medium block mb-1" style={{ color: colors.text.secondary }}>
                        Confidence
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${prediction.confidencePercentage}%`,
                              backgroundColor: getConfidenceColors(prediction.confidencePercentage).bg
                            }}
                          />
                        </div>
                        <Badge type={getConfidenceBadgeType(prediction.confidencePercentage)}>
                          {formatConfidenceText(prediction.confidencePercentage)}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium block mb-2" style={{ color: colors.text.secondary }}>
                        Sample Dilution
                      </p>
                      <DilutionPicker
                        fileName={fileName}
                        value={dilution}
                        onChange={(value) => setDilutionEdits((prev) => ({ ...prev, [prediction.predictionId]: value }))}
                        disabled={isSubmitting || isLocked}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Observations and actions for existing predictions */}
          {!showResults && (
            <>
              {renderObservations()}
              {renderSaveActions('Save Changes')}
            </>
          )}
        </div>
      )}

      {showResults && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2
            className="text-xl font-semibold mb-4 text-left"
            style={{ color: colors.primary.red }}
          >
            {existingPredictions.length > 0 ? 'New Analysis Results' : 'Analysis Results'}
          </h2>

          <AnalysisResults results={analysisResults} />

          {renderObservations()}
          {renderSaveActions('Save for Later')}
        </div>
      )}

      {/* Result verification */}
      <VerifyResultsModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onConfirm={handleConfirmResults}
        onCorrect={handleCorrectResults}
        results={isLocked ? [] : successfulResults}
        existingPredictions={existingPredictions}
        patient={currentPatient}
        correctionOnly={isLocked}
      />

      {/* Image comparison */}
      <CompareImageModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        selectedImage={selectedImageForCompare}
      />

      <ConfirmDialog
        isOpen={pendingConfirmation?.type === 'remove'}
        title="Remove Image?"
        confirmLabel="Remove Image"
        destructive
        onConfirm={handleConfirmPending}
        onCancel={closePendingConfirmation}
      >
        The image and its analysis result will be removed from this analysis.
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={pendingConfirmation?.type === 'discard'}
        title="Discard Analysis?"
        confirmLabel="Discard"
        destructive
        onConfirm={handleConfirmPending}
        onCancel={closePendingConfirmation}
      >
        The selected images and their unsaved results will be discarded.
      </ConfirmDialog>
    </div>
  );
};

export default AnalysisPage;
