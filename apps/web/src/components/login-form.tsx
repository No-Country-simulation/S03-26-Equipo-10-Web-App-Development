'use client';

import React, { FormEvent, useState } from 'react';

interface LoginFormProps {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({ email, password });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'No se pudo iniciar sesión.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          autoComplete="email"
          name="email"
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          autoComplete="current-password"
          name="password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
      </label>
      {error ? <div className="notice error">{error}</div> : null}
      <button type="submit" disabled={loading}>
        {loading ? 'Ingresando...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
