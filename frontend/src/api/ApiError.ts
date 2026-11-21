export class ApiError extends Error {
  constructor(public status: number, public body: { error?: string; code?: string }) {
    super(`API ${status}: ${body.error ?? 'Request failed'}`);
  }
}
