import { useEffect, useState } from "react";
import { Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { ministryService } from "@/services/ministryService";
import { roleLabel } from "@/lib/permissions";
import type { MinistryMember, Role } from "@/types";
import { toast } from "sonner";

export default function Members() {
  const { user } = useAuth();
  const { active, can, role } = useMinistry();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MinistryMember[]>([]);

  const load = () => {
    if (!active) return;
    setLoading(true);
    ministryService.listMembers(active.id).then((m) => {
      setMembers(m);
      setLoading(false);
    });
  };

  useEffect(load, [active]);

  const onRemove = async (m: MinistryMember) => {
    if (!active) return;
    if (!confirm(`Remover ${m.user.name} do ministério?`)) return;
    try {
      await ministryService.removeMember(active.id, m.id);
      toast.success("Membro removido");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const onChangeRole = async (m: MinistryMember, newRole: Role) => {
    if (!active) return;
    try {
      await ministryService.setMemberRole(active.id, m.id, newRole);
      toast.success("Papel atualizado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  if (!active) return null;

  return (
    <div>
      <PageHeader
        title="Membros"
        description={`Membros de ${active.name}. Convide novos pelo código em Configurações.`}
      />

      {loading ? (
        <LoadingState />
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum membro ainda" />
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const isOwner = m.role === "owner";
            const isMe = m.userId === user?.id;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                    {m.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {m.user.name} {isMe && <span className="text-xs text-muted-foreground">(você)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {can("ministry.settings") && !isOwner ? (
                    <Select value={m.role} onValueChange={(v) => onChangeRole(m, v as Role)}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="leader">Líder</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">{roleLabel[m.role]}</span>
                  )}
                  {can("member.remove") && !isOwner && !isMe && (
                    <Button variant="ghost" size="icon" onClick={() => onRemove(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {role && !can("ministry.settings") && (
        <p className="text-xs text-muted-foreground mt-4">
          Você está como <strong>{roleLabel[role]}</strong>. Apenas dono e administradores podem alterar papéis.
        </p>
      )}
    </div>
  );
}