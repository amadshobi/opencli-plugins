import { cli, Strategy } from '@jackwener/opencli/registry';
import { AISTUDIO_TUNING_URL } from './utils.js';

cli({
  site: 'aistudio',
  name: 'tuning',
  description: 'Manage and monitor fine-tuning jobs in Google AI Studio',
  access: 'read',
  strategy: Strategy.PUBLIC,
  browser: false,
  columns: ['TuningJob', 'BaseModel', 'Status', 'ConsoleUrl'],
  args: [
    {
      name: 'list',
      positional: false,
      type: 'boolean',
      required: false,
      help: 'List tuned models via API (requires GEMINI_API_KEY)',
    },
    {
      name: 'job-id',
      positional: false,
      required: false,
      help: 'Specific tuning job or tuned model ID to inspect',
    },
  ],
  func: async (kwargs) => {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (kwargs.list && key) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/tunedModels?key=${key}`
        );
        if (res.ok) {
          const data = await res.json();
          const list = data.tunedModels || [];
          if (list.length === 0) {
            return [
              {
                TuningJob: 'None',
                BaseModel: '-',
                Status: 'No active tuned models found',
                ConsoleUrl: AISTUDIO_TUNING_URL,
              },
            ];
          }
          return list.map((item) => ({
            TuningJob: item.displayName || item.name,
            BaseModel: item.baseModel || '-',
            Status: item.state || 'COMPLETED',
            ConsoleUrl: AISTUDIO_TUNING_URL,
          }));
        }
      } catch (err) {
        // Fallback to console info
      }
    }

    return [
      {
        TuningJob: kwargs['job-id'] || 'Tuning Console',
        BaseModel: 'gemini-1.5-flash / gemini-2.0-flash',
        Status: 'Manage tuning jobs online',
        ConsoleUrl: AISTUDIO_TUNING_URL,
      },
    ];
  },
});
