export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Ошибка запроса";
  const code = error instanceof HttpError ? error.status : status;
  return Response.json({ error: message }, { status: code });
}
