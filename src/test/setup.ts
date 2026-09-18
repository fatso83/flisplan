import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver
