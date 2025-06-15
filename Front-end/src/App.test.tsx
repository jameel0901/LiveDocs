import React from 'react';
import { render, screen } from '@testing-library/react';
import DocumentEditor from './DocumentEditor';

test('renders editor textarea', () => {
  render(<DocumentEditor id="test" onExit={() => {}} />);
  const textarea = screen.getByRole('textbox');
  expect(textarea).toBeInTheDocument();
});
