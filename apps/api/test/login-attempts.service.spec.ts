import { HttpException } from '@nestjs/common';
import { LoginAttemptsService } from '../src/application/services/login-attempts.service';

describe('LoginAttemptsService', () => {
  let service: LoginAttemptsService;

  beforeEach(() => {
    service = new LoginAttemptsService();
  });

  it('blocks after five failed attempts', () => {
    for (let index = 0; index < 5; index += 1) {
      service.registerFailure('admin@test.com');
    }

    expect(() => service.assertNotBlocked('admin@test.com')).toThrow(
      HttpException,
    );
  });

  it('clears attempts after a successful login', () => {
    service.registerFailure('admin@test.com');
    service.clear('admin@test.com');

    expect(() => service.assertNotBlocked('admin@test.com')).not.toThrow();
  });
});
