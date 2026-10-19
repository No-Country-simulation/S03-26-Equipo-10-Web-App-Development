'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AuthField } from './auth-field';
import {
  focusFirstError,
  passwordHelp,
  useAuthSubmission,
  validateFields,
  type FieldErrors,
} from './use-auth-submission';

interface RegisterAdminFormProps {
  onSubmit: (payload: {
    tenantName: string;
    email: string;
    password: string;
  }) => Promise<void>;
}
export function RegisterAdminForm({ onSubmit }: RegisterAdminFormProps) {
  const id = useId();
  const [tenantName, setTenantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const submission = useAuthSubmission(true);
  const serverErrorId = submission.error ? `${id}-submission-error` : undefined;
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.isLocked()) return;
    const next = validateFields(event.currentTarget, true);
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(event.currentTarget, next);
      return;
    }
    void submission.run(() => onSubmit({ tenantName, email, password }));
  }
  return (
    <form
      method="post"
      className="grid gap-6"
      noValidate
      onSubmit={handleSubmit}
      aria-label="Crear espacio y cuenta administradora"
      aria-busy={submission.phase === 'sending'}
    >
      <p className="font-body text-sm text-muted-foreground">
        Todos los campos son obligatorios.
      </p>
      <AuthField
        id={`${id}-tenant-name`}
        label="Nombre del espacio"
        name="tenantName"
        autoComplete="organization"
        value={tenantName}
        required
        minLength={3}
        maxLength={120}
        readOnly={submission.busy}
        help="El nombre de tu organización, entre 3 y 120 caracteres."
        error={errors.tenantName}
        serverErrorId={serverErrorId}
        onChange={(event) => {
          setTenantName(event.target.value);
          setErrors((current) => ({ ...current, tenantName: undefined }));
          submission.clearError();
        }}
      />
      <AuthField
        id={`${id}-email`}
        label="Email de la cuenta administradora"
        name="email"
        type="email"
        autoComplete="email"
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
        autoComplete="new-password"
        value={password}
        required
        minLength={8}
        maxLength={72}
        readOnly={submission.busy}
        help={passwordHelp}
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
            ? 'Creando el espacio y la cuenta administradora…'
            : 'Cuenta creada. Abriendo el panel…'}
        </p>
      )}
      <Button
        type="submit"
        className="h-12 w-full transition-none"
        disabled={submission.busy}
      >
        {submission.phase === 'sending'
          ? 'Creando…'
          : submission.phase === 'success'
            ? 'Cuenta creada'
            : 'Crear espacio y cuenta'}
      </Button>
    </form>
  );
}
