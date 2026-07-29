import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

class ResizeObserverMock implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

global.ResizeObserver ??= ResizeObserverMock;
global.TextEncoder ??= TextEncoder;
global.TextDecoder ??= TextDecoder as typeof global.TextDecoder;
