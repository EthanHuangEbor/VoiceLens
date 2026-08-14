// voicelens core engine — output contract (single source of truth).
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Full transcription.' },
    language: { type: 'string', description: 'Detected or hinted ISO-639-1 language.' },
    provider: { type: 'string', description: 'ASR provider that ran.' },
  },
  required: ['text', 'provider'],
}
