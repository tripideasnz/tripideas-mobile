import { isHttpUrl, urlDomain } from '@/lib/url';

export function generatedLinkTitle(url: string) {
  const parsed = new URL(url);
  const lastSegment = parsed.pathname.split('/').filter(Boolean).at(-1);
  if (lastSegment) {
    try {
      const decoded = decodeURIComponent(lastSegment).replace(/[-_]+/g, ' ').trim();
      const useful = decoded.length <= 120 && /[a-z]/i.test(decoded) && !/^\d+$/.test(decoded) && !/\.[a-z0-9]{2,5}$/i.test(decoded);
      if (useful) return decoded.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
    } catch { /* malformed encoding falls through to the hostname */ }
  }
  return urlDomain(url);
}
export const linkSearchUrl = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`;
export const validClipboardLink = (value: string) => isHttpUrl(value) ? value.trim() : null;

export function shouldOfferClipboardLink(input: {
  clipboard: string;
  searchActive: boolean;
  returnedFromBrowser: boolean;
  seen: ReadonlySet<string>;
}) {
  if (!input.searchActive || !input.returnedFromBrowser) return null;
  const candidate = validClipboardLink(input.clipboard);
  return candidate && !input.seen.has(candidate) ? candidate : null;
}
