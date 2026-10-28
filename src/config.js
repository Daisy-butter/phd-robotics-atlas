/**
 * LLM 辅助抽取配置（GitHub Pages 无法在浏览器内跑 7B 模型）
 *
 * 开发：`.env.local` 中设置
 *   VITE_LLM_MOCK=true          # 默认 mock，不请求真实 API
 *   VITE_LLM_API_URL=http://127.0.0.1:8000/v1/chat/completions
 *
 * 生产静态站：在构建前注入环境变量，或保持 mock。
 */
export const llmConfig = {
  mock: import.meta.env.VITE_LLM_MOCK !== 'false',
  apiUrl: import.meta.env.VITE_LLM_API_URL || 'http://127.0.0.1:8000/v1/chat/completions',
  model: import.meta.env.VITE_LLM_MODEL || 'Qwen/Qwen3-7B',
};
