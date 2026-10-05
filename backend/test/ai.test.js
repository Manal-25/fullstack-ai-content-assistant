import test from 'node:test';
import assert from 'node:assert/strict';
import { createSummarizer } from '../src/services/ai.js';

const valid = { summary: 'A concise summary.', tags: ['notes', 'planning', 'team'] };
const completed = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(valid) }] } }] };
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('sends source text and structured schema to Gemini with a server-side key header', async () => {
  let url, options;
  const summarize = createSummarizer({ apiKey: 'test-key', model: 'test-model', fetchImpl: async (target, request) => {
    url = target; options = request; return jsonResponse(completed);
  } });
  assert.deepEqual(await summarize('Source text'), valid);
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
  assert.equal(url.includes('test-key'), false);
  assert.equal(options.headers['x-goog-api-key'], 'test-key');
  assert.ok(options.signal instanceof AbortSignal);
  const sent = JSON.parse(options.body);
  assert.equal(sent.generationConfig.responseMimeType, 'application/json');
  assert.equal(sent.generationConfig.responseJsonSchema.properties.tags.minItems, 3);
  assert.equal(sent.generationConfig.responseJsonSchema.properties.tags.maxItems, 3);
  assert.equal(sent.contents[0].parts[0].text, 'Source text');
});

test('rejects invalid JSON, incomplete, empty, blocked, and malformed output', async () => {
  const cases = [
    { response: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] }, status: 502 },
    { response: { candidates: [{ finishReason: 'MAX_TOKENS' }] }, status: 502 },
    { response: { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] }, status: 502 },
    { response: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ ...valid, tags: ['one'] }) }] } }] }, status: 502 },
    { response: { candidates: [{ finishReason: 'SAFETY' }] }, status: 422 },
    { response: { promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }, status: 422 },
    { response: {}, status: 502 },
    { response: null, status: 502 },
  ];
  for (const item of cases) {
    const summarize = createSummarizer({ apiKey: 'test-key', fetchImpl: async () => jsonResponse(item.response) });
    await assert.rejects(() => summarize('Source'), error => error.status === item.status);
  }
});

test('handles quota, invalid credentials, unavailable models, billing, and server errors without leaking provider details', async () => {
  const cases = [
    { status: 429, expected: /quota limit/, appStatus: 503 },
    { status: 401, expected: /API key/, appStatus: 503 },
    { status: 403, expected: /API key/, appStatus: 503 },
    { status: 400, details: [{ reason: 'API_KEY_INVALID' }], expected: /API key/, appStatus: 503 },
    { status: 400, expected: /could not accept/, appStatus: 502 },
    { status: 404, expected: /model is unavailable/, appStatus: 503 },
    { status: 402, expected: /billing credits/, appStatus: 503 },
    { status: 503, expected: /temporarily unavailable/, appStatus: 502 },
  ];
  for (const item of cases) {
    const summarize = createSummarizer({ apiKey: 'test-key', fetchImpl: async () => jsonResponse({ error: { message: 'private-provider-details', details: item.details } }, item.status) });
    await assert.rejects(() => summarize('Source'), error => error.status === item.appStatus && item.expected.test(error.message) && !error.message.includes('private-provider-details'));
  }
});

test('aborts slow provider requests and returns a useful timeout error', async () => {
  // Keep the event loop alive: AbortSignal.timeout uses an unreferenced timer.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const summarize = createSummarizer({ apiKey: 'test-key', timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) });
    await assert.rejects(() => summarize('Source'), error => error.status === 504 && /too long/.test(error.message));
  } finally { clearTimeout(keepAlive); }
});

test('missing credentials fails before any network call', async () => {
  let calls = 0;
  const summarize = createSummarizer({ fetchImpl: async () => { calls++; } });
  await assert.rejects(() => summarize('Source'), error => error.status === 503 && /GEMINI_API_KEY/.test(error.message));
  assert.equal(calls, 0);
});

test('network errors and invalid HTTP response bodies produce safe errors', async () => {
  for (const fetchImpl of [
    async () => { throw new TypeError('private network details'); },
    async () => new Response('<html>Unavailable</html>', { status: 503 }),
    async () => new Response('broken JSON', { status: 200 }),
  ]) {
    await assert.rejects(() => createSummarizer({ apiKey: 'test-key', fetchImpl })('Source'), error => error.status === 502 && !error.message.includes('private'));
  }
});
