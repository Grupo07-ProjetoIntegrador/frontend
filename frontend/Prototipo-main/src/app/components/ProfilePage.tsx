import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";

interface ProfileData {
  user_id: string;
  display_name: string;
  email: string;
}

export function ProfilePage() {
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<"connected" | "disconnected" | "unknown">("unknown");
  const [displayName, setDisplayName] = useState("");
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const connectUrl = useMemo(() => {
    if (!profile) return "";
    return `http://localhost:8080/api/oauth/google/start?user_id=${profile.user_id}`;
  }, [profile]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async (user: { id: string; email?: string | null; user_metadata?: any } | null) => {
      if (!isMounted) return;
      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !profileData) {
        if (error && error.status === 403) {
          toast.error("Acesso negado ao perfil. Verifique as politicas RLS no Supabase.");
        }
        const fallbackName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Usuario";

        const { data: createdProfile, error: createError } = await supabase
          .from("profiles")
          .upsert({
            user_id: user.id,
            display_name: fallbackName,
            email: user.email,
          })
          .select("user_id, display_name, email")
          .maybeSingle();

        if (createError) {
          if (createError.status === 403) {
            toast.error("Acesso negado ao perfil. Verifique as politicas RLS no Supabase.");
          }
          console.error(createError);
          toast.error("Nao foi possivel carregar o perfil.");
          setIsLoading(false);
          return;
        }

        setProfile(createdProfile as ProfileData);
        setDisplayName(createdProfile?.display_name || fallbackName);
      } else {
        setProfile(profileData as ProfileData);
        setDisplayName(profileData?.display_name || "");
      }

      try {
        const response = await fetch(`http://localhost:8080/api/oauth/google/status?user_id=${user.id}`);
        if (response.ok) {
          const payload = await response.json();
          setOauthStatus(payload.connected ? "connected" : "disconnected");
        } else {
          setOauthStatus("disconnected");
        }
      } catch (err) {
        console.error(err);
        setOauthStatus("unknown");
      }

      setIsLoading(false);
    };

    const init = async () => {
      setIsLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const refreshed = await supabase.auth.refreshSession();
        await loadProfile(refreshed.data.session?.user || null);
        return;
      }
      await loadProfile(data.session?.user || null);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user || null);
    });

    init();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("google") === "connected") {
      toast.success("Conta Google conectada.");
    }
    if (searchParams.get("google") === "missing_scope") {
      toast.error("A conta Google voltou sem o escopo gmail.send. Desconecte e reconecte para autorizar o envio de e-mail.");
    }
    if (searchParams.get("google") === "error") {
      toast.error("Nao foi possivel conectar a conta Google.");
    }
  }, [searchParams]);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", profile.user_id);

    if (error) {
      console.error(error);
      toast.error("Erro ao salvar nome.");
      setIsSaving(false);
      return;
    }

    setProfile({ ...profile, display_name: displayName });
    toast.success("Nome atualizado.");
    setIsSaving(false);
  };

  const handleDisconnectGoogle = async () => {
    if (!profile) return;

    setIsDisconnecting(true);

    try {
      const response = await fetch(`http://localhost:8080/api/oauth/google/disconnect?user_id=${profile.user_id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao desconectar Google");
      }

      setOauthStatus("disconnected");
      toast.success("Conta Google desconectada e acesso revogado.");
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel desconectar a conta Google.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReconnectGoogle = async () => {
    if (!profile || !connectUrl) return;

    setIsDisconnecting(true);

    try {
      const response = await fetch(`http://localhost:8080/api/oauth/google/disconnect?user_id=${profile.user_id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao desconectar Google");
      }

      toast.success("Conta Google desconectada. Abrindo novo consentimento...");
      window.location.href = connectUrl;
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel reiniciar o consentimento do Google.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#F7F4EF" }}>
        <span className="text-sm text-gray-500">Carregando perfil...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#F7F4EF" }}>
        <a href="/auth" className="text-sm text-[#8B1A1A] hover:underline">
          Voce precisa estar logado para ver o perfil. Ir para login.
        </a>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 md:p-8" style={{ backgroundColor: "#F7F4EF" }}>
      <div className="w-full max-w-none space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Perfil</h1>
            <p className="text-sm text-gray-500">Gerencie seus dados e a conexao com o Google.</p>
          </div>
          <div className="text-xs text-gray-500">
            ID do usuario: <span className="font-medium text-gray-700">{profile.user_id.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-6">
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Nome</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">E-mail</label>
                <input
                  value={profile.email}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#D93030] hover:bg-[#C11C1C] transition-colors disabled:opacity-60"
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Google Connect</h2>
                <p className="text-sm text-gray-500">Autorize sua conta para criar formularios.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span
                  className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                    oauthStatus === "connected"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {oauthStatus === "connected" ? "Conectado" : "Desconectado"}
                </span>
                <a
                  href={connectUrl}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#8B1A1A] hover:bg-[#7A1414] transition-colors"
                >
                  Conectar Google
                </a>
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={isDisconnecting || oauthStatus !== "connected"}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDisconnecting ? "Desconectando..." : "Desconectar Google"}
                </button>
                <button
                  onClick={handleReconnectGoogle}
                  disabled={isDisconnecting || oauthStatus !== "connected"}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[#8B1A1A] text-[#8B1A1A] bg-white hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDisconnecting ? "Reiniciando..." : "Desconectar e reconectar"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Atalhos rapidos</h3>
              <div className="flex flex-col gap-2 text-sm text-gray-600">
                <a href="/treinamentos" className="hover:text-[#8B1A1A]">
                  Ver treinamentos
                </a>
                <a href="/treinamentos" className="hover:text-[#8B1A1A]">
                  Abrir calendario
                </a>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#8B1A1A] to-[#D93030] text-white rounded-2xl shadow-sm p-6 space-y-2">
              <p className="text-sm uppercase tracking-wide text-white/70">Status do acesso</p>
              <p className="text-2xl font-semibold">{oauthStatus === "connected" ? "Google OK" : "Google nao conectado"}</p>
              <p className="text-xs text-white/80">
                Conecte sua conta para gerar formularios com o seu proprio Google.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
