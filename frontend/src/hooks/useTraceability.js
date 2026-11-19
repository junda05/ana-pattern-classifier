import { useState, useEffect, useCallback, useRef } from 'react';
import traceabilityService from '../services/api/traceabilityService';
import {
  transformTraceabilityListFromBackend,
  transformTraceabilityDetailFromBackend
} from '../services/utils/traceabilityUtils';

const LIST_ERROR = 'Could not load the audit trail.';
const DETAIL_ERROR = 'Could not load the audit record details.';
const NO_FILTERS = {};

/**
 * Loads audit-trail records page by page, filtered on the server, and the detail of a
 * selected record, with loading and error states for both (errors are shown inline with a retry).
 *
 * Changing the filters starts again from page 1. Responses that arrive after a newer
 * request (another page, other filters, another record) are ignored.
 *
 * @param {Object} [query] - API filters from buildTraceabilityQuery ({ userName, from, to, activityType })
 */
const useTraceability = (query = NO_FILTERS) => {
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Record shown in the detail modal
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const queryKey = JSON.stringify(query);
  const queryRef = useRef(query);
  queryRef.current = query;
  const appliedQueryKeyRef = useRef(queryKey);
  const latestListRequestRef = useRef(0);
  const selectedRecordIdRef = useRef(null);

  const fetchTraceabilityData = useCallback(async (page) => {
    const requestId = latestListRequestRef.current + 1;
    latestListRequestRef.current = requestId;
    const isCurrent = () => latestListRequestRef.current === requestId;

    setIsLoading(true);
    setError(null);
    try {
      const response = await traceabilityService.getRecords({
        page,
        limit: itemsPerPage,
        ...queryRef.current
      });
      if (!isCurrent()) return;

      setData(transformTraceabilityListFromBackend(response.data));
      setTotalRecords(response.total);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page);
    } catch (err) {
      if (!isCurrent()) return;
      setError(LIST_ERROR);
      setData([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [itemsPerPage]);

  const fetchTraceabilityDetail = useCallback(async (traceabilityId) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const response = await traceabilityService.getRecordById(traceabilityId);
      if (selectedRecordIdRef.current !== traceabilityId) return; // another record is open now
      setSelectedRecord(transformTraceabilityDetailFromBackend(response));
    } catch (err) {
      if (selectedRecordIdRef.current !== traceabilityId) return;
      setSelectedRecord(null);
      setDetailError(DETAIL_ERROR);
    } finally {
      if (selectedRecordIdRef.current === traceabilityId) setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    // New filters: start again from page 1
    if (appliedQueryKeyRef.current !== queryKey) {
      appliedQueryKeyRef.current = queryKey;
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
    }
    fetchTraceabilityData(currentPage);
  }, [fetchTraceabilityData, currentPage, queryKey]);

  const changePage = useCallback((pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages && pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
    }
  }, [totalPages, currentPage]);

  /**
   * Opens the detail modal at once (with a spinner) and fetches the full record.
   */
  const selectRecord = useCallback((record) => {
    if (record && record.id) {
      selectedRecordIdRef.current = record.id;
      setSelectedRecordId(record.id);
      setSelectedRecord(null);
      fetchTraceabilityDetail(record.id);
    }
  }, [fetchTraceabilityDetail]);

  const retryRecordDetails = useCallback(() => {
    if (selectedRecordId) fetchTraceabilityDetail(selectedRecordId);
  }, [fetchTraceabilityDetail, selectedRecordId]);

  const closeRecordDetails = useCallback(() => {
    selectedRecordIdRef.current = null;
    setSelectedRecordId(null);
    setSelectedRecord(null);
    setDetailError(null);
    setIsLoadingDetail(false);
  }, []);

  const refresh = useCallback(() => {
    fetchTraceabilityData(currentPage);
  }, [fetchTraceabilityData, currentPage]);

  return {
    data,
    totalRecords,
    isLoading,
    error,
    isLoadingDetail,
    detailError,
    currentPage,
    totalPages,
    itemsPerPage,
    changePage,
    isDetailOpen: selectedRecordId !== null,
    selectedRecord,
    selectRecord,
    retryRecordDetails,
    closeRecordDetails,
    refresh
  };
};

export default useTraceability;
