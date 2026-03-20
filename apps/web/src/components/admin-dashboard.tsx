'use client';

import React, { useEffect, useState } from 'react';
import { ApiError, requestApi, SessionPayload, TenantUser, TestimonialRecord } from '../lib/api';
import { clearSession, getStoredSession } from '../lib/session-store';

interface CreateUserPayload {
  email: string;
  password: string;
  role: 'admin' | 'editor';
}

export function AdminDashboard() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const storedSession = getStoredSession();
    setSession(storedSession);

    if (!storedSession) {
      setLoading(false);
      return;
    }

    void loadDashboard(storedSession.tokens.accessToken);
  }, []);

  async function loadDashboard(accessToken: string) {
    setLoading(true);
    setError(null);

    try {
      const [meResponse, usersResponse, testimonialsResponse] = await Promise.all([
        requestApi<SessionPayload['user']>('/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        requestApi<TenantUser[]>('/users', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        requestApi<TestimonialRecord[]>('/testimonials', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      setSession(current =>
        current
          ? {
              ...current,
              user: meResponse.data,
            }
          : current,
      );
      setUsers(usersResponse.data);
      setTestimonials(testimonialsResponse.data);
    } catch (dashboardError) {
      if (dashboardError instanceof ApiError && dashboardError.status === 401) {
        clearSession();
        setSession(null);
      }
      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : 'No se pudo cargar el dashboard.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(payload: CreateUserPayload) {
    if (!session) {
      throw new Error('Necesitás iniciar sesión.');
    }

    setCreating(true);
    try {
      await requestApi<TenantUser>('/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.tokens.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      await loadDashboard(session.tokens.accessToken);
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setUsers([]);
    setTestimonials([]);
  }

  if (!session) {
    return (
      <section className="card" style={{ padding: '2rem', marginTop: '1rem' }}>
        <div className="eyebrow">Sin sesión</div>
        <h1>Iniciá sesión o registrá un tenant</h1>
        <p className="notice">
          Este dashboard usa el flujo real de la API. Primero creá un tenant admin o
          iniciá con un usuario existente para probar la gestión de usuarios.
        </p>
      </section>
    );
  }

  return (
    <section className="grid" style={{ marginTop: '1rem' }}>
      <section className="card" style={{ padding: '2rem' }}>
        <div className="eyebrow">Sesión</div>
        <div className="metrics" style={{ marginTop: '1rem' }}>
          <div className="metric">
            <strong>Tenant</strong>
            <div>{session.user.tenantName}</div>
          </div>
          <div className="metric">
            <strong>Usuario</strong>
            <div>{session.user.email}</div>
          </div>
          <div className="metric">
            <strong>Roles</strong>
            <div>{session.user.roles.join(', ')}</div>
          </div>
        </div>
        {loading ? <div className="notice" style={{ marginTop: '1rem' }}>Cargando...</div> : null}
        {error ? <div className="notice error" style={{ marginTop: '1rem' }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void loadDashboard(session.tokens.accessToken)}>
            Refrescar datos
          </button>
          <button className="secondary" type="button" onClick={handleLogout}>
            Cerrar sesión local
          </button>
        </div>
      </section>

      <section className="card" style={{ padding: '2rem' }}>
        <div className="eyebrow">Usuarios del tenant</div>
        <div style={{ marginTop: '1rem' }}>
          <CreateUserForm onSubmit={handleCreateUser} loading={creating} />
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th>Activo</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.roles.join(', ')}</td>
                  <td>{user.isActive ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ padding: '2rem' }}>
        <div className="eyebrow">Testimonios</div>
        <div style={{ marginTop: '1rem' }}>
          {testimonials.length === 0 ? (
            <div className="notice">Todavía no hay testimonios cargados para este tenant.</div>
          ) : (
            <div className="grid">
              {testimonials.map(testimonial => (
                <article key={testimonial.id} className="notice">
                  <strong>{testimonial.authorName}</strong>
                  <div>{testimonial.content}</div>
                  <div>Estado: {testimonial.status}</div>
                  <div>Rating: {testimonial.rating}/5</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function CreateUserForm({
  onSubmit,
  loading,
}: {
  onSubmit: (payload: CreateUserPayload) => Promise<void>;
  loading: boolean;
}) {
  const [email, setEmail] = useState('editor@demo.com');
  const [password, setPassword] = useState('Editor123!');
  const [role, setRole] = useState<'admin' | 'editor'>('editor');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await onSubmit({ email, password, role });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'No se pudo crear el usuario.',
      );
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          name="new-user-email"
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          name="new-user-password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
      </label>
      <label>
        Rol
        <select value={role} onChange={event => setRole(event.target.value as 'admin' | 'editor')}>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      {error ? <div className="notice error">{error}</div> : null}
      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear usuario'}
      </button>
    </form>
  );
}
