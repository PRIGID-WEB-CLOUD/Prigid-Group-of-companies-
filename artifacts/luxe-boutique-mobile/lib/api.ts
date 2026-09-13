const getBaseUrl = (): string => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
};

export const apiUrl = (path: string): string => `${getBaseUrl()}${path}`;
