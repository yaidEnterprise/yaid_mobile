export class PresentationRejectedError extends Error {
  readonly kind = 'presentation_rejected';
}

export class SessionExpiredError extends Error {
  readonly kind = 'session_expired';
}

export class SessionIneligibleError extends Error {
  readonly kind = 'session_ineligible';
}

export class SessionNotFoundError extends Error {
  readonly kind = 'session_not_found';
}

export class AuthClockSkewError extends Error {
  readonly kind = 'auth_clock_skew';
}
