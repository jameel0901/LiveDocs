import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn()
}), { virtual: true });

beforeEach(() => {
  const f = jest.fn()
    .mockResolvedValueOnce({
      json: async () => ({
        _id: '1',
        name: 'Alice',
        email: 'a@example.com',
        documents: [
          { _id: 'doc1', name: 'Doc1' },
          { _id: 'doc2', name: 'Shared Doc' }
        ]
      })
    })
    .mockResolvedValue({ json: async () => [] });
  (global as any).fetch = f;
  (window as any).fetch = f;
  localStorage.setItem('user', JSON.stringify({ _id: '1' }));
});

afterEach(() => {
  (global as any).fetch.mockReset();
  localStorage.clear();
});

test('shows shared documents in dashboard', async () => {
  render(<Dashboard />);
  const shared = await screen.findByText('Shared Doc');
  expect(shared).toBeInTheDocument();
});
