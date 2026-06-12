import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}), { virtual: true });

jest.mock('./hooks/useDocumentPresence', () => ({
  useDocumentPresence: () => ({
    getDocumentPresence: () => [],
    presenceMap: {},
    isConnected: false,
  }),
}));

beforeEach(() => {
  const analytics = {
    ownedDocuments: 1,
    sharedWithYou: 1,
    incomingRequests: 0,
    outgoingRequests: 0,
    collaborators: 1,
    networksJoined: 1,
    discoverableDocuments: 2,
    totalWords: 120,
    totalCharacters: 600,
    editAccessCount: 0,
    viewAccessCount: 1,
    collaborationScore: 42,
    weeklyActivity: [
      { label: 'Mon', count: 1 },
      { label: 'Tue', count: 0 },
      { label: 'Wed', count: 0 },
      { label: 'Thu', count: 0 },
      { label: 'Fri', count: 0 },
      { label: 'Sat', count: 0 },
      { label: 'Sun', count: 0 },
    ],
    recentActivity: [],
  };

  const f = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _id: '1',
        name: 'Alice',
        email: 'a@example.com',
        documents: [
          {
            _id: 'doc1',
            name: 'Doc1',
            owner: { _id: '1', name: 'Alice' },
            networkVisible: false,
            sharedUsers: [
              { _id: '2', name: 'Bob', permission: 'view' },
              { _id: '3', name: 'Carol', permission: 'edit' },
            ],
          },
          {
            _id: 'doc2',
            name: 'Shared Doc',
            owner: { _id: '2', name: 'Bob' },
            permission: 'view',
            sharedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
      }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => analytics })
    .mockResolvedValue({ ok: true, json: async () => [] });

  (global as any).fetch = f;
  (window as any).fetch = f;
  localStorage.setItem(
    'user',
    JSON.stringify({ _id: '1', name: 'Alice', email: 'a@example.com', token: 'test-token' })
  );
});

afterEach(() => {
  (global as any).fetch.mockReset();
  localStorage.clear();
});

test('shows shared documents in dashboard', async () => {
  render(<Dashboard />);
  const shared = await screen.findByText('Shared Doc');
  expect(shared).toBeInTheDocument();

  expect(screen.getAllByText('Bob', { exact: false }).length).toBeGreaterThan(0);
  const dateText = new Date('2023-01-01T00:00:00.000Z').toLocaleDateString();
  expect(screen.getByText(dateText, { exact: false })).toBeInTheDocument();
  expect(screen.getByText('Your access', { exact: false })).toBeInTheDocument();
  expect(screen.getAllByText('Read').length).toBeGreaterThan(0);
  expect(screen.getByText('Carol')).toBeInTheDocument();
  expect(screen.getAllByText('Write').length).toBeGreaterThan(0);
});
