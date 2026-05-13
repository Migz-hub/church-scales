import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useMinistry } from "@/contexts/MinistryContext";
import { chatService } from "@/services/chatService";
import type { ChatMessage } from "@/types";
import { toast } from "sonner";

const MAX = 1000;

export default function Chat() {
  const { user } = useAuth();
  const { active } = useMinistry();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    chatService.list(active.id).then((m) => {
      setMessages(m);
      setLoading(false);
    });
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = async () => {
    if (!user || !active) return;
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      const msg = await chatService.send({
        ministryId: active.id,
        user: { id: user.id, name: user.name },
        content,
      });
      setMessages((prev) => [...prev, msg]);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSending(false);
    }
  };

  if (!active) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] lg:h-[calc(100vh-6rem)]">
      <PageHeader title="Chat" description={`Conversa do ministério ${active.name}`} />

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-card">
        {loading ? (
          <LoadingState />
        ) : messages.length === 0 ? (
          <EmptyState title="Sem mensagens ainda" description="Seja o primeiro a falar algo." />
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = m.userId === user?.id;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {!mine && <div className="text-xs font-medium opacity-80 mb-0.5">{m.user.name}</div>}
                    <div className="whitespace-pre-wrap text-sm break-words">{m.content}</div>
                    <div className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={2}
          placeholder="Escreva uma mensagem… (Enter para enviar)"
          className="resize-none"
        />
        <Button onClick={onSend} disabled={sending || !text.trim()} size="icon" className="h-12 w-12 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-xs text-muted-foreground mt-1 text-right">{text.length}/{MAX}</div>
    </div>
  );
}