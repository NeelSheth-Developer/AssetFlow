export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'yahoo.co.in',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'proton.me',
  'rediffmail.com',
  'aol.com',
  'zoho.com',
]);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && uuidPattern.test(value);

export const isAllowedEmailProvider = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? ALLOWED_EMAIL_DOMAINS.has(domain) : false;
};

/** Returns an error message, or null if the password meets all rules. */
export const passwordError = (password: string): string | null => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter';
  if (!/\d/.test(password)) return 'Password must include at least one digit';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one symbol';
  return null;
};
