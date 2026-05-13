import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { LoadingState } from "./LoadingState";
import type { ReactNode } from "react";

export function ProtectedRoute({ children, requireMinistry = true }: { children: ReactNode; requireMinistry?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const { ministries, loading: ministryLoading } = useMinistry();
  const location = useLocation();

  if (authLoading) return <LoadingState />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (requireMinistry) {
    if (ministryLoading) return <LoadingState />;
    if (ministries.length === 0 && !location.pathname.startsWith("/ministerios/")) {
      return <Navigate to="/ministerios/entrada" replace />;
    }
  }

  return <>{children}</>;
}