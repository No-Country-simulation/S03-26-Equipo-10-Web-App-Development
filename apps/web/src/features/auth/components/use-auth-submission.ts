'use client';

import { useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

function failureCopy(error: unknown, registration: boolean) {
  if (error instanceof ApiError) {
    if (error.status === 429)
      return 'Alcanzaste el límite de intentos. Esperá un momento antes de volver a intentar.';
    if (!registration && error.status === 401)
      return 'Revisá tu email y contraseña. Si no podés ingresar, consultá a quien administra tu espacio.';
    if (registration && error.status === 409)
      return 'El nombre del espacio o el email ya está en uso. Revisá esos datos o ingresá si ya tenés una cuenta.';
    if (error.status === 400 || error.status === 422)
      return registration
        ? 'Revisá el nombre del espacio, el email y los requisitos de contraseña.'
        : 'Revisá el email y la contraseña que ingresaste.';
    if (error.status === 403)
      return 'No pudimos autorizar la solicitud. Revisá que estés usando la dirección correcta del sitio e intentá de nuevo.';
  }
  return registration
    ? 'No pudimos confirmar la creación del espacio. Probá ingresar con los datos que elegiste antes de volver a registrarte.'
    : 'No pudimos confirmar el inicio de sesión. Revisá tu conexión y volvé a intentar.';
}

export function useAuthSubmission(registration: boolean) {
  const lock = useRef(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPhase('sending');
    setError(null);
    try {
      await task();
      setPhase('success');
    } catch (failure) {
      setError(failureCopy(failure, registration));
      setPhase('idle');
      lock.current = false;
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  return {
    phase,
    busy: phase !== 'idle',
    error,
    feedback,
    isLocked: () => lock.current,
    run,
    clearError: () => setError(null),
  };
}

export const passwordHelp =
  'De 8 a 72 caracteres, con mayúscula, minúscula, número y símbolo.';
export const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;
export type FieldErrors = Partial<
  Record<'email' | 'password' | 'tenantName', string>
>;
export function validateFields(
  form: HTMLFormElement,
  registration: boolean,
): FieldErrors {
  const errors: FieldErrors = {};
  const email = form.elements.namedItem('email') as HTMLInputElement;
  const password = form.elements.namedItem('password') as HTMLInputElement;
  if (registration) {
    const name = form.elements.namedItem('tenantName') as HTMLInputElement;
    if (name.value.length < 3 || name.value.length > 120)
      errors.tenantName =
        'Usá entre 3 y 120 caracteres para el nombre del espacio.';
  }
  if (!email.value || email.validity.typeMismatch)
    errors.email = 'Ingresá un email válido.';
  if (!password.value) errors.password = 'Ingresá tu contraseña.';
  else if (registration && !passwordPattern.test(password.value))
    errors.password = passwordHelp;
  return errors;
}
export function focusFirstError(form: HTMLFormElement, errors: FieldErrors) {
  const first = Object.keys(errors)[0];
  if (first)
    requestAnimationFrame(() =>
      (form.elements.namedItem(first) as HTMLInputElement | null)?.focus(),
    );
}
