import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ministryService } from "@/services/ministryService";
import { STORAGE_KEYS, storage } from "@/lib/storage";
import { useAuth } from "./AuthContext";
import type { Ministry, MinistryMember, Role } from "@/types";
import { can, type PermissionAction } from "@/lib/permissions";

interface MinistryContextValue {
  loading: boolean;
  ministries: Ministry[];
  active: Ministry | null;
  membership: MinistryMember | null;
  role: Role | null;
  setActive: (ministryId: string) => void;
  refresh: () => Promise<void>;
  can: (action: PermissionAction) => boolean;
}

const MinistryContext = createContext<MinistryContextValue | undefined>(undefined);

export function MinistryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [membership, setMembership] = useState<MinistryMember | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setMinistries([]);
      setActiveId(null);
      setMembership(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await ministryService.listForUser(user.id);
    setMinistries(list);
    if (list.length === 0) {
      setActiveId(null);
      setMembership(null);
      storage.remove(STORAGE_KEYS.activeMinistry);
    } else {
      const saved = storage.get<string | null>(STORAGE_KEYS.activeMinistry, null);
      const next = (saved && list.find((m) => m.id === saved)) || list[0];
      setActiveId(next.id);
      storage.set(STORAGE_KEYS.activeMinistry, next.id);
      const mem = await ministryService.getMembership(next.id, user.id);
      setMembership(mem);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActive = useCallback(
    async (ministryId: string) => {
      if (!user) return;
      setActiveId(ministryId);
      storage.set(STORAGE_KEYS.activeMinistry, ministryId);
      const mem = await ministryService.getMembership(ministryId, user.id);
      setMembership(mem);
    },
    [user],
  );

  const active = useMemo(
    () => ministries.find((m) => m.id === activeId) ?? null,
    [ministries, activeId],
  );

  const role = membership?.role ?? null;

  const value: MinistryContextValue = {
    loading,
    ministries,
    active,
    membership,
    role,
    setActive,
    refresh,
    can: (action) => can(role, action),
  };

  return <MinistryContext.Provider value={value}>{children}</MinistryContext.Provider>;
}

export function useMinistry() {
  const ctx = useContext(MinistryContext);
  if (!ctx) throw new Error("useMinistry deve ser usado dentro de <MinistryProvider>");
  return ctx;
}