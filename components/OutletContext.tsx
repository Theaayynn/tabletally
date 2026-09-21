"use client";

import { createContext, useContext, useState } from "react";

interface OutletContextValue {
  role: "ADMIN" | "EXECUTIVE";
  selectedOutletId: string | null; // null = "All Outlets" (admin only)
  setSelectedOutletId: (id: string | null) => void;
}

const OutletContext = createContext<OutletContextValue | null>(null);

export function OutletProvider({
  role,
  assignedOutletId,
  children,
}: {
  role: "ADMIN" | "EXECUTIVE";
  assignedOutletId: string | null;
  children: React.ReactNode;
}) {
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(
    role === "EXECUTIVE" ? assignedOutletId : null
  );

  return (
    <OutletContext.Provider
      value={{
        role,
        selectedOutletId: role === "EXECUTIVE" ? assignedOutletId : selectedOutletId,
        setSelectedOutletId: role === "EXECUTIVE" ? () => {} : setSelectedOutletId,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error("useOutlet must be used within OutletProvider");
  return ctx;
}
