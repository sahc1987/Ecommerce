// Vitest runs without globals, so Testing Library can't register its own
// cleanup: unmount rendered components after every test here instead.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom has <dialog> but not its modal methods. Toggle `open` and fire the
// `close` event as browsers do; real focus and Escape handling are checked in
// a browser.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
