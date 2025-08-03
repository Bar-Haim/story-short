// src/utils/envCheck.ts

export function checkRequiredEnv(vars: string[]) {
    const missing = vars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Missing required environment variables: ${missing.join(', ')}`,
      };
    }
    return { ok: true };
  }
  