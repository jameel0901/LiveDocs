import React from 'react';
import { render, screen } from '@testing-library/react';
import DocumentEditor from './DocumentEditor';


beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ name: 'Test', content: '' }) })
  ) as jest.Mock;
});


test('renders editor textarea', () => {
  render(<DocumentEditor id="test" onExit={() => {}} />);
  const textarea = screen.getByRole('textbox');
  expect(textarea).toBeInTheDocument();
});
