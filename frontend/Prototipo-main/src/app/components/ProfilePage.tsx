import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";
import { 
  User, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Link2, 
  Unlink, 
  RefreshCw, 
  Calendar, 
  GraduationCap, 
  ShieldCheck,
  IdCard
} from "lucide-react";

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
          toast.error("Acesso negado ao perfil. Verifique as políticas RLS no Supabase.");
        }
        const fallbackName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Usuário";

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
            toast.error("Acesso negado ao perfil. Verifique as políticas RLS no Supabase.");
          }
          console.error(createError);
          toast.error("Não foi possível carregar o perfil.");
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
      toast.success("Conta Google conectada com sucesso.");
    }
    if (searchParams.get("google") === "missing_scope") {
      toast.error("A conta Google voltou sem o escopo gmail.send. Desconecte e reconecte para autorizar o envio de e-mail.");
    }
    if (searchParams.get("google") === "error") {
      toast.error("Não foi possível conectar a conta Google.");
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
    toast.success("Nome de perfil atualizado com sucesso.");
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
      toast.error("Não foi possível desconectar a conta Google.");
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

      toast.success("Conta antiga desconectada. Abrindo novo consentimento...");
      window.location.href = connectUrl;
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível reiniciar o consentimento do Google.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]" style={{ backgroundColor: "#F7F4EF" }}>
        <div className="w-8 h-8 border-4 border-[#8B1A1A] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-medium text-gray-600 tracking-wide">Carregando credenciais corporativas...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]" style={{ backgroundColor: "#F7F4EF" }}>
        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm text-center max-w-md">
          <XCircle className="w-12 h-12 text-[#8B1A1A] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Acesso Restrito</h3>
          <p className="text-sm text-gray-500 mb-6">Você precisa estar autenticado no ecossistema interno para gerenciar este perfil.</p>
          <a href="/auth" className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-[#8B1A1A] hover:bg-[#7A1414] transition-all shadow-sm">
            Ir para o Login Corporativo
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 md:p-10" style={{ backgroundColor: "#F7F4EF" }}>
      <div className="w-full max-w-7xl mx-auto space-y-8">
        
        {/* Banner do Topo - Identidade Flamboyant */}
        <div className="relative overflow-hidden bg-[#8B1A1A] border-b-4 border-[#8B1A1A] rounded-2xl shadow-md px-6 py-8 md:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-20 -translate-y-20 pointer-events-none" />
          
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 backdrop-blur-sm shadow-inner">
              <User className="w-8 h-8 text-[#C8A882]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#C8A882] uppercase tracking-widest">Painel de Controle Interno</p>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-1">Configurações de Perfil</h1>
              <p className="text-sm text-white/80 mt-1">Gerencie suas chaves de integração e informações de identificação corporativa.</p>
            </div>
          </div>
          
          <div className="bg-black/10 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm self-start sm:self-auto flex items-center gap-2.5">
            <IdCard className="w-4 h-4 text-[#C8A882]" />
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Identificador ID</p>
              <p className="text-xs font-mono font-bold text-white">{profile.user_id.slice(0, 12)}...</p>
            </div>
          </div>
        </div>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-[2.4fr_1fr] gap-8">
          
          {/* Coluna da Esquerda: Formulários */}
          <div className="space-y-8">
            
            {/* Bloco 1: Dados Pessoais */}
            <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-base font-bold text-gray-900 tracking-tight">Dados de Identificação</h2>
                <p className="text-xs text-gray-500 mt-0.5">Estes dados serão embutidos nos relatórios e atas oficiais geradas.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" /> Nome Completo
                  </label>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/20 focus:border-[#8B1A1A] transition-all"
                    placeholder="Ex: Gabriel Alves Martins"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" /> Endereço de E-mail
                  </label>
                  <input
                    value={profile.email}
                    readOnly
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-100/70 text-gray-500 font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl text-white bg-[#8B1A1A] hover:bg-[#7A1414] transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando alterações...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>
            </div>

            {/* Bloco 2: Integração Google Connect */}
            <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
              <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900 tracking-tight">Google Connect API</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Necessário para disparar e-mails automatizados e criar formulários integrados.</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status:</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full ${
                    oauthStatus === "connected"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : "bg-amber-50 text-amber-700 border border-amber-200/60"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${oauthStatus === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {oauthStatus === "connected" ? "Canal Ativo" : "Desconectado"}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 p-4 rounded-xl">
                Esta conexão permite que o robô do <strong>Módulo de Treinamento</strong> acesse de forma segura as permissões essenciais para criação de formulários de chamadas e controle de ausência em nome da administração do shopping.
              </p>

              {/* Botões de Ação Reprojetados */}
              <div className="flex flex-wrap gap-3 pt-2">
                {oauthStatus !== "connected" ? (
                  <a
                    href={connectUrl}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl text-white bg-gray-900 hover:bg-black transition-all shadow-sm active:scale-[0.98]"
                  >
                    <Link2 className="w-4 h-4 text-[#C8A882]" />
                    Conectar Conta Google
                  </a>
                ) : (
                  <>
                    <button
                      onClick={handleDisconnectGoogle}
                      disabled={isDisconnecting}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <Unlink className="w-4 h-4 text-gray-400" />
                      {isDisconnecting ? "Revogando acesso..." : "Desconectar Integração"}
                    </button>
                    
                    <button
                      onClick={handleReconnectGoogle}
                      disabled={isDisconnecting}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border border-[#8B1A1A] text-[#8B1A1A] bg-white hover:bg-red-50/50 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {isDisconnecting ? "Reiniciando..." : "Desconectar e Reconectar"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Widgets de Status e Atalhos */}
          <div className="space-y-6">
            
            {/* Widget Informativo Premium */}
            <div className="bg-gradient-to-br from-[#8B1A1A] to-[#601010] text-white rounded-2xl shadow-md p-6 relative overflow-hidden border-b-4 border-[#C8A882]">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
              <ShieldCheck className="w-8 h-8 text-[#C8A882] mb-4" />
              
              <p className="text-xs uppercase tracking-widest text-white/60 font-bold">Status de Envio API</p>
              <p className="text-2xl font-bold mt-1 tracking-tight">
                {oauthStatus === "connected" ? "Google Autenticado" : "Ação Requerida"}
              </p>
              <p className="text-xs text-white/80 mt-2 leading-relaxed">
                {oauthStatus === "connected" 
                  ? "Seu token está ativo e pronto para disparar dossiês e convocações para as lojas franqueadas."
                  : "Por favor, clique em 'Conectar Conta Google' ao lado para habilitar as automações de e-mails de treinamento."
                }
              </p>
            </div>

            {/* Links Rápidos Corporativos */}
            <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-6 space-y-4">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#C8A882]" /> Atalhos de Gestão
              </h3>
              
              <nav className="flex flex-col gap-2">
                <a 
                  href="/treinamentos" 
                  className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-[#8B1A1A] font-medium p-2 rounded-lg hover:bg-gray-50 transition-all group"
                >
                  <GraduationCap className="w-4 h-4 text-gray-400 group-hover:text-[#8B1A1A]" />
                  Painel de Treinamentos
                </a>
                
                <a 
                  href="/treinamentos" 
                  className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-[#8B1A1A] font-medium p-2 rounded-lg hover:bg-gray-50 transition-all group"
                >
                  <Calendar className="w-4 h-4 text-gray-400 group-hover:text-[#8B1A1A]" />
                  Cronograma & Calendário
                </a>
              </nav>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}