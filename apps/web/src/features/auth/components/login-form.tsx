'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AuthField } from './auth-field';
import {
  focusFirstError,
  useAuthSubmission,
  validateFields,
  type FieldErrors,
} from './use-auth-submission';

interface LoginFormProps {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
}
export function LoginForm({ onSubmit }: LoginFormProps) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const submission = useAuthSubmission(false);
  const serverErrorId = submission.error ? `${id}-submission-error` : undefined;
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.isLocked()) return;
    const next = validateFields(event.currentTarget, false);
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(event.currentTarget, next);
      return;
    }
    void submission.run(() => onSubmit({ email, password }));
  }
  return (
    <form
      method="post"
      className="grid gap-6"
      noValidate
      onSubmit={handleSubmit}
      aria-label="Acceso al panel"
      aria-busy={submission.phase === 'sending'}
    >
      <p className="font-body text-sm text-muted-foreground">
        Todos los campos son obligatorios.
      </p>
      <AuthField
        id={`${id}-email`}
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        required
        readOnly={submission.busy}
        error={errors.email}
        serverErrorId={serverErrorId}
        onChange={(event) => {
          setEmail(event.target.value);
          setErrors((current) => ({ ...current, email: undefined }));
          submission.clearError();
        }}
      />
      <AuthField
        id={`${id}-password`}
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        required
        readOnly={submission.busy}
        error={errors.password}
        serverErrorId={serverErrorId}
        onChange={(event) => {
          setPassword(event.target.value);
          setErrors((current) => ({ ...current, password: undefined }));
          submission.clearError();
        }}
      />
      {submission.error && (
        <div
          id={serverErrorId}
          ref={submission.feedback}
          tabIndex={-1}
          role="alert"
          className="border border-destructive p-4 font-body text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {submission.error}
        </div>
      )}
      {submission.phase !== 'idle' && (
        <p role="status" className="font-body text-sm">
          {submission.phase === 'sending'
            ? 'Verificando acceso…'
            : 'Acceso confirmado. Abriendo el panel…'}
        </p>
      )}
      <Button
        type="submit"
        className="h-12 w-full transition-none"
        disabled={submission.busy}
      >
        {submission.phase === 'sending'
          ? 'Ingresando…'
          : submission.phase === 'success'
            ? 'Acceso confirmado'
            : 'Iniciar sesión'}
      </Button>
    </form>
  );
}
