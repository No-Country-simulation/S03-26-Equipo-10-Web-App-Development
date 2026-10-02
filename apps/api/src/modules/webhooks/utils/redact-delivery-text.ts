/** Avoid persisting credentials echoed by untrusted webhook receivers. */
export function redactDeliveryText(value: string | undefined, knownSecrets: string[] = []): string | undefined {
  if (value === undefined) return undefined;
  let redacted = value;
  for (const secret of knownSecrets) {
    if (secret) redacted = redacted.replaceAll(secret, '[REDACTED]');
  }
  return redacted
    .replace(/whsec_[0-9a-f]{64}|ak_(?:live|test)_[0-9a-f]{16}_[0-9a-f]{64}|tms_[0-9a-f]{48}/gi,
      '[REDACTED]')
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:token|secret|api_key|signature)=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/("(?:token|secret|password|apiKey|authorization|cookie)"\s*:\s*")[^"]*(")/gi,
      '$1[REDACTED]$2')
    .slice(0, 2048);
}
