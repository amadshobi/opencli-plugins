import { cli, Strategy } from '@jackwener/opencli/registry';
import { OFFICIAL_MODELS } from './utils.js';

cli({
  site: 'aistudio',
  name: 'models',
  description: 'List available Gemini, Imagen, and Veo models in Google AI Studio',
  access: 'read',
  strategy: Strategy.PUBLIC,
  browser: false,
  columns: ['ModelID', 'Name', 'Modalities', 'ContextWindow', 'Description'],
  args: [
    {
      name: 'query',
      positional: false,
      required: false,
      help: 'Filter models by keyword or ID substring',
    },
    {
      name: 'modality',
      positional: false,
      required: false,
      help: 'Filter by modality: text, image, video, audio',
    },
  ],
  func: async (kwargs) => {
    let models = OFFICIAL_MODELS;

    if (kwargs.query) {
      const q = String(kwargs.query).toLowerCase();
      models = models.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }

    if (kwargs.modality) {
      const mod = String(kwargs.modality).toLowerCase();
      models = models.filter((m) =>
        m.modalities.some((val) => val.toLowerCase().includes(mod))
      );
    }

    return models.map((m) => ({
      ModelID: m.id,
      Name: m.name,
      Modalities: m.modalities.join(', '),
      ContextWindow: m.contextWindow,
      Description: m.description,
      RecommendedFor: m.recommendedFor,
    }));
  },
});
