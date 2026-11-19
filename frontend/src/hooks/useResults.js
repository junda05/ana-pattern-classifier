import { useState, useEffect, useCallback, useRef } from 'react';
import resultsService from '../services/api/resultsService';
import useNotifications from './useNotifications';
import { getApiErrorMessage } from '../services/utils/apiErrors';

/** Wait after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Loads paginated results, with server-side status filter (PENDING, VERIFIED) and
 * patient search (name or document number). The search is debounced and starts again
 * from page 1; responses of superseded requests are ignored.
 *
 * @param {Object} config
 * @param {number} config.initialPage - Initial page (default: 1)
 * @param {number} config.initialLimit - Items per page (default: 10)
 * @param {string} config.initialStatus - Initial status filter (default: null)
 * @param {boolean} config.autoLoad - Load on mount (default: true)
 * @param {boolean} config.showErrorNotifications - Show a toast on load errors (default: false)
 *
 * @returns {Object} Results, pagination, filters, loading state and actions
 */
const useResults = ({
  initialPage = 1,
  initialLimit = 10,
  initialStatus = null,
  autoLoad = true,
  showErrorNotifications = false
} = {}) => {
  const { showError } = useNotifications();

  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    totalPages: 0
  });

  // search: the term sent to the API (applied after the debounce)
  const [filters, setFilters] = useState({
    status: initialStatus,
    search: ''
  });
  // searchTerm: what the user is typing
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const latestRequestRef = useRef(0);

  const fetchResults = useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    const isCurrent = () => latestRequestRef.current === requestId;
    setIsLoading(true);
    setError(null);

    try {
      const response = await resultsService.getResults({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status,
        search: filters.search
      });
      if (!isCurrent()) return;

      setResults(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.total,
        totalPages: response.totalPages
      }));
    } catch (err) {
      if (!isCurrent()) return;
      // 401s are already handled by the axios interceptor and sessionManager.
      if (err.response?.status === 401) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      const errorMessage = getApiErrorMessage(err, 'Could not load results.');
      setError(errorMessage);
      setResults([]);

      if (showErrorNotifications) {
        showError(errorMessage, {
          title: 'Could Not Load Exams'
        });
      }
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filters.status, filters.search, showErrorNotifications, showError]);

  // Apply the typed search after a pause, from page 1
  useEffect(() => {
    const term = searchTerm.trim();
    if (term === filters.search) return undefined;

    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: term }));
      setPagination(prev => ({ ...prev, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm, filters.search]);

  useEffect(() => {
    if (autoLoad) {
      fetchResults();
    }
  }, [fetchResults, autoLoad]);

  const changePage = useCallback((newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  }, []);

  const changeLimit = useCallback((newLimit) => {
    setPagination(prev => ({
      ...prev,
      limit: newLimit,
      page: 1
    }));
  }, []);

  const changeStatusFilter = useCallback((newStatus) => {
    setFilters(prev => ({
      ...prev,
      status: newStatus || null
    }));
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  }, []);

  /**
   * Updates the typed search; it reaches the API after SEARCH_DEBOUNCE_MS.
   */
  const changeSearchTerm = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  const refresh = useCallback(() => {
    fetchResults();
  }, [fetchResults]);

  const reset = useCallback(() => {
    setFilters({
      status: initialStatus,
      search: ''
    });
    setSearchTerm('');
    setPagination({
      page: initialPage,
      limit: initialLimit,
      total: 0,
      totalPages: 0
    });
  }, [initialPage, initialLimit, initialStatus]);

  return {
    results,
    pagination,
    filters,
    searchTerm,
    isLoading,
    error,
    changePage,
    changeLimit,
    changeStatusFilter,
    changeSearchTerm,
    refresh,
    reset,
    hasResults: results.length > 0,
    isEmpty: !isLoading && results.length === 0
  };
};

export default useResults;
