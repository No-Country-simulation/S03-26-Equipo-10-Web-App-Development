import { Test } from '@nestjs/testing';

describe('Nest application dependency graph', () => {
  it('resolves guards and providers for every active module', async () => {
    const previous = {
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      REDIS_URL: process.env.REDIS_URL,
    };
    process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/testimonial_cms_test';
    process.env.JWT_SECRET = 'test-only-placeholder-with-at-least-32-characters';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    try {
      const { AppModule } = await import('../src/app.module');
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      await moduleRef.close();
    } finally {
      if (previous.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous.DATABASE_URL;
      if (previous.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous.JWT_SECRET;
      if (previous.REDIS_URL === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previous.REDIS_URL;
    }
  });
});
