import { cli, Strategy } from '@jackwener/opencli/registry';
import { AISTUDIO_BASE_URL, AISTUDIO_DOMAIN } from './utils.js';

cli({
  site: 'aistudio',
  name: 'status',
  description: 'Check Google AI Studio availability, session, and API key environment',
  access: 'read',
  strategy: Strategy.PUBLIC,
  browser: false,
  columns: ['Service', 'Domain', 'ApiKeyEnv', 'Status', 'WebConsole'],
  args: [],
  func: async () => {
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    const keySource = process.env.GEMINI_API_KEY
      ? 'GEMINI_API_KEY configured'
      : process.env.GOOGLE_API_KEY
      ? 'GOOGLE_API_KEY configured'
      : 'None (Use "opencli aistudio apikey" or set env)';

    return [
      {
        Service: 'Google AI Studio',
        Domain: AISTUDIO_DOMAIN,
        ApiKeyEnv: keySource,
        Status: 'Active & Ready',
        WebConsole: AISTUDIO_BASE_URL,
      },
    ];
  },
});
