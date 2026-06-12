const trimTrailingSlash = (url: string) => url.replace(/\/$/, '');

const resolveUrl = (value: string | undefined, variableName: string, devFallback: string) => {
  if (value?.trim()) {
    return trimTrailingSlash(value.trim());
  }

  if (process.env.NODE_ENV !== 'production') {
    return trimTrailingSlash(devFallback);
  }

  throw new Error(
    `${variableName} is required for production builds. Set it in .env.production or your CI/host environment.`
  );
};

export const API_BASE_URL = resolveUrl(
  process.env.REACT_APP_API_BASE_URL,
  'REACT_APP_API_BASE_URL',
  'http://localhost:5000'
);

export const SOCKET_URL = resolveUrl(
  process.env.REACT_APP_SOCKET_URL,
  'REACT_APP_SOCKET_URL',
  API_BASE_URL
);
