import { cli, Strategy } from '@jackwener/opencli/registry';
import { AISTUDIO_APIKEY_URL } from './utils.js';

cli({
  site: 'aistudio',
  name: 'apikey',
  description: 'Manage, inspect, and test Google AI Studio Gemini API keys',
  access: 'read',
  strategy: Strategy.PUBLIC,
  browser: false,
  columns: ['Action', 'Status', 'KeyPreview', 'Validation', 'Detail'],
  args: [
    {
      name: 'check',
      positional: false,
      type: 'boolean',
      required: false,
      help: 'Validate current API key against Google Generative Language API',
    },
    {
      name: 'key',
      positional: false,
      required: false,
      help: 'Custom API key to validate or inspect (defaults to GEMINI_API_KEY env)',
    },
  ],
  func: async (kwargs) => {
    const key = kwargs.key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!key) {
      return [
        {
          Action: 'Inspect',
          Status: 'No API Key Detected',
          KeyPreview: 'None',
          Validation: 'Skipped',
          Detail: `Get a free Gemini API key at: ${AISTUDIO_APIKEY_URL}`,
        },
      ];
    }

    const preview = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '****';

    if (kwargs.check) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );
        if (res.ok) {
          const data = await res.json();
          const total = data.models ? data.models.length : 0;
          return [
            {
              Action: 'Validate',
              Status: 'Valid & Active',
              KeyPreview: preview,
              Validation: `HTTP 200 OK (${total} models accessible)`,
              Detail: 'Key is verified and ready for API requests',
            },
          ];
        } else {
          const errText = await res.text();
          return [
            {
              Action: 'Validate',
              Status: 'Invalid Key',
              KeyPreview: preview,
              Validation: `HTTP ${res.status}`,
              Detail: errText.slice(0, 120),
            },
          ];
        }
      } catch (err) {
        return [
          {
            Action: 'Validate',
            Status: 'Network Error',
            KeyPreview: preview,
            Validation: 'Failed to connect',
            Detail: err.message,
          },
        ];
      }
    }

    return [
      {
        Action: 'Inspect',
        Status: 'Key Configured',
        KeyPreview: preview,
        Validation: 'Pass --check to test live API access',
        Detail: `Manage keys at: ${AISTUDIO_APIKEY_URL}`,
      },
    ];
  },
});
