import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLayout from '../../../layouts/PublicLayout';
import AboutPage from '../AboutPage';
import ContactPage from '../ContactPage';
import HomePage from '../HomePage';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, login: vi.fn(), register: vi.fn() }),
}));

let scrollIntoView;

beforeEach(() => {
  scrollIntoView = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    callback();
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderPublicRoute = (initialPath) => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

const expectSignInToTargetHomeAuth = () => {
  expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/#auth');
};

describe('public page sign in link', () => {
  it('opens the home auth section from the about page', async () => {
    renderPublicRoute('/about');

    expectSignInToTargetHomeAuth();
    fireEvent.click(screen.getByRole('link', { name: 'Sign In' }));

    expect(await screen.findByPlaceholderText('you@school.edu')).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('opens the home auth section from the contact page', async () => {
    renderPublicRoute('/contact');

    expectSignInToTargetHomeAuth();
    fireEvent.click(screen.getByRole('link', { name: 'Sign In' }));

    expect(await screen.findByPlaceholderText('you@school.edu')).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });
});
