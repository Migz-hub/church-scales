import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { authService } from "@/services/authService";
import { ministryAdminService, PERMISSION_LABELS } from "@/services/ministryAdminService";
import { roleLabel } from "@/lib/permissions";
import type { MinistryFunction, PermissionKey } from "@/types";
import { toast } from "sonner";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { active, membership, role } = useMinistry();

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [functions, setFunctions] = useState<MinistryFunction[]>([]);
  const [memberFnIds, setMemberFnIds] = useState<string[]>([]);
  const [permKeys, setPermKeys] = useState<PermissionKey[]>([]);

  useEffect(() => {
    if (!active || !membership) return;
    (async () => {
      const [fns, cfg, defs] = await Promise.all([
        ministryAdminService.listFunctions(active.id),
        ministryAdminService.getMemberConfig(active.id, membership.id),
        ministryAdminService.getDefaults(active.id),
      ]);
      setFunctions(fns);
      setMemberFnIds(cfg.functionIds);
      const merged: PermissionKey[] = [];
      (Object.keys(defs.permissions) as PermissionKey[]).forEach((k) => {
        const v = cfg.overrides[k] ?? defs.permissions[k];
        if (v) merged.push(k);
      });
      setPermKeys(merged);
    })();
  }, [active, membership]);

  if (!user) return null;

  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const memberFns = functions.filter((f) => memberFnIds.includes(f.id));

  const onSaveProfile = async () => {
    setSaving(true);
    try {
      await authService.updateProfile(user.id, { name, email });
      toast.success("Perfil atualizado");
      setEditOpen(false);
      setTimeout(() => window.location.reload(), 200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const onChangePw = async () => {
    setSaving(true);
    try {
      await authService.changePassword(user.id, curPw, newPw);
      toast.success("Senha alterada");
      setPwOpen(false);
      setCurPw("");
      setNewPw("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    try {
      await authService.deleteAccount(user.id);
      await signOut();
      navigate("/login");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div>
      <PageHeader title="Meu perfil" />

      {/* Hero */}
      <div className="relative -mx-4 sm:-mx-6 lg:-mx-10 mb-8 bg-primary/15">
        <div className="px-4 sm:px-6 lg:px-10 py-8 flex flex-col items-center text-center">
          <button
            onClick={() => setEditOpen(true)}
            aria-label="Editar perfil"
            className="absolute top-3 right-4 p-2 rounded-full hover:bg-foreground/10"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <div className="h-20 w-20 rounded-full bg-primary/30 text-primary-foreground flex items-center justify-center text-2xl font-bold mb-3">
            {initials}
          </div>
          <div className="text-lg font-semibold">{user.name}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
      </div>

      <div className="space-y-3 max-w-2xl mx-auto">
        {role && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-card flex items-center justify-between">
            <div>
              <div className="font-medium">Permissões</div>
              <div className="text-xs text-muted-foreground">{active?.name} · {roleLabel[role]}</div>
            </div>
            <div className="text-2xl font-semibold">{permKeys.length}</div>
          </div>
        )}

        {permKeys.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="font-medium mb-2">Permissões ativas</div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
              {permKeys.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary" /> {PERMISSION_LABELS[k]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="font-medium mb-3">Funções ( {memberFns.length} )</div>
          {memberFns.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma função atribuída.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {memberFns.map((f) => (
                <div key={f.id} className="flex flex-col items-center gap-1 w-20">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-xl">
                    {f.icon ?? "🎵"}
                  </div>
                  <div className="text-xs text-center truncate w-full">{f.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setPwOpen(true)}
          className="w-full rounded-xl border border-border bg-card p-4 shadow-card text-left hover:bg-muted/40"
        >
          <div className="font-medium">Alterar senha</div>
        </button>

        <button
          onClick={() => setDelOpen(true)}
          className="w-full rounded-xl border border-destructive/40 bg-card p-4 shadow-card text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="font-medium">Excluir minha conta</span>
        </button>
      </div>

      {/* Edit profile */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>Atualize suas informações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            <Button onClick={onSaveProfile} disabled={saving || !name.trim() || !email.trim()}>
              <Check className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change password */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar senha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Senha atual</Label>
              <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
            </div>
            <div>
              <Label>Nova senha</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancelar</Button>
            <Button onClick={onChangePw} disabled={saving || !curPw || newPw.length < 6}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Todos os seus dados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}