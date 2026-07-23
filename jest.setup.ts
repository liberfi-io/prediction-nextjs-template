import "@testing-library/jest-dom";

class ResizeObserverMock implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

global.ResizeObserver ??= ResizeObserverMock;
