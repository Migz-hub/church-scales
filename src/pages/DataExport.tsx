import { useState } from "react";
import { Database, Users, FileText, Calendar, Bell, MessageSquare, History, Download, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMinistry } from "@/contexts/MinistryContext";
import { downloadCSV, toCSV } from "@/lib/csvExport";

type ExportableTable =
  | "profiles"
  | "ministries"
  | "ministry_members"
  | "ministry_functions"
  | "ministry_teams"
  | "ministry_team_functions"
  | "member_permissions"
  | "user_roles"
  | "schedules"
  | "schedule_assignments"
  | "schedule_agenda_items"
  | "schedule_history"
  | "unavailabilities"
  | "announcements"
  | "announcement_reads"
  | "chat_messages"
  | "notifications"
  | "ministry_join_requests";

interface ExportItem {
  table: ExportableTable;
  label: string;
  description: string;
  scoped?: boolean; // filtered by ministry_id
}

interface ExportSection {
  id: string;
  label: string;
  icon: React.ElementType;
  items: ExportItem[];
}

const sections: ExportSection[] = [
  {
    id: "database",
    label: "Database",
    icon: Database,
    items: [
      { table: "ministries", label: "Ministérios", description: "Dados dos ministérios" },
      { table: "ministry_functions", label: "Funções", description: "Funções do ministério", scoped: true },
      { table: "ministry_teams", label: "Equipes", description: "Equipes do ministério", scoped: true },
      { table: "ministry_team_functions", label: "Equipes × Funções", description: "Vínculo de funções por equipe" },
      { table: "member_permissions", label: "Permissões", description: "Permissões por membro", scoped: true },
    ],
  },
  {
    id: "users",
    label: "Usuários",
    icon: Users,
    items: [
      { table: "profiles", label: "Perfis", description: "Perfis de usuários visíveis" },
      { table: "ministry_members", label: "Membros do ministério", description: "Lista de membros", scoped: true },
      { table: "user_roles", label: "Papéis", description: "Funções/permissões dos usuários", scoped: true },
      { table: "ministry_join_requests", label: "Solicitações de entrada", description: "Pedidos pendentes/aprovados", scoped: true },
    ],
  },
  {
    id: "appointments",
    label: "Escalas (Appointments)",
    icon: Calendar,
    items: [
      { table: "schedules", label: "Escalas", description: "Todas as escalas", scoped: true },
      { table: "schedule_assignments", label: "Designações", description: "Designações por escala" },
      { table: "schedule_agenda_items", label: "Itens de agenda", description: "Agenda das escalas" },
      { table: "unavailabilities", label: "Indisponibilidades", description: "Períodos de indisponibilidade", scoped: true },
    ],
  },
  {
    id: "messages",
    label: "Mensagens & Avisos",
    icon: MessageSquare,
    items: [
      { table: "chat_messages", label: "Mensagens do chat", description: "Histórico do chat", scoped: true },
      { table: "announcements", label: "Avisos", description: "Avisos do ministério", scoped: true },
      { table: "announcement_reads", label: "Leituras de avisos", description: "Quem leu cada aviso" },
    ],
  },
  {
    id: "notifications",
    label: "Notificações",
    icon: Bell,
    items: [
      { table: "notifications", label: "Notificações", description: "Suas notificações" },
    ],
  },
  {
    id: "logs",
    label: "Logs",
    icon: History,
    items: [
      { table: "schedule_history", label: "Histórico de escalas", description: "Eventos e alterações", scoped: true },
    ],
  },
];

export default function DataExport() {
  const { active } = useMinistry();
  const [loading, setLoading] = useState<string | null>(null);

  const exportTable = async (item: ExportItem) => {
    setLoading(item.table);
    try {
      const builder: any = supabase.from(item.table).select("*").limit(10000);
      const query = item.scoped && active?.id ? builder.eq("ministry_id", active.id) : builder;
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      if (rows.length === 0) {
        toast({ title: "Sem dados", description: `Nenhum registro em "${item.label}".` });
        return;
      }
      const csv = toCSV(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCSV(`${item.table}_${stamp}.csv`, csv);
      toast({ title: "Exportado", description: `${rows.length} registros exportados de "${item.label}".` });
    } catch (err) {
      toast({
        title: "Erro ao exportar",
        description: err instanceof Error ? err.message : "Falha desconhecida.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const exportAllInSection = async (section: ExportSection) => {
    for (const item of section.items) {
      await exportTable(item);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Exportar dados"
        description="Baixe os dados do seu ministério em CSV. Apenas registros aos quais você tem acesso serão exportados."
      />

      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.id} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <section.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{section.label}</div>
                  <div className="text-xs text-muted-foreground">{section.items.length} tabelas</div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportAllInSection(section)} disabled={loading !== null}>
                <Download className="h-4 w-4" />
                Tudo
              </Button>
            </div>
            <div className="divide-y divide-border">
              {section.items.map((item) => (
                <div key={item.table} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.description}
                      {item.scoped ? " · filtrado pelo ministério ativo" : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => exportTable(item)}
                    disabled={loading !== null}
                  >
                    {loading === item.table ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    CSV
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="mb-1"><strong className="text-foreground">Storage</strong> e <strong className="text-foreground">Functions</strong>: este projeto não possui buckets de armazenamento nem funções customizadas configuradas no momento.</p>
              <p><strong className="text-foreground">Logs do sistema</strong> (auth, banco, edge) ficam disponíveis no painel do Lovable Cloud — apenas o histórico de escalas é exportável aqui.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
