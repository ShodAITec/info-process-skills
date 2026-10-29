/**
 * 通用 OpenAI 兼容 provider。
 *
 * 任何遵循 /chat/completions 规范的服务都能接：TheHive、OpenAI、Azure、
 * DeepSeek 官方、Moonshot、本地 Ollama / vLLM / LM Studio 等。
 * 这是引擎与模型之间唯一的耦合点——换模型不需要改技能，也不需要改执行器。
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} cfg
 * @param {string} cfg.endpoint  完整的 chat/completions 地址
 * @param {string} cfg.apiKey
 * @param {string} cfg.model
 * @param {string} [cfg.label]
 * @param {object} [cfg.extraBody] 该服务特有的参数
 */
export function createProvider({ endpoint, apiKey, model, label, extraBody = {}, headers = {} }) {
  async function complete({
    messages, tools, maxTokens = 16000, temperature = 0.3,
    jsonMode = false, signal, retries = 3, model: modelOverride,
    reasoningEffort, maxThinkingTokens,
  } = {}) {
    const body = {
      model: modelOverride || model,
      messages,
      // 新旧两种字段名都带上：部分服务只认 max_tokens，部分只认 max_completion_tokens
      max_completion_tokens: maxTokens,
      max_tokens: maxTokens,
      temperature,
      ...(tools?.length ? { tools } : {}),
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      // 推理模型（DeepSeek 等）的思考预算。长文写作必须压低，
      // 否则推理会吃光 max_completion_tokens，正文一个字都出不来。
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      ...(maxThinkingTokens ? { max_thinking_tokens: maxThinkingTokens } : {}),
      ...extraBody,
    };

    let last;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body),
          signal: signal ?? AbortSignal.timeout(15 * 60 * 1000),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const retryable = res.status === 429 || res.status >= 500;
          const err = new Error(`${label || 'provider'} HTTP ${res.status}: ${text.slice(0, 300)}`);
          if (!retryable) throw Object.assign(err, { fatal: true });
          throw err;
        }

        const data = await res.json();
        if (data.error) {
          throw Object.assign(new Error(`${label}: ${JSON.stringify(data.error).slice(0, 300)}`), { fatal: true });
        }
        const choice = data.choices?.[0];
        if (!choice) throw new Error(`${label}: 返回了空 choices`);

        return {
          content: choice.message?.content ?? '',
          // DeepSeek 等推理模型把思考过程单独放在 reasoning_content
          reasoning: choice.message?.reasoning_content ?? '',
          toolCalls: choice.message?.tool_calls ?? [],
          finishReason: choice.finish_reason,
          usage: {
            input: data.usage?.prompt_tokens ?? 0,
            output: data.usage?.completion_tokens ?? 0,
            reasoning: data.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
            cached: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
          },
        };
      } catch (e) {
        last = e;
        if (e.fatal || attempt === retries) break;
        await sleep(1200 * 2 ** attempt);
      }
    }
    throw last;
  }

  async function health() {
    const t0 = Date.now();
    const r = await complete({ messages: [{ role: 'user', content: 'ping' }], maxTokens: 2000 });
    return { ok: true, ms: Date.now() - t0, model, label, sample: (r.content || r.reasoning || '').slice(0, 40) };
  }

  return { name: label, label, model, endpoint, complete, health, supportsTools: true };
}
