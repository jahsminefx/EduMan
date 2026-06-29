import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MainLayout from '../MainLayout';

let currentUser;

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentUser,
    logout: vi.fn()
  })
}));

const renderLayoutForUser = (user) => {
  currentUser = user;

  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<MainLayout />}>
          <Route index element={<div>Dashboard content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('MainLayout navigation', () => {
  it('does not show announcements for SuperAdmin users', () => {
    renderLayoutForUser({
      id: 1,
      name: 'Default Admin',
      role: 'SuperAdmin'
    });

    expect(screen.queryByRole('link', { name: /announcements/i })).not.toBeInTheDocument();
  });

  it('shows announcements for SchoolAdmin users', () => {
    renderLayoutForUser({
      id: 2,
      name: 'Mrs. Adebayo',
      role: 'SchoolAdmin',
      school_name: 'Greenfield Academy'
    });

    expect(screen.getByRole('link', { name: /announcements/i })).toBeInTheDocument();
  });

  it('shows the EduMan AI teacher workflow only to teachers', () => {
    renderLayoutForUser({
      id: 3,
      name: 'Mr. Chidi Eze',
      role: 'Teacher',
      school_name: 'Greenfield Academy'
    });

    expect(screen.getByRole('link', { name: /^eduman ai$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /eduman ai drafts/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /published eduman ai/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /eduman ai logs/i })).not.toBeInTheDocument();
  });

  it('shows EduMan AI management links to School Admin users', () => {
    renderLayoutForUser({
      id: 4,
      name: 'Mrs. Adebayo',
      role: 'SchoolAdmin',
      school_name: 'Greenfield Academy'
    });

    expect(screen.getByRole('link', { name: /^eduman ai$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /eduman ai logs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /eduman ai settings/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /published eduman ai/i })).not.toBeInTheDocument();
  });
});
