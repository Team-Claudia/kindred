import '@testing-library/jest-dom/vitest'

// Screens import the Supabase client, which needs a URL and key to load.
// Tests never reach the network; they mock the client where it matters.
if (!import.meta.env.VITE_SUPABASE_URL) vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

// jsdom has no matchMedia; platform.isStandalone() reads it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
