import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, Moon, Monitor, Check, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme, PRESET_COLORS } from "@/contexts/ThemeContext";
import { storage } from "@/lib/storage";
import { toast } from "sonner";

const DYN_KEY = "dynamic_color";

export default function SettingsAppearance() {
  const navigate = useNavigate();
  const { mode, setMode, color, setColor, reset } = useTheme();
  const [dynamic, setDynamic] = useState<boolean>(() => storage.get<boolean>(DYN_KEY, true));
  const [themeOpen, setThemeOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const onDyn = (v: boolean) => {
    setDynamic(v);
    storage.set(DYN_KEY, v);
  };

  const onReset = () => {
    reset();
    setDynamic(true);
    storage.set(DYN_KEY, true);
    setResetOpen(false);
    toast.success("Padrões restaurados");
  };

  const modeLabel = mode === "light" ? "Claro" : mode === "dark" ? "Escuro" : "Padrão do sistema";

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/configuracoes")} className="p-2 -ml-2 rounded-full hover:bg-muted/40">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">Aparência</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60 mb-4">
        <button onClick={() => setThemeOpen(true)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40">
          <div className="text-sm font-medium">Tema</div>
          <div className="text-xs text-muted-foreground">{modeLabel}</div>
        </button>
        <button onClick={() => setColorOpen(true)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40">
          <div className="text-sm font-medium">Cor principal</div>
          <span className="h-5 w-10 rounded-full" style={{ backgroundColor: color }} />
        </button>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-sm font-medium">Cor de fundo dinâmica</div>
            <p className="text-xs text-muted-foreground mt-0.5">Aplica nuances da cor principal nos fundos</p>
          </div>
          <Switch checked={dynamic} onCheckedChange={onDyn} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <button onClick={() => setResetOpen(true)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-medium">Restaurar padrão</div>
        </button>
      </div>

      {/* Theme picker dialog */}
      <Dialog open={themeOpen} onOpenChange={setThemeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Tema</DialogTitle></DialogHeader>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60">
            {[
              { v: "system", label: "Padrão do sistema", icon: Monitor },
              { v: "light", label: "Claro", icon: Sun },
              { v: "dark", label: "Escuro", icon: Moon },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => { setMode(opt.v as "light" | "dark" | "system"); setThemeOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <opt.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                {mode === opt.v && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Color picker dialog */}
      <Dialog open={colorOpen} onOpenChange={setColorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cor principal</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Predefinidas</div>
              <div className="grid grid-cols-6 gap-3">
                {PRESET_COLORS.map((c) => {
                  const active = c.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      aria-label={`Cor ${c}`}
                      className="flex items-center justify-center"
                    >
                      <span
                        className={`block rounded-full transition-all ${active ? "h-9 w-9 ring-2 ring-offset-2 ring-offset-background ring-foreground/40" : "h-7 w-7"}`}
                        style={{ backgroundColor: c }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personalizada</div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-11 w-14 rounded-lg cursor-pointer bg-transparent border border-border"
                />
                <Input
                  value={color}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v);
                  }}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar padrões</AlertDialogTitle>
            <AlertDialogDescription>Tema, cor e cor dinâmica serão restaurados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onReset}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}