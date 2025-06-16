import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}), { virtual: true });

beforeEach(() => {
  const f = jest.fn()
    .mockResolvedValueOnce({
      json: async () => ({
        _id: '1',
        name: 'Alice',
        email: 'a@example.com',
        documents: [

          { _id: 'doc1', name: 'Doc1', owner: { _id: '1', name: 'Alice' } },
          {
            _id: 'doc2',
            name: 'Shared Doc',
            owner: { _id: '2', name: 'Bob' },
            sharedAt: '2023-01-01T00:00:00.000Z'
          }

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

  const owner = screen.getByText('Bob', { exact: false });
  expect(owner).toBeInTheDocument();
  const dateText = new Date('2023-01-01T00:00:00.000Z').toLocaleDateString();
  expect(screen.getByText(dateText, { exact: false })).toBeInTheDocument();
});
