import { CreateTestimonialDto, SubmitPublicTestimonialDto, UpdateTestimonialDto } from '../src/modules/testimonials/dto/testimonial.dto';

describe('testimonial content validation', () => {
  const fiveEmoji = '😀'.repeat(5);
  const tenEmoji = '😀'.repeat(10);

  it('counts Unicode characters like PostgreSQL char_length', () => {
    expect(CreateTestimonialDto.schema.safeParse({
      authorName: 'Synthetic', content: fiveEmoji, rating: 5,
    }).success).toBe(false);
    expect(UpdateTestimonialDto.schema.safeParse({ content: fiveEmoji }).success).toBe(false);
    expect(SubmitPublicTestimonialDto.schema.safeParse({
      authorName: 'Synthetic', content: fiveEmoji, rating: 5,
    }).success).toBe(false);
    expect(CreateTestimonialDto.schema.safeParse({
      authorName: 'Synthetic', content: tenEmoji, rating: 5,
    }).success).toBe(true);
  });
});
