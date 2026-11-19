import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { colors, shadows } from '../../config/colors';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import InlineError from '../ui/InlineError';
import PredictionImage from '../ui/PredictionImage';
import reportsService from '../../services/api/reportsService';
import { formatGender, formatDocumentWithNumber, formatDilution } from '../../services/utils/constants';
import { formatDate, formatDateOnly } from '../../services/utils/dateUtils';
import { getFormattedClassName } from '../../config/classMapping';
import { labProfile } from '../../config/labProfile';
import { pluralize } from '../../services/utils/stringUtils';
import { useFocusTrap } from '../../hooks/useFocusTrap';

// Set on <body> while the report is open; index.css then prints the report alone
const PRINT_ACTIVE_CLASS = 'report-print-active';

/**
 * Printable clinical report for a finalized ANA exam.
 * Loads the report from the API and shows:
 * - Patient details
 * - The responsible physician (the user who verified the result or authored its latest correction)
 * - Every final prediction with its image and dilution
 * - The analysis observations
 *
 * Printing (Print button or the browser shortcut) outputs only the report: the modal is
 * rendered straight into <body>, which is marked with `report-print-active` while it is open,
 * and the `@media print` rules in index.css hide everything else (see `print-hidden`).
 */
const ReportModal = ({ isOpen, onClose, reportId }) => {
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen, onClose);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const data = await reportsService.getReportById(reportId);
      setReportData(data);
    } catch (error) {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  // Load the report when the modal opens; clear it when it closes
  useEffect(() => {
    if (isOpen && reportId) {
      loadReportData();
    } else if (!isOpen) {
      setReportData(null);
      setLoadError(false);
    }
  }, [isOpen, reportId, loadReportData]);

  // Tells the print styles that the report, not the app, is what should be printed
  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.classList.add(PRINT_ACTIVE_CLASS);
    return () => document.body.classList.remove(PRINT_ACTIVE_CLASS);
  }, [isOpen]);

  if (!isOpen) return null;

  // Results date: when the result was last verified or corrected (stored by the API)
  const resultsDate = reportData ? formatDate(reportData.lastModifiedAt || reportData.dateAndHour) : '';

  const formatPhoneNumber = (prefix, number) => {
    if (!number) return '';
    return `${prefix || ''} ${number}`.trim();
  };

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="report-print-root fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Clinical Report"
          tabIndex={-1}
          className="report-print-dialog bg-white rounded-lg shadow-xl overflow-y-auto focus:outline-none"
          style={{
            width: '95%',
            maxWidth: '1000px',
            height: '90vh',
            borderLeft: `6px solid ${colors.primary.red}`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {loadError ? (
            <div className="flex flex-col justify-center gap-4 py-20 px-8" style={reportStyles.content}>
              <InlineError message="Could not load the report." onRetry={loadReportData} />
              <div className="flex justify-center">
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : isLoading || !reportData ? (
            <div className="flex justify-center items-center py-20" style={reportStyles.content} role="status">
              <LoadingSpinner size="lg" type="circle" color="primary" label={null} />
              <span className="ml-3 text-gray-600">Loading report…</span>
            </div>
          ) : (
            <div style={reportStyles.content}>
              {/* Header Section */}
              <div className="print-avoid-break" style={reportStyles.header}>
                <div style={reportStyles.labSection}>
                  <div style={reportStyles.labName}>{labProfile.name}</div>
                  {labProfile.address && (
                    <div style={reportStyles.labAddress}>{labProfile.address}</div>
                  )}
                </div>

                <div style={reportStyles.headerCenterSection}>
                  {/* Report title */}
                  <div style={reportStyles.serviceOrderTitle}>CLINICAL REPORT</div>

                  {/* Patient and Service Info */}
                  <div style={reportStyles.patientServiceInfo}>
                    <div style={reportStyles.infoRow}>
                      <div style={reportStyles.infoField}>
                        <span style={reportStyles.label}>PATIENT:</span>
                        <div style={reportStyles.fieldValue}>
                          {reportData.patient.fullName.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div style={reportStyles.infoRow}>
                      <div style={reportStyles.infoField}>
                        <span style={reportStyles.label}>SEX:</span>
                        <div style={reportStyles.fieldValue}>
                          {formatGender(reportData.patient.gender)}
                        </div>
                      </div>
                      <div style={reportStyles.infoField}>
                        <span style={reportStyles.label}>DATE OF BIRTH:</span>
                        <div style={reportStyles.fieldValue}>
                          {formatDateOnly(reportData.patient.birthDate)}
                        </div>
                      </div>
                    </div>

                    <div style={reportStyles.infoRow}>
                      <div style={reportStyles.infoField}>
                        <span style={reportStyles.label}>IDENTIFICATION:</span>
                        <div style={reportStyles.fieldValue}>
                          {formatDocumentWithNumber(reportData.patient.documentType, reportData.patient.documentNumber)}
                        </div>
                      </div>
                      <div style={reportStyles.infoField}>
                        <span style={reportStyles.label}>PHONE:</span>
                        <div style={reportStyles.fieldValue}>
                          {formatPhoneNumber(reportData.patient.phonePrefix, reportData.patient.phoneNumber)}
                        </div>
                      </div>
                    </div>

                    <div style={reportStyles.infoRow}>
                      <div style={reportStyles.infoField}>
                        <span style={reportStyles.label}>RESPONSIBLE PHYSICIAN:</span>
                        <div style={reportStyles.fieldValue}>
                          {reportData.medic.fullName.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Dates */}
              <div style={reportStyles.serviceDates}>
                <div style={reportStyles.dateField}>
                  <span style={reportStyles.dateLabel}>Exam Date and Time</span>
                  <div style={reportStyles.dateValue}>
                    {formatDate(reportData.dateAndHour)}
                  </div>
                </div>
                <div style={reportStyles.dateField}>
                  <span style={reportStyles.dateLabel}>Results Date and Time</span>
                  <div style={reportStyles.dateValue}>
                    {resultsDate}
                  </div>
                </div>
                <div style={reportStyles.dateField}>
                  <span style={reportStyles.dateLabel}>Delivery</span>
                  <div style={reportStyles.dateValue}>Email: {reportData.patient.email || 'N/A'}</div>
                </div>
                <div className="print-hidden" style={reportStyles.pageInfo}>Page 1 of 1</div>
              </div>

              {/* Test Results Section */}
              <div style={reportStyles.testResultsSection}>
                <div style={reportStyles.testTitle}>{labProfile.department}</div>

                <div style={reportStyles.testDetails}>
                  <div style={reportStyles.testTechnique}>
                    <span style={reportStyles.techniqueLabel}>Technique:</span>
                    <span style={reportStyles.techniqueValue}>INDIRECT IMMUNOFLUORESCENCE (IIF)</span>
                    <span style={reportStyles.testDate}>
                      Results date and time: {resultsDate}
                    </span>
                  </div>
                </div>

                {/* Every prediction of the result, each with its final pattern (latest correction or model prediction) */}
                {reportData.predictions && reportData.predictions.length > 0 && (
                  <>
                    <div style={reportStyles.resultsHeader}>
                      <div style={reportStyles.resultsTitle}>
                        Antinuclear Antibodies (ANA) on HEp-2 Cells — Final Results
                      </div>
                      <div style={reportStyles.resultsCount}>
                        {pluralize(reportData.predictions.length, 'pattern identified', 'patterns identified')}
                      </div>
                    </div>

                    <div style={reportStyles.resultsGrid}>
                      {reportData.predictions.map((prediction, index) => {
                        const formattedPattern = getFormattedClassName(prediction.finalPattern);

                        return (
                          <div key={prediction.predictionId} className="print-avoid-break" style={reportStyles.resultCard}>
                            <div style={reportStyles.resultImageWrapper}>
                              <PredictionImage
                                imageUrl={prediction.imageUrl}
                                imagePath={prediction.imagePath}
                                alt={`Result ${index + 1}`}
                                className="w-full h-full object-cover"
                                showFilename={false}
                              />
                            </div>

                            <div style={reportStyles.resultInfo}>
                              <div style={reportStyles.resultMainInfo}>
                                <div style={reportStyles.patternLabel}>Final Pattern</div>
                                <div style={reportStyles.patternValue}>{formattedPattern}</div>
                              </div>

                              <div style={reportStyles.resultSecondaryInfo}>
                                <div style={reportStyles.infoItem}>
                                  <span style={reportStyles.infoItemLabel}>Dilution:</span>
                                  <span style={reportStyles.infoItemValue}>{formatDilution(prediction.dilution)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="print-avoid-break" style={reportStyles.observationsSection}>
                  <div style={reportStyles.observationsTitle}>Observations:</div>
                  <div style={reportStyles.observationsContent}>
                    {reportData.observations || 'No additional observations.'}
                  </div>
                </div>
              </div>

              {/* Signature Section */}
              <div className="print-avoid-break" style={reportStyles.signatureSection}>
                <div style={reportStyles.signatureLine}>
                  <div style={reportStyles.signatureInfo}>
                    <div style={reportStyles.signatureName}>{reportData.medic.fullName}</div>
                    <div style={reportStyles.signatureTitle}>
                      Professional License No.: {reportData.medic.professionalCard}
                    </div>
                    {reportData.verifiedBy && (
                      <div style={reportStyles.signatureTitle}>
                        {`Verified by ${reportData.verifiedBy.fullName}${reportData.verifiedAt ? ` on ${formatDate(reportData.verifiedAt)}` : ''}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons (never printed) */}
              <div className="print-hidden" style={reportStyles.reportActions}>
                <Button variant="secondary" onClick={() => window.print()}>
                  Print
                </Button>
                <Button variant="primary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

// Inline styles reproducing the printed report template, plus the prediction cards
const reportStyles = {
  content: {
    padding: '20px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    fontSize: '12px',
    lineHeight: '1.3',
    color: colors.report.text.ink,
    backgroundColor: 'white'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: `2px solid ${colors.primary.red}`
  },
  labSection: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    maxWidth: '240px'
  },
  labName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: colors.primary.red,
    lineHeight: '1.3'
  },
  labAddress: {
    fontSize: '11px',
    color: colors.report.text.ink,
    marginTop: '4px'
  },
  headerCenterSection: {
    flex: 1,
    margin: '0 20px',
    maxWidth: '400px',
    minWidth: '350px'
  },
  serviceOrderTitle: {
    textAlign: 'left',
    fontSize: '16px',
    fontWeight: 'bold',
    color: colors.primary.red,
    margin: '10px 0',
    textDecoration: 'underline'
  },
  patientServiceInfo: {
    marginBottom: '10px'
  },
  infoRow: {
    display: 'flex',
    gap: '15px',
    marginBottom: '6px',
    alignItems: 'center'
  },
  infoField: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1
  },
  label: {
    fontWeight: 'bold',
    color: colors.report.text.ink,
    fontSize: '11px',
    whiteSpace: 'nowrap'
  },
  fieldValue: {
    borderBottom: `1px solid ${colors.report.text.ink}`,
    paddingBottom: '1px',
    minWidth: '100px',
    maxWidth: '450px',
    flex: 1,
    fontSize: '11px'
  },
  serviceDates: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '15px 0',
    padding: '10px 0',
    borderTop: `1px solid ${colors.border.rule}`,
    borderBottom: `1px solid ${colors.border.rule}`
  },
  dateField: {
    textAlign: 'center',
    flex: 1
  },
  dateLabel: {
    fontSize: '10px',
    color: colors.report.text.muted,
    display: 'block',
    marginBottom: '2px'
  },
  dateValue: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: colors.report.text.ink
  },
  pageInfo: {
    fontSize: '10px',
    color: colors.report.text.muted
  },
  testResultsSection: {
    margin: '20px 0'
  },
  testTitle: {
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    color: colors.primary.red,
    marginBottom: '15px'
  },
  testDetails: {
    marginBottom: '15px'
  },
  testTechnique: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '11px'
  },
  techniqueLabel: {
    fontWeight: 'bold',
    color: colors.report.text.ink
  },
  techniqueValue: {
    color: colors.report.text.muted
  },
  testDate: {
    color: colors.report.text.muted,
    fontSize: '10px'
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: `2px solid ${colors.primary.red}`
  },
  resultsTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: colors.primary.red,
    letterSpacing: '0.3px'
  },
  resultsCount: {
    fontSize: '11px',
    fontWeight: '600',
    color: colors.report.text.muted,
    backgroundColor: colors.background.gray,
    padding: '4px 12px',
    borderRadius: '12px',
    border: `1px solid ${colors.border.light}`
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '24px'
  },
  resultCard: {
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: '10px',
    overflow: 'hidden',
    backgroundColor: 'white',
    transition: 'all 0.2s ease',
    boxShadow: shadows.card
  },
  resultImageWrapper: {
    aspectRatio: '1',
    backgroundColor: colors.background.subtle,
    overflow: 'hidden',
    borderBottom: `1px solid ${colors.border.subtle}`,
    position: 'relative'
  },
  resultInfo: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  resultMainInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingBottom: '10px',
    borderBottom: `1px solid ${colors.border.faint}`
  },
  patternLabel: {
    fontSize: '9px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: colors.report.text.caption
  },
  patternValue: {
    fontSize: '12px',
    fontWeight: '700',
    color: colors.primary.red,
    lineHeight: '1.3'
  },
  resultSecondaryInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
  },
  infoItemLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: colors.report.text.muted
  },
  infoItemValue: {
    fontSize: '10px',
    color: colors.report.text.ink,
    fontWeight: '500',
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '140px'
  },
  observationsSection: {
    margin: '20px 0',
    padding: '15px',
    backgroundColor: colors.background.lightGray,
    borderRadius: '4px'
  },
  observationsTitle: {
    fontWeight: 'bold',
    color: colors.primary.red,
    fontSize: '12px',
    marginBottom: '8px'
  },
  observationsContent: {
    fontSize: '11px',
    color: colors.report.text.ink,
    lineHeight: '1.4'
  },
  signatureSection: {
    marginTop: '30px',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  signatureLine: {
    textAlign: 'center',
    width: '250px'
  },
  signatureInfo: {
    fontSize: '10px',
    color: colors.report.text.ink
  },
  signatureName: {
    fontWeight: 'bold',
    marginBottom: '2px',
    paddingTop: '10px',
    borderTop: `1px solid ${colors.report.text.ink}`
  },
  signatureTitle: {
    color: colors.report.text.muted
  },
  reportActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: `1px solid ${colors.border.rule}`,
    gap: '12px'
  }
};

export default ReportModal;