import { useWorkspaceStore } from '@/stores/workspace';
import { request } from './api';

interface Credentials {
  email: string;
  password: string;
}

export function signIn(credentials: Credentials) {
  return request<{ email: string }>('/session', {
    method: 'POST',
    body: credentials,
  });
}

/** Creates the account only: the API doesn't sign the person in. */
export function createAccount(account: Credentials & { name: string }) {
  return request('/api/auth/register', { method: 'POST', body: account });
}

/** Also forgets the workspace, so the next person doesn't inherit it. */
export async function signOut() {
  await request('/session', { method: 'DELETE' });
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
}
