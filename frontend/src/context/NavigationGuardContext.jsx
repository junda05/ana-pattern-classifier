import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/**
 * Guards unsaved work against leaving the page.
 *
 * BrowserRouter offers no navigation blocker, so the guard has two parts:
 * - `useUnsavedChangesGuard(when)`, used by a page with unsaved work: while `when` is true
 *   the browser asks before unloading (reload, closing the tab) and in-app navigation asks first.
 * - `useNavigationGuard()`, used by the controls that leave the page (sidebar links, logout):
 *   `confirmLeave(proceed)` runs `proceed` at once, or after the user confirms when some page
 *   holds unsaved work.
 */
const NavigationGuardContext = createContext(null);

export const NavigationGuardProvider = ({ children }) => {
  const blockCountRef = useRef(0);
  const [pendingLeave, setPendingLeave] = useState(null);

  // Returns the function that releases this block (safe to call more than once)
  const block = useCallback(() => {
    blockCountRef.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      blockCountRef.current -= 1;
    };
  }, []);

  const hasUnsavedWork = useCallback(() => blockCountRef.current > 0, []);

  const confirmLeave = useCallback((proceed) => {
    if (blockCountRef.current > 0) {
      setPendingLeave(() => proceed);
    } else {
      proceed();
    }
  }, []);

  const handleLeave = () => {
    const proceed = pendingLeave;
    setPendingLeave(null);
    proceed?.();
  };

  const value = useMemo(() => ({ block, hasUnsavedWork, confirmLeave }), [block, hasUnsavedWork, confirmLeave]);

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <ConfirmDialog
        isOpen={pendingLeave !== null}
        title="Leave Without Saving?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        onConfirm={handleLeave}
        onCancel={() => setPendingLeave(null)}
      >
        The images and results you have not saved will be lost.
      </ConfirmDialog>
    </NavigationGuardContext.Provider>
  );
};

/**
 * Marks the calling page as holding unsaved work while `when` is true.
 *
 * @param {boolean} when - Whether there is unsaved work
 */
export const useUnsavedChangesGuard = (when) => {
  const block = useContext(NavigationGuardContext)?.block;

  useEffect(() => {
    if (!when) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      // Older browsers need returnValue set to show the prompt
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    const release = block?.();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      release?.();
    };
  }, [when, block]);
};

const leaveAtOnce = (proceed) => proceed();
const nothingUnsaved = () => false;

/**
 * Controls that leave the current page ask through this hook first.
 * Without a provider nothing is guarded.
 *
 * @returns {{ confirmLeave: Function, hasUnsavedWork: Function }}
 */
export const useNavigationGuard = () => {
  const context = useContext(NavigationGuardContext);
  return {
    confirmLeave: context?.confirmLeave ?? leaveAtOnce,
    hasUnsavedWork: context?.hasUnsavedWork ?? nothingUnsaved,
  };
};
