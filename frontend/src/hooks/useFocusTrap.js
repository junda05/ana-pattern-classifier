import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Traps that are currently active, the most recently activated last. Only the
// topmost trap reacts to keys, so Escape closes exactly one dialog even when a
// dialog is stacked (or nested) on top of another one.
const activeTraps = [];

const isTopmost = (trap) => activeTraps[activeTraps.length - 1] === trap;

/**
 * Keeps keyboard focus inside `containerRef` while `active` is true (WCAG 2.1.2 / 2.4.3).
 *
 * - On activation, focus moves to the element marked `data-autofocus`, else the first
 *   focusable element, else the container itself (give it `tabIndex={-1}`).
 *   Use `data-autofocus` instead of React's `autoFocus` inside trapped containers:
 *   `autoFocus` moves focus before the trap can remember the opener.
 * - Tab / Shift+Tab wrap around; Tab while focus is outside pulls it back inside.
 * - Escape calls `onEscape` (only for the topmost active trap).
 * - On deactivation, focus returns to the element that had it before (the opener).
 *
 * @param {React.RefObject<HTMLElement>} containerRef - Element that holds the focus
 * @param {boolean} active - Whether the trap is on
 * @param {Function} [onEscape] - Called when Escape is pressed
 */
export function useFocusTrap(containerRef, active, onEscape) {
  // Read the latest callback through a ref: an inline callback must not re-run
  // the effect, which would move focus back to the first element on every render.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active || !containerRef.current) return undefined;

    const container = containerRef.current;
    const trap = {};
    activeTraps.push(trap);

    const previouslyFocused = document.activeElement;
    const focusables = () => Array.from(container.querySelectorAll(FOCUSABLE));

    if (!container.contains(document.activeElement)) {
      (container.querySelector('[data-autofocus]') ?? focusables()[0] ?? container).focus();
    }

    const onKeyDown = (event) => {
      if (!isTopmost(trap)) return;

      if (event.key === 'Escape') {
        if (!onEscapeRef.current) return;
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (!container.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = activeTraps.indexOf(trap);
      if (index !== -1) activeTraps.splice(index, 1);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [containerRef, active]);
}

export default useFocusTrap;
