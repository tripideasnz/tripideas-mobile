import type { PropsWithChildren } from 'react';

export function AuthProvider({ children }: PropsWithChildren) {
  // TODO: Provide real session state after the website identity API is integrated.
  return children;
}
