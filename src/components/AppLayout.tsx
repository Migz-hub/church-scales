import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, Calendar, CalendarOff, Download, Home, LogOut, MessageSquare, Settings, Users, ChevronsUpDown, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { announcementService } from "@/services/announcementService";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/escalas", label: "Escalas", icon: Calendar },
  { to: "/chat", label: "Mensagens", icon: MessageSquare },
  { to: "/ministerio", label: "Ministério", icon: Users },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/indisponibilidade", label: "Indisponibilidade", icon: CalendarOff },
  { to: "/exportar", label: "Exportar dados", icon: Download },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { ministries, active, role, setActive } = useMinistry();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || !active) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const refresh = () =>
      announcementService.unreadCount(active.id, user.id).then((n) => {
        if (!cancelled) setUnread(n);
      });
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [user, active]);

  const initials = user?.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Link to="/dashboard"><Logo /></Link>
        </div>

        <div className="px-3 py-3 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent text-left">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Ministério</div>
                  <div className="truncate text-sm font-medium">{active?.name ?? "—"}</div>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Seus ministérios</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ministries.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => setActive(m.id)}>
                  <span className="truncate">{m.name}</span>
                  {active?.id === m.id && <Check className="h-4 w-4 ml-auto text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/ministerios/entrada")}>
                Entrar / criar ministério
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/notificacoes" && unread > 0 && (
                <span className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent text-left">
                <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{role ? roleLabel[role] : ""}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{user?.name}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/perfil")}>
                <Users className="h-4 w-4 mr-2" /> Meu perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
              >
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
          <Logo size="sm" />
          <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate("/login"))}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <nav className="lg:hidden flex overflow-x-auto gap-1 px-3 py-2 border-b border-border bg-card/30">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
              {item.to === "/notificacoes" && unread > 0 && (
                <span className="ml-1 min-w-[1rem] h-4 px-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-semibold">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}