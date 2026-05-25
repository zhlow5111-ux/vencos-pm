/**
 * Tasklet Shim — replaces window.tasklet with backend API calls.
 * All existing code that uses window.tasklet.sqlExec/sqlQuery will work
 * transparently through this shim.
 */

let _authToken: string = localStorage.getItem('vencos_token') || '';

export function setAuthToken(token: string) {
  _authToken = token;
  localStorage.setItem('vencos_token', token);
}

export function getAuthToken(): string {
  return _authToken;
}

export function clearAuthToken() {
  _authToken = '';
  localStorage.removeItem('vencos_token');
}

async function apiFetch(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_authToken}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    // Token expired or invalid — redirect to login
    clearAuthToken();
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }

  return res.json();
}

// Install shim on window.tasklet
(window as any).tasklet = {
  sqlExec: async (sql: string): Promise<void> => {
    await apiFetch('/api/sql/exec', { sql });
  },

  sqlQuery: async (sql: string): Promise<Record<string, unknown>[]> => {
    return await apiFetch('/api/sql/query', { sql });
  },

  runCommand: async (cmd: string): Promise<{ log: string; exitCode: number }> => {
    return await apiFetch('/api/command', { cmd });
  },

  writeFileToDisk: async (filePath: string, data: string): Promise<void> => {
    await apiFetch('/api/files/write', { path: filePath, data });
  },

  readFileFromDisk: async (filePath: string): Promise<string> => {
    const result = await apiFetch('/api/files/read', { path: filePath });
    return result.data;
  },
};
