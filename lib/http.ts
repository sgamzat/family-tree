export function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Ошибка запроса";
  return Response.json({ error: message }, { status });
}
