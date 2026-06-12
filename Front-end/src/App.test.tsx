import React from 'react';
import { render, screen } from '@testing-library/react';
import DocumentEditor from './DocumentEditor';

jest.mock('socket.io-client', () => ({
  io: () => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}), { virtual: true });

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        name: 'Test',
        content: '',
        contentSegments: [],
        permission: 'edit',
      }),
  }) as jest.Mock;

  localStorage.setItem(
    'user',
    JSON.stringify({
      _id: '1',
      name: 'Alice',
      email: 'a@example.com',
      token: 'test-token',
    })
  );
});

afterAll(() => {
  localStorage.clear();
});

test('renders editor textbox', () => {
  render(<DocumentEditor id="test" onExit={() => {}} />);
  expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
});
