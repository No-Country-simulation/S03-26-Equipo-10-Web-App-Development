import { Testimonial } from '../src/core/entities/testimonial.entity';

describe('Testimonial Entity', () => {
  it('creates a draft testimonial', () => {
    const entity = Testimonial.create({
      id: 'test-1',
      tenantId: 'tenant-1',
      createdById: 'user-1',
      authorName: 'John',
      content: 'Great product, highly recommend it for everyone!',
      rating: 5,
    });

    expect(entity.id).toBe('test-1');
    expect(entity.status).toBe('draft');
    expect(entity.score).toBe(0);
  });

  it('follows the correct state machine: draft → pending → approved → published', () => {
    const entity = Testimonial.create({
      id: 'test-2',
      tenantId: 'tenant-1',
      createdById: 'user-1',
      authorName: 'Jane',
      content: 'Absolutely fantastic experience overall!',
      rating: 4,
    });

    entity.submit();
    expect(entity.status).toBe('pending');

    entity.approve();
    expect(entity.status).toBe('approved');

    entity.publish();
    expect(entity.status).toBe('published');
    expect(entity.publishedAt).toBeInstanceOf(Date);
  });

  it('rejects invalid state transitions', () => {
    const entity = Testimonial.create({
      id: 'test-3',
      tenantId: 'tenant-1',
      createdById: 'user-1',
      authorName: 'Bob',
      content: 'Cannot skip states, must follow the machine.',
      rating: 3,
    });

    expect(() => entity.approve()).toThrow('Invalid status transition');
    expect(() => entity.publish()).toThrow('Invalid status transition');
  });

  it('allows rejection from pending', () => {
    const entity = Testimonial.create({
      id: 'test-4',
      tenantId: 'tenant-1',
      createdById: 'user-1',
      authorName: 'Carol',
      content: 'This will be rejected, unfortunately.',
      rating: 2,
    });

    entity.submit();
    entity.reject('Not appropriate for display');

    expect(entity.status).toBe('rejected');
    expect(entity.moderationNotes).toBe('Not appropriate for display');
  });

  it('prevents editing published testimonials', () => {
    const entity = Testimonial.create({
      id: 'test-5',
      tenantId: 'tenant-1',
      createdById: 'user-1',
      authorName: 'Dave',
      content: 'This is published, no more editing allowed.',
      rating: 5,
    });

    entity.submit();
    entity.approve();
    entity.publish();

    expect(() => entity.update({ authorName: 'Changed' })).toThrow('Published testimonials cannot be edited');
  });

  it('validates rating bounds', () => {
    expect(() =>
      Testimonial.create({
        id: 'test-6',
        tenantId: 'tenant-1',
        createdById: 'user-1',
        authorName: 'Eve',
        content: 'Invalid rating test content here.',
        rating: 0,
      }),
    ).toThrow('Rating must be between 1 and 5');

    expect(() =>
      Testimonial.create({
        id: 'test-7',
        tenantId: 'tenant-1',
        createdById: 'user-1',
        authorName: 'Eve',
        content: 'Invalid rating test content here.',
        rating: 6,
      }),
    ).toThrow('Rating must be between 1 and 5');
  });
});
