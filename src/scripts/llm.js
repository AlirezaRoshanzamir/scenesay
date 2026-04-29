export async function createLLM(provider, model) {
  if (provider === 'anthropic') {
    const { ChatAnthropic } = await import('@langchain/anthropic')
    return new ChatAnthropic({ model, maxTokens: 8192 })
  }
  if (provider === 'openai') {
    const { ChatOpenAI } = await import('@langchain/openai')
    return new ChatOpenAI({ model, maxTokens: 8192 })
  }
  throw new Error(`Unknown provider: "${provider}". Available: anthropic, openai`)
}
