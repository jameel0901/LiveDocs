const defaultUrl =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://livedocs-gool.onrender.com';

export const API_URL = process.env.REACT_APP_API_URL || defaultUrl;
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || API_URL;
