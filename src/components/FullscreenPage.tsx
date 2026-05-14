import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import type { ReactNode } from "react";

export function FullscreenPage({
  children,
  backTo,
  className = "max-w-2xl",
}: {
  children: ReactNode;
  backTo?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border bg-card/40 backdrop-blur">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Logo size="sm" />
        <div className="w-[88px]" />
      </header>
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 py-6 lg:py-10 ${className}`}>
        {children}
      </main>
    </div>
  );
}
