import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { clearApiQueryCache } from '../shared/api/hooks'

afterEach(() => {
  cleanup()
  clearApiQueryCache()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
