import React, { createContext, useCallback, useContext, useRef } from "react";

// Lets the nav's global "+ Add event" button reuse whichever page's own
// add-event flow is currently mounted (Dashboard's openModal, Calendar's
// openAddForm) instead of duplicating that logic in App.jsx.
const QuickAddContext = createContext(undefined);

export function QuickAddProvider({ children }) {
  const openerRef = useRef(null);

  const registerOpenAdd = useCallback((fn) => {
    openerRef.current = fn;
    return () => {
      if (openerRef.current === fn) openerRef.current = null;
    };
  }, []);

  // Returns true if a page handled the request, false if nothing is registered.
  const openAdd = useCallback(() => {
    if (openerRef.current) {
      openerRef.current();
      return true;
    }
    return false;
  }, []);

  const value = { registerOpenAdd, openAdd };

  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>;
}

export function useQuickAdd() {
  const context = useContext(QuickAddContext);
  if (context === undefined) {
    throw new Error("useQuickAdd must be used within a QuickAddProvider");
  }
  return context;
}
