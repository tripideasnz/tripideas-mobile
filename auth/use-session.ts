import { useMemo } from 'react';

import { initialSessionState } from '@/auth/session';

export function useSession() {
  return useMemo(() => initialSessionState, []);
}
