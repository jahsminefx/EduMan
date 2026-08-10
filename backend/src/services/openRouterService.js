const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

class OpenRouterError extends Error {
    constructor(message, { status = 502, code = 'openrouter_error', retryAfter = null, details = null } = {}) {
        super(message);
        this.name = 'OpenRouterError';
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
        this.details = details;
    }
}

function parseJsonContent(content) {
    if (typeof content !== 'string' || !content.trim()) {
        throw new OpenRouterError('The EduMan AI provider returned an empty response.', { code: 'empty_response' });
    }

    const trimmed = content.trim();
    const withoutFence = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');

    try {
        return JSON.parse(withoutFence);
    } catch {
        throw new OpenRouterError('The EduMan AI provider returned content that could not be parsed.', {
            code: 'invalid_json_response'
        });
    }
}

function friendlyMessage(status, providerMessage) {
    if (status === 401) return 'OpenRouter authentication failed. Ask an administrator to verify the API key.';
    if (status === 402) return 'The OpenRouter account has insufficient credits.';
    if (status === 403) return 'The EduMan AI request was blocked by the provider.';
    if (status === 408 || status === 504) return 'The EduMan AI request timed out. Please try again.';
    if (status === 429) return 'The EduMan AI provider is busy or rate-limited. Please try again shortly.';
    if (status === 502 || status === 503) return 'The selected EduMan AI model is temporarily unavailable.';
    return providerMessage || 'EduMan AI generation failed. Please try again.';
}

async function wait(milliseconds) {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function callOpenRouter({
    messages,
    responseSchema,
    schemaName,
    model,
    maxTokens = 5000,
    temperature = 0.35
}) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new OpenRouterError('OpenRouter is not configured on the server.', {
            status: 503,
            code: 'missing_api_key'
        });
    }

    const selectedModel = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o';
    const timeoutMs = Math.max(10000, Number(process.env.OPENROUTER_TIMEOUT_MS) || 90000);
    const requestBody = {
        model: selectedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
        response_format: {
            type: 'json_schema',
            json_schema: {
                name: schemaName,
                strict: true,
                schema: responseSchema
            }
        },
        provider: {
            require_parameters: true
        }
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
                    'X-Title': process.env.OPENROUTER_APP_NAME || 'EduMan AI',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            const retryAfterHeader = Number(response.headers.get('retry-after'));
            let payload;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            const embeddedError = payload?.error || payload?.choices?.[0]?.error;
            if (!response.ok || embeddedError) {
                const status = Number(embeddedError?.code) || response.status || 502;
                const retryAfter = Number.isFinite(retryAfterHeader) ? retryAfterHeader : null;
                if (attempt === 0 && (status === 429 || status === 503)) {
                    await wait(Math.min(Math.max((retryAfter || 2) * 1000, 1000), 10000));
                    continue;
                }

                throw new OpenRouterError(
                    friendlyMessage(status, embeddedError?.message),
                    {
                        status,
                        code: embeddedError?.metadata?.error_type || 'openrouter_error',
                        retryAfter,
                        details: embeddedError?.metadata || null
                    }
                );
            }

            const content = payload?.choices?.[0]?.message?.content;
            const parsed = typeof content === 'object' && content !== null
                ? content
                : parseJsonContent(content);

            return {
                data: parsed,
                raw: payload,
                model: payload?.model || selectedModel,
                usage: payload?.usage || {}
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new OpenRouterError('The EduMan AI request timed out. Please try again.', {
                    status: 504,
                    code: 'timeout'
                });
            }
            if (error instanceof OpenRouterError || error?.name === 'OpenRouterError') throw error;
            console.error('OpenRouter fetch network error:', error);
            throw new OpenRouterError('Could not connect to the EduMan AI provider. Please try again.', {
                status: 502,
                code: 'network_error'
            });
        } finally {
            clearTimeout(timer);
        }
    }

    throw new OpenRouterError('EduMan AI generation failed. Please try again.');
}

module.exports = {
    callOpenRouter,
    OpenRouterError
};
