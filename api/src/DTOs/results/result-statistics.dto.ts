/**
 * Result statistics
 *
 * Metrics for the Analytics dashboard, computed PER PREDICTION (IMAGE).
 */

export class ResultStatisticsDto {
  /**
   * Total validated predictions (predictions of results with status VERIFIED or CORRECTED)
   */
  totalValidated: number;

  /**
   * Model accuracy: percentage of predictions without corrections
   * (predictions without corrections / total validated predictions) * 100
   */
  precision: number;

  /**
   * Correction rate: percentage of predictions with corrections
   * (predictions with corrections / total validated predictions) * 100
   */
  correctionRate: number;

  /**
   * Total predictions without corrections (classified correctly)
   */
  totalVerifiedWithoutCorrections: number;

  /**
   * Total predictions with corrections
   */
  totalCorrected: number;
}
