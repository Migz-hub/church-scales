import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  Megaphone,
  Moon,
  Music,
  Plus,
  Sun,
  ThumbsUp,
  UserX,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { scheduleService } from "@/services/scheduleService";
import { announcementService, type AnnouncementWithRead } from "@/services/announcementService";
import { ministryService } from "@/services/ministryService";
import { ministryAdminService } from "@/services/ministryAdminService";
import type {
  AssignmentStatus,
  Ministry,
  Schedule,
  ScheduleAssignment,
} from "@/types";
import { cn } from "@/lib/utils";

interface MinistryStats {
  members: number;
  schedules: number;
  myUpcoming: number;
  avatarUrl?: string;
  pendingRequests?: number;
}

interface ScheduleCardData {
  schedule: Schedule;
  assignments: ScheduleAssignment[];
}

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeDay(iso: string) {
  const target = new Date(iso);
  const now = new Date();
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff > 1) return `daqui a ${diff} dias`;
  if (diff === -1) return "ontem";
  return `há ${Math.abs(diff)} dias`;
}

function SectionHeader({
  title,
  count,
  subtitle,
  actionLabel,
  actionTo,
  actionIcon,
}: {
  title: string;
  count?: string | number;
  subtitle?: string;
  actionLabel?: string;
  actionTo?: string;
  actionIcon?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-foreground/90">
            {title}
          </h2>
          {count !== undefined && (
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {actionTo && actionLabel && (
        <Link
          to={actionTo}
          className="text-sm text-primary hover:text-primary-glow inline-flex items-center gap-1"
        >
          {actionLabel}
          {actionIcon ?? <ChevronRight className="h-4 w-4" />}
        </Link>
      )}
    </div>
  );
}

function MinistryCard({
  ministry,
  active,
  stats,
  onSelect,
}: {
  ministry: Ministry;
  active: boolean;
  stats?: MinistryStats;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "shrink-0 w-[260px] snap-start rounded-2xl border p-2.5 text-left transition-all shadow-card relative",
        active
          ? "border-primary bg-primary/15 ring-1 ring-primary/40"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {stats?.avatarUrl ? (
            <img
              src={stats.avatarUrl}
              alt={ministry.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Music className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{ministry.name}</div>
          <div className="mt-1 flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {stats?.myUpcoming ?? 0}/{stats?.schedules ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {stats?.members ?? 0}
            </span>
          </div>
        </div>
        {active ? (
          <span className="absolute bottom-2 right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Check className="h-3 w-3" />
          </span>
        ) : (
          <ChevronRight className="absolute bottom-2 right-2 h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </button>
  );
}

function ScheduleCard({ data }: { data: ScheduleCardData }) {
  const { schedule, assignments } = data;
  const date = new Date(schedule.date);
  const hour = date.getHours();
  const isNight = hour >= 18 || hour < 6;
  const dayName = date.toLocaleDateString("pt-BR", { weekday: "long" });
  const timeStr = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const shortDate = date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });

  const total = assignments.length;
  const confirmed = assignments.filter((a) => a.status === "confirmed").length;
  const declined = assignments.filter((a) => a.status === "declined").length;
  const pending = assignments.filter(
    (a) => !a.status || a.status === "pending",
  ).length;
  const hasPending = schedule.requireConfirmation && pending > 0;

  return (
    <Link
      to={`/escalas/${schedule.id}`}
      className="shrink-0 w-[320px] snap-start rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
          {isNight ? (
            <Moon className="h-3.5 w-3.5" />
          ) : (
            <Sun className="h-3.5 w-3.5" />
          )}
          {dayName}, {timeStr}
        </div>
        <div className="text-xs text-muted-foreground">{shortDate}</div>
      </div>

      <div className="mt-2.5">
        <div className="font-semibold leading-tight">{schedule.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 capitalize">
          {relativeDay(schedule.date)}
        </div>
      </div>

      {assignments.length > 0 && (
        <div className="mt-3 flex -space-x-2">
          {assignments.slice(0, 5).map((a) => (
            <div
              key={a.id}
              className="h-7 w-7 rounded-full bg-primary/20 text-primary text-[11px] font-semibold flex items-center justify-center border-2 border-card"
              title={a.user?.name ?? a.label}
            >
              {initialsOf(a.user?.name ?? a.label)}
            </div>
          ))}
          {assignments.length > 5 && (
            <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold flex items-center justify-center border-2 border-card">
              +{assignments.length - 5}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 text-xs text-muted-foreground">
        {hasPending ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <ThumbsUp className="h-3.5 w-3.5" /> Pendente
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {total}
            </span>
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" /> {confirmed}
            </span>
          </>
        )}
        {declined > 0 && (
          <span className="inline-flex items-center gap-1">
            <UserX className="h-3.5 w-3.5" /> {declined}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { active, ministries, can, role, setActive } = useMinistry();
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<ScheduleCardData[]>([]);
  const [notifs, setNotifs] = useState<AnnouncementWithRead[]>([]);
  const [stats, setStats] = useState<Record<string, MinistryStats>>({});
  const [pendingRequests, setPendingRequests] = useState(0);
  const isAdmin = role === "owner" || role === "admin";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ministries.map(async (m) => {
          const [members, schedules, defaults, pending] = await Promise.all([
            ministryService.listMembers(m.id),
            scheduleService.list(m.id),
            ministryAdminService.getDefaults(m.id).catch(() => null),
            ministryService.listJoinRequests(m.id, "pending").catch(() => []),
          ]);
          const myUpcoming = await scheduleService.upcoming(user.id, m.id, 30);
          return [
            m.id,
            {
              members: members.length,
              schedules: schedules.length,
              myUpcoming: myUpcoming.length,
              avatarUrl: defaults?.avatarUrl,
              pendingRequests: pending.length,
            } satisfies MinistryStats,
          ] as const;
        }),
      );
      if (!cancelled) setStats(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, ministries]);

  useEffect(() => {
    if (!user || !active) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [ups, ns, jr] = await Promise.all([
        scheduleService.upcoming(user.id, active.id, 30),
        announcementService.list(active.id, user.id),
        ministryService.listJoinRequests(active.id, "pending").catch(() => []),
      ]);
      const withAssignments: ScheduleCardData[] = await Promise.all(
        ups.slice(0, 10).map(async (s) => ({
          schedule: s,
          assignments: await scheduleService.listAssignments(s.id),
        })),
      );
      setUpcoming(withAssignments);
      setNotifs(ns.slice(0, 5));
      setPendingRequests(jr.length);
      setLoading(false);
    })();
  }, [user, active]);

  const ministryCount = useMemo(() => ministries.length, [ministries]);

  if (!active) return null;

  return (
    <div>
      <PageHeader
        title={`Olá, ${user?.name.split(" ")[0]}`}
        description={`Visão geral de ${active.name}`}
        actions={
          can("schedule.create") ? (
            <Button asChild>
              <Link to="/escalas/nova">
                <Plus className="h-4 w-4 mr-1.5" />
                Nova escala
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-8">
        {/* MINISTÉRIOS */}
        <section>
          <SectionHeader
            title="Ministérios"
            count={ministryCount}
            subtitle="Toque para selecionar o ministério"
            actionLabel="Adicionar"
            actionTo="/ministerios/entrada"
            actionIcon={<Plus className="h-4 w-4" />}
          />
          <div className="flex gap-3 overflow-x-auto snap-x pb-1 -mx-1 px-1 scrollbar-hide">
            {ministries.map((m) => (
              <MinistryCard
                key={m.id}
                ministry={m}
                active={m.id === active.id}
                stats={stats[m.id]}
                onSelect={() => setActive(m.id)}
              />
            ))}
          </div>
        </section>

        {/* SOLICITAÇÕES PENDENTES */}
        {isAdmin && pendingRequests > 0 && (
          <section>
            <Link
              to="/ministerio?requests=1"
              className="block rounded-2xl border border-primary/40 bg-primary/10 hover:bg-primary/15 transition p-4 shadow-card"
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Novos membros chegaram!</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {pendingRequests === 1
                      ? `1 pessoa solicitou participação no ministério: ${active.name}.`
                      : `${pendingRequests} pessoas solicitaram participação no ministério: ${active.name}.`}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          </section>
        )}

        {/* AVISOS */}
        <section>
          <SectionHeader
            title="Avisos"
            count={`${notifs.filter((n) => !n.read).length}/${notifs.length}`}
            subtitle="Em destaque"
            actionLabel="Ver todos"
            actionTo="/notificacoes"
          />
          {notifs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-3 shadow-card">
              <Megaphone className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Lista vazia.</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifs.slice(0, 3).map((n) => (
                <li
                  key={n.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-start gap-3"
                >
                  <Megaphone className="h-4 w-4 text-primary mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.message && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {n.message}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* MINHAS ESCALAS */}
        <section>
          <SectionHeader
            title="Minhas escalas"
            count={upcoming.length}
            subtitle="Próximas"
            actionLabel="Ver todas"
            actionTo="/escalas"
          />
          {loading ? (
            <LoadingState />
          ) : upcoming.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-card">
              <Calendar className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma escala próxima.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto snap-x pb-1 -mx-1 px-1 scrollbar-hide">
              {upcoming.map((d) => (
                <ScheduleCard key={d.schedule.id} data={d} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
