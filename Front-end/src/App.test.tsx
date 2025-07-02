import React from 'react';
import { render, screen } from '@testing-library/react';
import DocumentEditor from './DocumentEditor';


beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ name: 'Test', content: '' })
  }) as jest.Mock;
});


test('renders editor', () => {
  const { container } = render(<DocumentEditor id="test" onExit={() => {}} />);
  const editor = container.querySelector('.ql-editor');
  expect(editor).toBeInTheDocument();
});
