export const DEFAULT_MODELS = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
}

export async function createLLM(provider, model) {
  const modelName = model || DEFAULT_MODELS[provider]
  if (!modelName) {
    throw new Error(`Unknown provider: "${provider}". Available: ${Object.keys(DEFAULT_MODELS).join(', ')}`)
  }
  if (provider === 'anthropic') {
    const { ChatAnthropic } = await import('@langchain/anthropic')
    return new ChatAnthropic({ model: modelName, maxTokens: 8192 })
  }
  if (provider === 'openai') {
    const { ChatOpenAI } = await import('@langchain/openai')
    return new ChatOpenAI({ model: modelName, maxTokens: 8192 })
  }
  throw new Error(`Unknown provider: "${provider}". Available: ${Object.keys(DEFAULT_MODELS).join(', ')}`)
}
