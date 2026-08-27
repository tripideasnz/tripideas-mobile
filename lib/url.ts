export const isHttpUrl = (value: string) => /^https?:\/\/[^\s]+$/i.test(value.trim());
export const urlDomain = (value: string) => new URL(value).hostname.replace(/^www\./, '');
