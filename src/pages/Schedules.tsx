import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useMinistry } from "@/contexts/MinistryContext";
import { scheduleService } from "@/services/scheduleService";
import type { Schedule } from "@/types";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Schedules() {
  const { active, can } = useMinistry();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"proximas" | "anteriores">("proximas");

  const load = () => {
    if (!active) return;
    setLoading(true);
    scheduleService.list(active.id).then((s) => {
      setSchedules(s);
      setLoading(false);
    });
  };

  useEffect(load, [active]);

  const months = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    schedules.forEach((s) => years.add(new Date(s.date).getFullYear()));
    const list: string[] = [];
    Array.from(years)
      .sort()
      .forEach((y) => {
        for (let m = 0; m < 12; m++) {
          list.push(`${y}-${String(m + 1).padStart(2, "0")}`);
        }
      });
    return list;
  }, [schedules]);

  const now = useMemo(() => Date.now(), [schedules]);

  const byView = useMemo(() => {
    if (view === "proximas") {
      return schedules.filter((s) => new Date(s.date).getTime() >= now);
    }
    return schedules
      .filter((s) => new Date(s.date).getTime() < now)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, view, now]);

  const visible = useMemo(() => {
    if (filter === "all") return byView;
    return byView.filter((s) => monthKey(new Date(s.date)) === filter);
  }, [byView, filter]);

  if (!active) return null;

  return (
    <div>
      <PageHeader
        title="Escalas"
        description={`Todas as escalas de ${active.name}`}
        actions={
          <>
            {months.length > 0 && (
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {new Date(m + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {can("schedule.create") && (
              <Button asChild>
                <Link to="/escalas/nova">
                  <Plus className="h-4 w-4 mr-1.5" />Nova escala
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as "proximas" | "anteriores")} className="mb-4">
        <TabsList className="grid grid-cols-2 w-full sm:w-80 mx-auto">
          <TabsTrigger value="proximas">Próximas</TabsTrigger>
          <TabsTrigger value="anteriores">Anteriores</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <LoadingState />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={view === "proximas" ? "Nenhuma escala próxima" : "Nenhuma escala anterior"}
          description={
            view === "proximas"
              ? can("schedule.create")
                ? "Crie a primeira escala do ministério."
                : "Aguarde a liderança publicar uma escala."
              : "Ainda não há escalas passadas."
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => (
            <li key={s.id}>
              <Link
                to={`/escalas/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors shadow-card"
              >
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(s.date).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">Abrir</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}