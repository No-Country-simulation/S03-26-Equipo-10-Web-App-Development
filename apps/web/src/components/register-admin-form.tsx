'use client';

import React, { FormEvent, useState } from 'react';

interface RegisterAdminFormProps {
  onSubmit: (payload: {
    tenantName: string;
    email: string;
    password: string;
  }) => Promise<void>;
}

export function RegisterAdminForm({ onSubmit }: RegisterAdminFormProps) {
  const [tenantName, setTenantName] = useState('Acme Studio');
  const [email, setEmail] = useState('admin@acme.com');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({ tenantName, email, password });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'No se pudo crear el tenant.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Tenant
        <input
          name="tenantName"
          value={tenantName}
          onChange={event => setTenantName(event.target.value)}
        />
      </label>
      <label>
        Email admin
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
          autoComplete="new-password"
          name="password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
      </label>
      {error ? <div className="notice error">{error}</div> : null}
      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear tenant y admin'}
      </button>
    </form>
  );
}
