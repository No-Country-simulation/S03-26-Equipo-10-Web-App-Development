import { Controller, Get } from '@nestjs/common';

@Controller('docs')
export class DocsController {
  @Get()
  getOpenApiDocument() {
    return {
      openapi: '3.1.0',
      info: {
        title: 'Testimonial CMS API',
        version: '1.0.0',
      },
      servers: [{ url: '/api/v1' }],
      paths: {
        '/auth/register-admin': { post: { summary: 'Register first tenant admin' } },
        '/auth/login': { post: { summary: 'Login with email/password' } },
        '/auth/refresh': { post: { summary: 'Rotate refresh token' } },
        '/auth/logout': { post: { summary: 'Logout and revoke refresh token' } },
        '/auth/me': { get: { summary: 'Get current authenticated user' } },
        '/tenants/me': { get: { summary: 'Get current tenant' }, patch: { summary: 'Update current tenant' } },
        '/users': { get: { summary: 'List tenant users' }, post: { summary: 'Create tenant user' } },
        '/users/{user_id}': { get: { summary: 'Get tenant user' }, patch: { summary: 'Update tenant user' }, delete: { summary: 'Deactivate tenant user' } },
        '/testimonials': { get: { summary: 'List testimonials' }, post: { summary: 'Create testimonial' } },
        '/testimonials/{testimonial_id}': { get: { summary: 'Get testimonial' }, patch: { summary: 'Update testimonial' }, delete: { summary: 'Delete testimonial' } },
        '/testimonials/{testimonial_id}/submit': { post: { summary: 'Submit testimonial to moderation' } },
        '/testimonials/{testimonial_id}/approve': { post: { summary: 'Approve pending testimonial' } },
        '/testimonials/{testimonial_id}/reject': { post: { summary: 'Reject pending testimonial' } },
        '/testimonials/{testimonial_id}/publish': { post: { summary: 'Publish approved testimonial' } },
        '/tags': { get: { summary: 'List tags' }, post: { summary: 'Create tag' } },
        '/categories': { get: { summary: 'List categories' }, post: { summary: 'Create category' } },
        '/api-keys': { get: { summary: 'List API keys' }, post: { summary: 'Create API key' } },
        '/api-keys/{api_key_id}/rotate': { post: { summary: 'Rotate API key' } },
        '/api-keys/{api_key_id}': { delete: { summary: 'Revoke API key' } },
        '/public/testimonials': { get: { summary: 'Public list testimonials (API key)' } },
        '/public/testimonials/{testimonial_id}': { get: { summary: 'Public get testimonial (API key)' } },
        '/public/analytics/events': { post: { summary: 'Track analytics event (API key)' } },
        '/analytics/dashboard': { get: { summary: 'Tenant analytics dashboard' } },
        '/analytics/testimonials/{testimonial_id}': { get: { summary: 'Tenant testimonial metrics' } },
        '/webhooks': { get: { summary: 'List webhooks' }, post: { summary: 'Create webhook' } },
        '/webhooks/{webhook_id}': { patch: { summary: 'Update webhook' }, delete: { summary: 'Delete webhook' } },
        '/webhooks/{webhook_id}/deliveries': { get: { summary: 'List webhook deliveries' } },
        '/webhooks/{webhook_id}/test': { post: { summary: 'Dispatch test webhook' } },
        '/feature-flags': { get: { summary: 'List feature flags' } },
        '/feature-flags/{flag_name}': { patch: { summary: 'Set feature flag state' } },
        '/health': { get: { summary: 'Service health' } },
        '/health/ready': { get: { summary: 'Readiness check' } },
        '/health/live': { get: { summary: 'Liveness check' } },
      },
    };
  }
}
