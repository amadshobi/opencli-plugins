/**
 * Shared utilities and constants for Google AI Studio OpenCLI plugin.
 */

export const AISTUDIO_DOMAIN = 'aistudio.google.com';
export const AISTUDIO_BASE_URL = 'https://aistudio.google.com';
export const AISTUDIO_APIKEY_URL = 'https://aistudio.google.com/app/apikey';
export const AISTUDIO_LIBRARY_URL = 'https://aistudio.google.com/app/library';
export const AISTUDIO_TUNING_URL = 'https://aistudio.google.com/app/tuning';

export const OFFICIAL_MODELS = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    modalities: ['text', 'image', 'audio', 'video'],
    contextWindow: '1,048,576 tokens',
    maxOutputTokens: 8192,
    description: 'Fast and versatile multimodal model for high-frequency tasks',
    recommendedFor: 'General multimodal, code, summarization, real-time chat',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    modalities: ['text', 'image', 'audio', 'video'],
    contextWindow: '2,097,152 tokens',
    maxOutputTokens: 8192,
    description: 'Advanced reasoning model with 2M token context window for complex problem-solving',
    recommendedFor: 'Deep reasoning, large codebase analysis, research, math',
  },
  {
    id: 'gemini-3.0-flash',
    name: 'Gemini 3.0 Flash',
    modalities: ['text', 'image', 'audio', 'video'],
    contextWindow: '1,048,576 tokens',
    maxOutputTokens: 8192,
    description: 'Next-generation ultra-fast multimodal model with enhanced reasoning and agentic flow',
    recommendedFor: 'Agentic workflows, rapid multimodal tasks, structured outputs',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    modalities: ['text', 'image', 'audio', 'video'],
    contextWindow: '1,048,576 tokens',
    maxOutputTokens: 8192,
    description: 'State-of-the-art high-throughput model with extended reasoning capabilities',
    recommendedFor: 'Complex multi-turn tool use, fast inference with deep thoughts',
  },
  {
    id: 'gemini-2.0-flash-thinking-exp',
    name: 'Gemini 2.0 Flash Thinking Experimental',
    modalities: ['text', 'image', 'audio', 'video'],
    contextWindow: '1,048,576 tokens',
    maxOutputTokens: 8192,
    description: 'Experimental model displaying visible CoT (Chain of Thought) reasoning',
    recommendedFor: 'Step-by-step logic, competitive programming, math proofs',
  },
  {
    id: 'imagen-3.0-generate-002',
    name: 'Imagen 3',
    modalities: ['text-to-image'],
    contextWindow: 'Prompt input',
    maxOutputTokens: 1,
    description: 'State-of-the-art text-to-image generator with photorealistic quality and sharp typography',
    recommendedFor: 'High-res image generation, concept art, visual mockups',
  },
  {
    id: 'veo-2.0-generate-001',
    name: 'Google Veo 2',
    modalities: ['text-to-video', 'image-to-video'],
    contextWindow: 'Prompt / Reference Image',
    maxOutputTokens: 1,
    description: 'High-definition video generative model creating cinematic 720p/1080p clips',
    recommendedFor: 'Video clips, animation, motion design, visual effects',
  },
  {
    id: 'gemini-2.5-flash-audio',
    name: 'Gemini 2.5 Audio / Voice',
    modalities: ['text-to-speech', 'audio-to-audio'],
    contextWindow: 'Prompt / Audio input',
    maxOutputTokens: 4096,
    description: 'Native audio generation with expressive multi-speaker voice synthesis',
    recommendedFor: 'Voiceovers, conversational speech, podcasts, sound effects',
  },
];

export const VOICE_PRESETS = [
  { name: 'Puck', tone: 'Energetic, engaging, friendly' },
  { name: 'Charon', tone: 'Deep, calm, authoritative' },
  { name: 'Kore', tone: 'Gentle, soothing, warm' },
  { name: 'Fenrir', tone: 'Resonant, crisp, executive' },
  { name: 'Aoede', tone: 'Bright, melodic, clear' },
];

/**
 * Generate code snippet in desired format
 */
export function exportToCode({ model, prompt, systemInstruction, temperature, format }) {
  const selectedModel = model || 'gemini-2.5-flash';
  const sys = systemInstruction ? `\n  system_instruction="${systemInstruction}",` : '';
  const temp = temperature !== undefined ? `\n    temperature=${temperature},` : '';

  switch (format) {
    case 'python':
      return `# Python SDK (google-genai)
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="${selectedModel}",
    contents="${prompt.replace(/"/g, '\\"')}",
    config=types.GenerateContentConfig(${sys}${temp}
    ),
)
print(response.text)
`;

    case 'js':
    case 'ts':
    case 'typescript':
    case 'javascript':
      return `// TypeScript / Node.js (@google/genai)
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

async function main() {
  const response = await ai.models.generateContent({
    model: '${selectedModel}',
    contents: '${prompt.replace(/'/g, "\\'")}',
    config: {${systemInstruction ? `\n      systemInstruction: '${systemInstruction}',` : ''}${temperature !== undefined ? `\n      temperature: ${temperature},` : ''}
    },
  });
  console.log(response.text);
}

main();
`;

    case 'curl':
    default:
      return `# cURL REST API
curl "https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=$GEMINI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{
    "contents": [{
      "parts": [{"text": "${prompt.replace(/"/g, '\\"')}"}]
    }]${systemInstruction ? `,\n    "systemInstruction": {"parts": [{"text": "${systemInstruction.replace(/"/g, '\\"')}"}]}` : ''}${temperature !== undefined ? `,\n    "generationConfig": {"temperature": ${temperature}}` : ''}
  }'
`;
  }
}
