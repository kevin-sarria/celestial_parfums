import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch, refreshAccessToken } from '../../infrastructure/api/client';
import { useAuthContext } from '../../application/context/useAuthContext';
import type { GuardedFetch } from './types';

export function useGuardedFetch(): GuardedFetch {
  const { logout } = useAuthContext();
  const navigate = useNavigate();

  return useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let res = await authFetch(input, init);
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        res = await authFetch(input, init);
      } else {
        logout();
        navigate('/login');
      }
    }
    if (res.status === 403) {
      logout();
      navigate('/login');
    }
    return res;
  }, [logout, navigate]);
}
