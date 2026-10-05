export function serializeSafeRequest(req: { id?: string; method?: string }) {
  return { requestId: req.id, method: req.method };
}
