import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/types";

function mapUser(authUser: { id: string; email?: string | null; created_at?: string }, name: string): User {
  return {
    id: authUser.id,
    name: name || (authUser.email ?? "").split("@")[0],
    email: authUser.email ?? "",
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

async function fetchProfile(userId: string): Promise<{ name: string; email: string } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export const authService = {
  async signUp(input: { name: string; email: string; password: string }): Promise<User> {
    const redirectTo = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        emailRedirectTo: redirectTo,
        data: { name: input.name.trim() },
      },
    });
    if (error) throw new Error(translate(error.message));
    if (!data.user) throw new Error("Não foi possível criar a conta.");
    
    // Ensure profile name is set (trigger uses metadata, but be defensive)
    await supabase
      .from("profiles")
      .update({ name: input.name.trim() })
      .eq("id", data.user.id);
    return mapUser(data.user, input.name.trim());
  },

  async signIn(input: { email: string; password: string }): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    if (error) throw new Error(translate(error.message));
    if (!data.user) throw new Error("Falha ao entrar.");
    const profile = await fetchProfile(data.user.id);
    return mapUser(data.user, profile?.name ?? "");
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  async restore(): Promise<User | null> {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    const profile = await fetchProfile(u.id);
    return mapUser(u, profile?.name ?? "");
  },

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) throw new Error(translate(error.message));
  },

  async updateProfile(userId: string, patch: { name?: string; email?: string }): Promise<User> {
    if (patch.email) {
      const { error } = await supabase.auth.updateUser({ email: patch.email.trim().toLowerCase() });
      if (error) throw new Error(translate(error.message));
    }
    const updates: { name?: string; email?: string } = {};
    if (patch.name !== undefined) updates.name = patch.name.trim();
    if (patch.email !== undefined) updates.email = patch.email.trim().toLowerCase();
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw new Error(error.message);
    }
    const profile = await fetchProfile(userId);
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Sessão expirada.");
    return mapUser(data.user, profile?.name ?? "");
  },

  async changePassword(_userId: string, current: string, next: string): Promise<void> {
    // Verify the current password before allowing the change. This protects
    // against an attacker with a hijacked session token taking over the account
    // by silently rotating the password.
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) throw new Error("Sessão expirada.");
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (verifyError) throw new Error("Senha atual incorreta.");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw new Error(translate(error.message));
  },

  async updatePasswordAfterRecovery(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(translate(error.message));
  },

  async deleteAccount(_userId: string): Promise<void> {
    // Self-deletion of an auth user requires the service role. For now, sign out
    // and instruct the user to contact support. This avoids exposing service keys
    // to the browser.
    await supabase.auth.signOut();
    throw new Error(
      "Para excluir sua conta, entre em contato com o suporte. Você foi desconectado.",
    );
  },
};

function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email ou senha inválidos.";
  if (m.includes("user already registered")) return "Já existe uma conta com esse email.";
  if (m.includes("email not confirmed")) return "Confirme seu email antes de entrar.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  return msg;
}
