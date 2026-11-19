// Jest setup for React Testing Library (loaded automatically by react-scripts).
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';

// Multi-step flows (typing, several requests) can exceed the 1 s default on a loaded CI machine.
configure({ asyncUtilTimeout: 5000 });
// Whole-page flows take 2-3 s on their own and more when every suite runs in parallel;
// the 5 s Jest default made them time out intermittently on a loaded machine.
jest.setTimeout(20000);

// jsdom 16 (bundled with react-scripts 5) lacks these globals; React Router 7 needs them.
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// jsdom does not implement these browser APIs; tests that assert on them install jest mocks.
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof URL.createObjectURL === 'undefined') {
  let objectUrlCount = 0;
  URL.createObjectURL = () => `blob:test-object-${(objectUrlCount += 1)}`;
  URL.revokeObjectURL = () => {};
}
