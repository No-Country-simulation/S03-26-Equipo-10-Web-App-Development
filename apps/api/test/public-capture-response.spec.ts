import type { Request, Response } from 'express';
import { PublicTestimonialsController } from '../src/modules/testimonials/controllers/public-testimonials.controller';
import type { TestimonialsService } from '../src/modules/testimonials/services/testimonials.service';
import type { SubmitPublicTestimonialDto } from '../src/modules/testimonials/dto/testimonial.dto';

const input = { authorName: 'Persona', content: 'Contenido suficiente', rating: 5 } as SubmitPublicTestimonialDto;

describe('public capture response', () => {
  const submitPublicTestimonial = jest.fn();
  const controller = new PublicTestimonialsController({ submitPublicTestimonial } as unknown as TestimonialsService);
  const response = { cookie: jest.fn() } as unknown as Response;

  beforeEach(() => {
    submitPublicTestimonial.mockReset();
    jest.mocked(response.cookie).mockReset();
  });

  it('does not claim a suppressed submission was saved', async () => {
    const request = { cookies: { ts_submitted_example: 'true' } } as unknown as Request;
    await expect(controller.submit('example', input, request, response)).rejects.toMatchObject({
      kind: 'conflict', code: 'PUBLIC_SUBMISSION_RECENT_BROWSER',
    });
    expect(submitPublicTestimonial).not.toHaveBeenCalled();
  });

  it('confirms only a persisted submission', async () => {
    submitPublicTestimonial.mockResolvedValueOnce({ id: 'saved-id', status: 'success', failedMedia: [] });
    const request = { cookies: {} } as unknown as Request;
    await expect(controller.submit('example', input, request, response)).resolves.toEqual({
      status: 'success', id: 'saved-id', failedMedia: [],
    });
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('sets the recent-submission marker after a partial media result', async () => {
    submitPublicTestimonial.mockResolvedValueOnce({ id: 'saved-id', status: 'partial', failedMedia: ['image'] });
    const request = { cookies: {} } as unknown as Request;
    await expect(controller.submit('example', input, request, response)).resolves.toEqual({
      status: 'partial', id: 'saved-id', failedMedia: ['image'],
    });
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('does not set the marker when persistence fails', async () => {
    submitPublicTestimonial.mockRejectedValueOnce(new Error('database unavailable'));
    const request = { cookies: {} } as unknown as Request;
    await expect(controller.submit('example', input, request, response)).rejects.toThrow('database unavailable');
    expect(response.cookie).not.toHaveBeenCalled();
  });
});
