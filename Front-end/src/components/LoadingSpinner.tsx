import React from 'react';

interface LoadingSpinnerProps {
  label?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ label = 'Loading...' }) => (
  <div className="loading-state" role="status" aria-live="polite">
    <span className="loading-state__spinner" aria-hidden="true" />
    <p>{label}</p>
  </div>
);

export default LoadingSpinner;
