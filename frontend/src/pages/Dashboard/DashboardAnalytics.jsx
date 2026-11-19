import { colors } from '../../config/colors';
import AnalyticsDashboard from '../../components/traceability/AnalyticsDashboard';

/**
 * Analytics page (administrators only). AnalyticsDashboard loads its own data.
 */
const DashboardAnalytics = () => {
  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: colors.primary.red }}
        >
          Analytics
        </h1>
        <p className="text-gray-600 mt-2">
          Statistics on classification results and model performance.
        </p>
      </div>

      <AnalyticsDashboard />
    </div>
  );
};

export default DashboardAnalytics;
