import { useEffect, useState } from 'react';
import axiosClient from '../config/axios';

const isLocalUrl = (url) => url.startsWith('blob:') || url.startsWith('data:');

/**
 * Loads an image that the API serves behind JWT authentication.
 *
 * API image URLs (absolute, or relative to the API base such as
 * "/files/reference/<class>/<file>") are downloaded as blobs through the
 * authenticated axios client and exposed as object URLs, which are revoked
 * when the URL changes or the component unmounts. Local object/data URLs are
 * returned as they are.
 *
 * @param {string} url - Image URL
 * @returns {{ src: string|null, loading: boolean, error: boolean }}
 */
const useAuthorizedImage = (url) => {
  const [state, setState] = useState({ src: null, loading: false, error: false });

  useEffect(() => {
    if (!url) {
      setState({ src: null, loading: false, error: true });
      return undefined;
    }
    if (isLocalUrl(url)) {
      setState({ src: url, loading: false, error: false });
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;
    setState({ src: null, loading: true, error: false });

    axiosClient
      .get(url, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setState({ src: objectUrl, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, loading: false, error: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  // A local URL is usable immediately, before the effect runs.
  if (url && isLocalUrl(url) && state.src !== url) {
    return { src: url, loading: false, error: false };
  }
  return state;
};

export default useAuthorizedImage;
