const SENSITIVE_PATTERN = /(?:eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|(?:sk-|pk-|fki-|xai-|gsk-)[a-zA-Z0-9_-]{20,}|Bearer\s+[a-zA-Z0-9_-]{20,}|[A-Za-z0-9_-]{32,})/g;

export function redactSensitive(text: string): string {
  return text.replace(SENSITIVE_PATTERN, "[REDACTED]");
}
