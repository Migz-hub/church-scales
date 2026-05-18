import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { ministryService } from "@/services/ministryService";
import { toast } from "sonner";
import { Check, GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FullscreenPage } from "@/components/FullscreenPage";

interface FunctionItem {
  id: string;
  name: string;
  icon?: string;
}

interface Template {
  id: string;
  name: string;
  emoji: string;
  description: string;
  functions: { name: string; icon: string }[];
}

const TEMPLATES: Template[] = [
  {
    id: "louvor",
    name: "Louvor",
    emoji: "🎵",
    description: "Ministérios de música em geral, bandas e equipes de louvor.",
    functions: [
      { name: "Ministro", icon: "🎤" },
      { name: "Vocalista", icon: "🎙️" },
      { name: "Backing vocal", icon: "🎙️" },
      { name: "Violão", icon: "🎸" },
      { name: "Guitarra", icon: "🎸" },
      { name: "Baixo", icon: "🎸" },
      { name: "Teclado", icon: "🎹" },
      { name: "Bateria", icon: "🥁" },
      { name: "Som", icon: "🎚️" },
      { name: "Projeção", icon: "📽️" },
      { name: "Iluminação", icon: "💡" },
    ],
  },
  {
    id: "midia",
    name: "Mídia",
    emoji: "🎥",
    description: "Equipes de comunicação, foto, vídeo e transmissão.",
    functions: [
      { name: "Câmera", icon: "📷" },
      { name: "Foto", icon: "📸" },
      { name: "Edição", icon: "✂️" },
      { name: "Streaming", icon: "📡" },
      { name: "Projeção", icon: "📽️" },
      { name: "Redes sociais", icon: "📱" },
    ],
  },
  {
    id: "infantil",
    name: "Infantil",
    emoji: "🧒",
    description: "Ministério kids, professores e voluntários.",
    functions: [
      { name: "Professor", icon: "👨‍🏫" },
      { name: "Auxiliar", icon: "🤝" },
      { name: "Recreação", icon: "🎲" },
      { name: "Lanche", icon: "🍪" },
    ],
  },
  {
    id: "recepcao",
    name: "Recepção",
    emoji: "🤝",
    description: "Acolhida, recepção e apoio aos visitantes.",
    functions: [
      { name: "Recepcionista", icon: "👋" },
      { name: "Acolhida", icon: "💞" },
      { name: "Apoio", icon: "🛟" },
    ],
  },
  {
    id: "personalizado",
    name: "Personalizado",
    emoji: "✨",
    description: "Comece do zero e adicione suas próprias funções.",
    functions: [],
  },
];

let counter = 0;
const newId = () => `tmp_${++counter}_${Date.now()}`;

export default function MinistryCreate() {
  const { user } = useAuth();
  const { refresh, setActive } = useMinistry();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>("louvor");
  const [functions, setFunctions] = useState<FunctionItem[]>(
    TEMPLATES[0].functions.map((f) => ({ id: newId(), ...f })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<FunctionItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const template = useMemo(() => TEMPLATES.find((t) => t.id === templateId)!, [templateId]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = TEMPLATES.find((x) => x.id === id)!;
    setFunctions(t.functions.map((f) => ({ id: newId(), ...f })));
    setPickerOpen(false);
  };

  const removeFn = (id: string) => setFunctions((arr) => arr.filter((f) => f.id !== id));
  const upsertFn = (item: FunctionItem) => {
    setFunctions((arr) => {
      const exists = arr.find((f) => f.id === item.id);
      if (exists) return arr.map((f) => (f.id === item.id ? item : f));
      return [...arr, item];
    });
  };

  const onSubmit = async () => {
    if (!user) return;
    if (name.trim().length < 2) {
      toast.error("Informe o nome do ministério");
      return;
    }
    setSubmitting(true);
    try {
      const m = await ministryService.create({
        name: name.trim(),
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        functions: functions.map((f) => ({ name: f.name, icon: f.icon })),
      });
      await refresh();
      await setActive(m.id);
      toast.success(`Ministério "${m.name}" criado com sucesso`);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FullscreenPage backTo="/ministerios/entrada" className="max-w-2xl">
      <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Novo ministério</h1>
        <Input
          placeholder="Nome do ministério *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-xl"
        />

        <section>
          <div className="px-1 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Modelo de ministério
          </div>
          <p className="px-1 text-sm text-muted-foreground mb-3">
            Selecione uma configuração inicial para o ministério
          </p>
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:bg-muted/40 transition"
          >
            <span className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xl">
              {template.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{template.name}</div>
              <div className="text-xs text-muted-foreground truncate">{template.description}</div>
            </div>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
        </section>

        <section>
          <div className="px-1 mb-1 text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
            Funções
            <span className="text-muted-foreground/70 normal-case font-normal">{functions.length}</span>
          </div>
          <p className="px-1 text-sm text-muted-foreground mb-3">
            Defina os papéis que membros poderão assumir neste ministério
          </p>

          <Button
            variant="secondary"
            className="w-full h-11 rounded-xl"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-4 w-4 mr-2" /> Adicionar função
          </Button>

          <ul className="mt-3 rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
            {functions.length === 0 && (
              <li className="px-4 py-6 text-sm text-muted-foreground text-center">
                Nenhuma função adicionada.
              </li>
            )}
            {functions.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                <span className="text-xl w-7 text-center">{f.icon ?? "🔹"}</span>
                <span className="flex-1 truncate font-medium">{f.name}</span>
                <Button size="icon" variant="ghost" onClick={() => setEditing(f)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => removeFn(f.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          Concluir
        </Button>
        <Button onClick={onSubmit} disabled={submitting} className="min-w-[140px]">
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Criar ministério
        </Button>
      </div>

      {/* Template picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modelo de ministério</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => applyTemplate(t.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition",
                    t.id === templateId
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-card hover:bg-muted/40",
                  )}
                >
                  <span className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xl">
                    {t.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                  </div>
                  {t.id === templateId && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Add / Edit function */}
      <FunctionDialog
        open={adding || !!editing}
        item={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSave={(item) => {
          upsertFn(item);
          setAdding(false);
          setEditing(null);
        }}
      />
      </div>
    </FullscreenPage>
  );
}

function FunctionDialog({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: FunctionItem | null;
  onClose: () => void;
  onSave: (i: FunctionItem) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "🔹");

  // reset on open
  useMemo(() => {
    if (open) {
      setName(item?.name ?? "");
      setIcon(item?.icon ?? "🔹");
    }
  }, [open, item]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{item ? "Editar função" : "Nova função"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Ícone (emoji)</label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Vocalista" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              if (name.trim().length < 1) return;
              onSave({ id: item?.id ?? `tmp_${Date.now()}`, name: name.trim(), icon });
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
