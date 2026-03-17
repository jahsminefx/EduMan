import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Login from '../Login';
import { AuthProvider } from '../../contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock the useAuth hook if needed, or wrap in AuthProvider
// For simplicity, we'll wrap in AuthProvider and BrowserRouter

const renderWithProviders = (ui) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Login Page', () => {
  it('renders login form', () => {
    renderWithProviders(<Login />);
    
    expect(screen.getByText('EduMan')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('updates input fields on change', () => {
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  it('shows loading state on submit', async () => {
    renderWithProviders(<Login />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'admin@eduman.local' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
  });
});
