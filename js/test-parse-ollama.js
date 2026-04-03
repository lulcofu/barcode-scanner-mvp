/**
 * Unit tests for parseOllamaNDJSON
 * Run: node js/test-parse-ollama.js
 */
const { parseOllamaNDJSON } = require('./app.js');

let passed = 0, failed = 0;

function assert(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ===== Test 1: 實際 GLM-5 回應（含 thinking + content，}{黏接，content含 {15} ）=====
console.log('\nTest 1: GLM-5 streaming with thinking + regex content {15}');
{
  // 模擬使用者貼的實際回應：thinking chunks + content chunks，含 {15}
  const chunks = [
    { message: { role: 'assistant', content: '', thinking: 'The user wants a regex' }, done: false },
    { message: { role: 'assistant', content: '', thinking: 'pattern ^[A-Z0-9]{15}$' }, done: false },
    { message: { role: 'assistant', content: '[A-Z0-' }, done: false },
    { message: { role: 'assistant', content: '9]{15}' }, done: false },
    { message: { role: 'assistant', content: '' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' },
  ];
  const text = chunks.map(c => JSON.stringify(c)).join('');
  assert('extracts content only, ignoring thinking', parseOllamaNDJSON(text), '[A-Z0-9]{15}');
}

// ===== Test 2: 實際 GLM-5 回應（含 {14}$ ）=====
console.log('\nTest 2: GLM-5 response with {14}$ regex');
{
  const chunks = [
    { message: { role: 'assistant', content: '', thinking: 'analyzing...' }, done: false },
    { message: { role: 'assistant', content: '^[A-Z' }, done: false },
    { message: { role: 'assistant', content: '0-9]{' }, done: false },
    { message: { role: 'assistant', content: '14}$' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' },
  ];
  const text = chunks.map(c => JSON.stringify(c)).join('');
  assert('parses {14}$ without breaking', parseOllamaNDJSON(text), '^[A-Z0-9]{14}$');
}

// ===== Test 3: 換行分隔的 NDJSON =====
console.log('\nTest 3: newline-separated NDJSON');
{
  const chunks = [
    { message: { role: 'assistant', content: 'hello' }, done: false },
    { message: { role: 'assistant', content: ' world' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true },
  ];
  const text = chunks.map(c => JSON.stringify(c)).join('\n');
  assert('works with newline separators', parseOllamaNDJSON(text), 'hello world');
}

// ===== Test 4: 單一非 streaming 回應（stream:false 正常運作時）=====
console.log('\nTest 4: single non-streaming response');
{
  const single = { message: { role: 'assistant', content: '^[A-Z]{10}$' }, done: true };
  const text = JSON.stringify(single);
  assert('parses single JSON object', parseOllamaNDJSON(text), '^[A-Z]{10}$');
}

// ===== Test 5: content 含跳脫引號 =====
console.log('\nTest 5: content with escaped quotes');
{
  const chunks = [
    { message: { role: 'assistant', content: 'say "hello"' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true },
  ];
  const text = chunks.map(c => JSON.stringify(c)).join('');
  assert('handles escaped quotes in content', parseOllamaNDJSON(text), 'say "hello"');
}

// ===== Test 6: content 含反斜線 =====
console.log('\nTest 6: content with backslashes (regex escapes)');
{
  const chunks = [
    { message: { role: 'assistant', content: '^\\d{3}' }, done: false },
    { message: { role: 'assistant', content: '-\\d{4}$' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true },
  ];
  const text = chunks.map(c => JSON.stringify(c)).join('');
  assert('handles backslash regex escapes', parseOllamaNDJSON(text), '^\\d{3}-\\d{4}$');
}

// ===== Test 7: 空回應 =====
console.log('\nTest 7: empty response');
{
  assert('returns empty for empty string', parseOllamaNDJSON(''), '');
}

// ===== Test 8: 只有 thinking 沒有 content =====
console.log('\nTest 8: only thinking, no content');
{
  const chunks = [
    { message: { role: 'assistant', content: '', thinking: 'thinking hard...' }, done: false },
    { message: { role: 'assistant', content: '', thinking: 'still thinking...' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true },
  ];
  const text = chunks.map(c => JSON.stringify(c)).join('');
  assert('returns empty when only thinking', parseOllamaNDJSON(text), '');
}

// ===== Test 9: 實際完整 GLM-5 回應片段（從使用者貼的原始資料重建）=====
console.log('\nTest 9: reconstructed real GLM-5 response');
{
  // 直接用原始 JSON 字串黏接
  const text =
    '{"model":"glm-5","created_at":"2026-04-03T13:28:55.948130966Z","message":{"role":"assistant","content":"[A-Z0-"},"done":false}' +
    '{"model":"glm-5","created_at":"2026-04-03T13:28:55.950448688Z","message":{"role":"assistant","content":"9]{15}"},"done":false}' +
    '{"model":"glm-5","created_at":"2026-04-03T13:28:55.950907689Z","message":{"role":"assistant","content":""},"done":false}' +
    '{"model":"glm-5","created_at":"2026-04-03T13:28:56.162347755Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","total_duration":4696587873,"prompt_eval_count":72,"eval_count":750}';
  assert('parses real GLM-5 content chunks', parseOllamaNDJSON(text), '[A-Z0-9]{15}');
}

// ===== Test 10: thinking 中也含大括號 =====
console.log('\nTest 10: thinking contains braces like {14}');
{
  const chunks = [
    { message: { role: 'assistant', content: '', thinking: 'Pattern: ^[A-Z0-9]{14}$' }, done: false },
    { message: { role: 'assistant', content: '^[A-Z0-9]{14}$' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true },
  ];
  const text = chunks.map(c => JSON.stringify(c)).join('');
  assert('braces in thinking dont break parsing', parseOllamaNDJSON(text), '^[A-Z0-9]{14}$');
}

// ===== Test 11: 多段有意義的 content =====
console.log('\nTest 11: multiple content chunks forming a sentence');
{
  const chunks = [
    { message: { role: 'assistant', content: 'The ' }, done: false },
    { message: { role: 'assistant', content: 'pattern ' }, done: false },
    { message: { role: 'assistant', content: 'is: ^\\w+$' }, done: false },
    { message: { role: 'assistant', content: '' }, done: true },
  ];
  const text = chunks.map(c => JSON.stringify(c)).join('');
  assert('concatenates multiple content chunks', parseOllamaNDJSON(text), 'The pattern is: ^\\w+$');
}

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
