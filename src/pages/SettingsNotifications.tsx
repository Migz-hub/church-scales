import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/storage";
import { toast } from "sonner";

const NOTIF_KEY = "notif_prefs_v2";

type Prefs = {
  all: boolean;
  myScales: { on: boolean; added: boolean; removed: boolean; edited: boolean; deleted: boolean; chat: boolean };
  reminder: { on: boolean; h2: boolean; d1: boolean; d5: boolean };
  generalScales: { on: boolean; created: boolean; edited: boolean; deleted: boolean };
  messages: { on: boolean; received: boolean };
  generalUnav: { on: boolean; created: boolean; edited: boolean; deleted: boolean };
  announcements: { on: boolean; created: boolean; edited: boolean; messages: boolean };
};

const DEFAULT: Prefs = {
  all: true,
  myScales: { on: true, added: true, removed: true, edited: true, deleted: true, chat: true },
  reminder: { on: true, h2: true, d1: true, d5: true },
  generalScales: { on: true, created: true, edited: true, deleted: true },
  messages: { on: true, received: true },
  generalUnav: { on: true, created: true, edited: true, deleted: true },
  announcements: { on: true, created: true, edited: true, messages: true },
};

function Group({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="font-semibold text-sm">{title}</div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && <div className="divide-y divide-border/60">{children}</div>}
    </div>
  );
}

function Item({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SettingsNotifications() {
  const navigate = useNavigate();
  const [p, setP] = useState<Prefs>(() => storage.get<Prefs>(NOTIF_KEY, DEFAULT));

  const update = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setP((s) => ({ ...s, [k]: v }));
  const updateGroup = <K extends keyof Prefs>(k: K, field: string, v: boolean) => {
    setP((s) => ({ ...s, [k]: { ...(s[k] as Record<string, boolean>), [field]: v } } as Prefs));
  };

  const onSave = () => {
    storage.set(NOTIF_KEY, p);
    toast.success("Preferências salvas");
    navigate("/configuracoes");
  };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/configuracoes")} className="p-2 -ml-2 rounded-full hover:bg-muted/40">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">Configurar notificações</h1>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card flex items-center justify-between px-4 py-3">
          <div className="font-semibold text-sm">Todas</div>
          <Switch checked={p.all} onCheckedChange={(v) => update("all", v)} />
        </div>

        <Group title="Escalas que participo" enabled={p.myScales.on && p.all} onToggle={(v) => updateGroup("myScales", "on", v)}>
          <Item label="Adicionado à escala" desc="Sempre que eu for adicionado à uma escala" checked={p.myScales.added} onChange={(v) => updateGroup("myScales", "added", v)} />
          <Item label="Removido da escala" desc="Sempre que eu for removido de uma escala" checked={p.myScales.removed} onChange={(v) => updateGroup("myScales", "removed", v)} />
          <Item label="Edição" desc="Sempre que uma escala que eu participo for alterada" checked={p.myScales.edited} onChange={(v) => updateGroup("myScales", "edited", v)} />
          <Item label="Exclusão" desc="Sempre que uma escala que eu participo for removida" checked={p.myScales.deleted} onChange={(v) => updateGroup("myScales", "deleted", v)} />
          <Item label="Mensagem recebida" desc="Sempre que receber uma mensagem no chat da escala" checked={p.myScales.chat} onChange={(v) => updateGroup("myScales", "chat", v)} />
        </Group>

        <Group title="Lembrete de escala" enabled={p.reminder.on && p.all} onToggle={(v) => updateGroup("reminder", "on", v)}>
          <Item label="2 horas antes" desc="Você receberá uma notificação duas horas antes do início da sua escala" checked={p.reminder.h2} onChange={(v) => updateGroup("reminder", "h2", v)} />
          <Item label="1 dia antes" desc="Você receberá uma notificação um dia antes do início da sua escala" checked={p.reminder.d1} onChange={(v) => updateGroup("reminder", "d1", v)} />
          <Item label="5 dias antes" desc="Você receberá uma notificação cinco dias antes do início da sua escala" checked={p.reminder.d5} onChange={(v) => updateGroup("reminder", "d5", v)} />
        </Group>

        <Group title="Escalas gerais" enabled={p.generalScales.on && p.all} onToggle={(v) => updateGroup("generalScales", "on", v)}>
          <Item label="Cadastro" desc="Sempre que uma escala for cadastrada" checked={p.generalScales.created} onChange={(v) => updateGroup("generalScales", "created", v)} />
          <Item label="Edição" desc="Sempre que uma escala for alterada" checked={p.generalScales.edited} onChange={(v) => updateGroup("generalScales", "edited", v)} />
          <Item label="Exclusão" desc="Sempre que uma escala for removida" checked={p.generalScales.deleted} onChange={(v) => updateGroup("generalScales", "deleted", v)} />
        </Group>

        <Group title="Mensagens" enabled={p.messages.on && p.all} onToggle={(v) => updateGroup("messages", "on", v)}>
          <Item label="Mensagem recebida" desc="Sempre que receber uma mensagem no chat do ministério" checked={p.messages.received} onChange={(v) => updateGroup("messages", "received", v)} />
        </Group>

        <Group title="Indisponibilidades gerais" enabled={p.generalUnav.on && p.all} onToggle={(v) => updateGroup("generalUnav", "on", v)}>
          <Item label="Cadastro" desc="Sempre que uma indisponibilidade for cadastrada" checked={p.generalUnav.created} onChange={(v) => updateGroup("generalUnav", "created", v)} />
          <Item label="Edição" desc="Sempre que uma indisponibilidade for alterada" checked={p.generalUnav.edited} onChange={(v) => updateGroup("generalUnav", "edited", v)} />
          <Item label="Exclusão" desc="Sempre que uma indisponibilidade for removida" checked={p.generalUnav.deleted} onChange={(v) => updateGroup("generalUnav", "deleted", v)} />
        </Group>

        <Group title="Avisos" enabled={p.announcements.on && p.all} onToggle={(v) => updateGroup("announcements", "on", v)}>
          <Item label="Cadastro" desc="Sempre que um novo aviso for adicionado" checked={p.announcements.created} onChange={(v) => updateGroup("announcements", "created", v)} />
          <Item label="Edição" desc="Sempre que um aviso for alterado" checked={p.announcements.edited} onChange={(v) => updateGroup("announcements", "edited", v)} />
          <Item label="Mensagens" desc="Sempre que receber mensagens em um aviso" checked={p.announcements.messages} onChange={(v) => updateGroup("announcements", "messages", v)} />
        </Group>
      </div>

      <div className="fixed bottom-4 right-4">
        <Button onClick={onSave} className="shadow-lg">
          <Check className="h-4 w-4 mr-2" /> Salvar
        </Button>
      </div>
    </div>
  );
}