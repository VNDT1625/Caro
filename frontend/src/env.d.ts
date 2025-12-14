// Vite environment types for TypeScript
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_API_URL?: string
  readonly VITE_AI_URL?: string
  readonly VITE_AI_ANALYSIS_URL?: string
  readonly VITE_AI_API_KEY?: string
  readonly VITE_AI_MODEL?: string
  readonly VITE_AI_TRIAL_EMAIL_REGEX?: string
  readonly VITE_AI_MAX_TOKENS?: string
  readonly VITE_PHP_BACKEND_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.jsonl?raw' {
  const content: string
  export default content
}
