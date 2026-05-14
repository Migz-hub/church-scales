import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { ministryService } from "@/services/ministryService";
import { notificationService } from "@/services/notificationService";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Info, Loader2, Send, Ticket } from "lucide-react";
import { FullscreenPage } from "@/components/FullscreenPage";

const schema = z.object({ code: z.string().trim().min(4, "Código inválido").max(12) });

export default function MinistryJoin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(true);

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const res = await ministryService.requestJoin({
        code: values.code,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
      });
      await Promise.all(res.notify.map((n) => notificationService.create(n)));
      toast.success(`Solicitação enviada para "${res.ministry.name}"`);
      navigate("/ministerios/entrada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao solicitar entrada");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FullscreenPage backTo="/ministerios/entrada" className="max-w-xl">
      <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Ingressar em um ministério</h1>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <div>
            <h2 className="font-semibold">Informe o código do convite</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Digite o código compartilhado pelo administrador do ministério.
            </p>
          </div>
          <div className="relative">
            <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Código do convite"
              className="pl-9 uppercase tracking-widest font-mono"
              autoComplete="off"
              {...register("code")}
            />
          </div>
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Solicitar entrada
          </Button>
        </form>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setStepsOpen((v) => !v)}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <Info className="h-4 w-4 text-primary" />
            <span className="flex-1 font-medium">Passo a passo</span>
            {stepsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {stepsOpen && (
            <ol className="px-4 pb-4 space-y-3">
              <Step n={1} title="Receba um convite" desc="Peça ao administrador do ministério o código de convite gerado para entrada." />
              <Step n={2} title="Envie sua solicitação" desc="Digite o código nesta tela para registrar seu pedido de participação." />
              <Step n={3} title="Aguarde a aprovação" desc="Após o envio, um administrador do grupo precisará aprovar sua entrada no ministério." />
            </ol>
          )}
        </div>
      </div>
    </FullscreenPage>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
        {n}
      </span>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </li>
  );
}
