import * as Crypto from 'expo-crypto';

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function generateCodeVerifier(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(32));
  return base64urlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  // expo-crypto returns base64 (not hex) when encoding is BASE64
  const base64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
