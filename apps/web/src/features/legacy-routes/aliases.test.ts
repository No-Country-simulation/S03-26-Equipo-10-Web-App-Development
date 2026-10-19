import { beforeEach, expect, it, vi } from 'vitest';
import Login from '@/app/(public)/login/page';
import Dashboard from '@/app/(dashboard)/dashboard/page';
import Analytics from '@/app/(dashboard)/analytics/page';
import Testimonials from '@/app/(dashboard)/testimonials/page';
import Detail from '@/app/(dashboard)/testimonials/[id]/page';
import Edit from '@/app/(dashboard)/testimonials/[id]/edit/page';
import Users from '@/app/(dashboard)/settings/users/page';
import Keys from '@/app/(dashboard)/settings/api-keys/page';
import Webhooks from '@/app/(dashboard)/settings/webhooks/page';
import Flags from '@/app/(dashboard)/settings/feature-flags/page';
import Integrations from '@/app/(dashboard)/settings/integrations/page';
const state = vi.hoisted(() => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: state.redirect,
  notFound: state.notFound,
}));
beforeEach(() => {
  vi.clearAllMocks();
});
it.each([
  [Login, '/admin/login'],
  [Dashboard, '/admin'],
  [Analytics, '/admin/analytics'],
  [Testimonials, '/admin/testimonials'],
  [Users, '/admin/users'],
  [Keys, '/admin/api-keys'],
  [Webhooks, '/admin/webhooks'],
  [Flags, '/admin/settings#capabilities'],
  [Integrations, '/admin/settings#integrations'],
] as const)(
  'redirects a preparatory route to its protected active destination %#',
  async (Page, href) => {
    await Page();
    expect(state.redirect).toHaveBeenCalledWith(href);
  },
);
it.each([Detail, Edit])(
  'uses contextual detail for valid identifiers and leaves edit permissions to the active screen',
  async (Page) => {
    const id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    await Page({ params: Promise.resolve({ id }) });
    expect(state.redirect).toHaveBeenCalledWith(
      '/admin/testimonials?page=1&testimonial=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  },
);
it.each(['invalid', 'javascript:alert(1)', '../other-tenant'])(
  'rejects invalid resource identifiers %s',
  async (id) => {
    // A Next notFound aborts rendering; simulate that boundary rather than returning success.
    state.notFound.mockImplementationOnce(() => {
      throw new Error('not-found');
    });
    await expect(Detail({ params: Promise.resolve({ id }) })).rejects.toThrow(
      'not-found',
    );
    expect(state.redirect).not.toHaveBeenCalled();
  },
);
