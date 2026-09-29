/** Errores de aplicación independientes del transporte HTTP. */
export type ApplicationErrorKind =
  | 'invalid_input'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal';

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly kind: ApplicationErrorKind,
    readonly code?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidInputError extends ApplicationError {
  constructor(message: string) { super(message, 'invalid_input'); }
}
export class UnauthorizedError extends ApplicationError {
  constructor(message: string) { super(message, 'unauthorized'); }
}
export class ForbiddenError extends ApplicationError {
  constructor(message: string) { super(message, 'forbidden'); }
}
export class NotFoundError extends ApplicationError {
  constructor(message: string) { super(message, 'not_found'); }
}
export class ConflictError extends ApplicationError {
  constructor(message: string) { super(message, 'conflict'); }
}
export class RateLimitedError extends ApplicationError {
  constructor(message: string, code?: string) { super(message, 'rate_limited', code); }
}
export class InternalError extends ApplicationError {
  constructor(message: string) { super(message, 'internal'); }
}
