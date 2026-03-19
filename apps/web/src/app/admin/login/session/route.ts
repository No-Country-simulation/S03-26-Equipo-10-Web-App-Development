import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = String(formData.get('redirectTo') ?? '/admin');

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set('admin_session', 'dev-placeholder', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  return response;
}
