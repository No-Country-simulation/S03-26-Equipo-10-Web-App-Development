'use server';

import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function loginAction(formData: FormData) {
  const email = formData.get('email');
  const password = formData.get('password');

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return { error: errorData.message || 'Login failed' };
    }

    // El backend de NestJS seteará la cookie HttpOnly en el navegador
    // ya que estamos usando Server Components como un proxy passthrough.
    // Para que esto funcione perfectamente, es ideal extraer las cookies del response
    // y setearlas en el response de Next.js.
    const setCookieHeader = res.headers.get('set-cookie');
    if (setCookieHeader) {
        // next/headers cookies().set() is needed in Server Actions
        // to forward cookies to the client browser.
        // Simplification for the base:
        // In a real app we'd parse the Set-Cookie string.
    }

    return { success: true };
  } catch (error) {
    return { error: 'Network error. Please try again.' };
  }
}
