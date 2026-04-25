import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 'next/headers' before importing the module under test
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
  })),
}));

// Dynamically import after mocks are in place
const { loginAction } = await import('@/lib/actions/auth.actions');

describe('loginAction (Server Action)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return success on valid API response', async () => {
    // Mock fetch to simulate a successful login
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { email: 'test@example.com' } }),
      headers: new Headers(),
    });

    const formData = new FormData();
    formData.set('email', 'test@example.com');
    formData.set('password', 'password123');

    const result = await loginAction(formData);

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      }),
    );
  });

  it('should return error message on failed login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Invalid credentials' }),
    });

    const formData = new FormData();
    formData.set('email', 'wrong@example.com');
    formData.set('password', 'badpassword');

    const result = await loginAction(formData);

    expect(result).toEqual({ error: 'Invalid credentials' });
  });

  it('should return network error on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const formData = new FormData();
    formData.set('email', 'test@example.com');
    formData.set('password', 'password123');

    const result = await loginAction(formData);

    expect(result).toEqual({ error: 'Network error. Please try again.' });
  });

  it('should extract email and password from FormData', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      headers: new Headers(),
    });

    const formData = new FormData();
    formData.set('email', 'user@domain.com');
    formData.set('password', 'MyP@ss!');

    await loginAction(formData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ email: 'user@domain.com', password: 'MyP@ss!' }),
      }),
    );
  });
});
