import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders editor textarea', () => {
  render(<App />);
  const textarea = screen.getByRole('textbox');
  expect(textarea).toBeInTheDocument();
});
