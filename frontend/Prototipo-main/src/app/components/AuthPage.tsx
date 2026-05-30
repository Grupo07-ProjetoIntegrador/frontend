import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowRight, CheckCircle2, Loader2, MailCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";

const PENDING_EMAIL_STORAGE_KEY = "flamboyant.auth.pending_email";
const LOCAL_TEST_STORAGE_KEY = "flamboyant.auth.test_mode";

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const isLocalHost = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isTestMode = searchParams.get("test") === "1";
  const [localTestActive, setLocalTestActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const fromQuery = isTestMode;
    const fromStorage = window.sessionStorage.getItem(LOCAL_TEST_STORAGE_KEY) === "1";
    return Boolean(fromQuery || fromStorage);
  });
  const [pendingEmail, setPendingEmail] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY);
  });
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const title = useMemo(() => (mode === "login" ? "Entrar" : "Criar conta"), [mode]);

  useEffect(() => {
    const initialMode = searchParams.get("mode");
    if (initialMode === "login" || initialMode === "register") {
      setMode(initialMode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("confirmed") !== "1") return;

    setMode("login");
    setPendingEmail(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
    }
    toast.success("E-mail confirmado. Faça login para continuar.");
    navigate("/auth?mode=login", { replace: true });
  }, [navigate, searchParams]);

  const persistPendingConfirmation = (email: string) => {
    if (typeof window === "undefined") return;

    window.sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, email);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      if (!form.email || !form.password || (mode === "register" && !form.name)) {
        toast.error("Preencha todos os campos obrigatorios.");
        return;
      }

      if (mode === "register") {
        const emailRedirectTo = `${window.location.origin}/auth?mode=login&confirmed=1`;
        const trimmedEmail = form.email.trim();
        const trimmedName = form.name.trim();
        persistPendingConfirmation(trimmedEmail);

        if (isTestMode && isLocalHost) {
          toast.info("Modo de teste ativado. Pulando envio real do e-mail.");
          setForm({ name: "", email: trimmedEmail, password: "" });
          window.location.replace(`/auth/confirmacao?email=${encodeURIComponent(trimmedEmail)}&test=1`);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: form.password,
          options: {
            emailRedirectTo,
            data: {
              display_name: trimmedName,
              full_name: trimmedName,
              name: trimmedName,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            user_id: data.user.id,
            display_name: trimmedName,
            email: trimmedEmail,
          });

          if (profileError) {
            console.error("Erro ao salvar perfil apos signup:", profileError);
            toast.warning("Conta criada, mas nao foi possivel salvar o perfil agora.");
          }
        }

        toast.success("Conta criada. Confirme o e-mail para continuar.");
        setForm({ name: "", email: trimmedEmail, password: "" });
        window.location.replace(`/auth/confirmacao?email=${encodeURIComponent(trimmedEmail)}`);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        toast.error("Conta ainda nao confirmada. Verifique seu e-mail.");
        return;
      }

      toast.success("Login realizado.");
      navigate("/treinamentos");
    } catch (err: any) {
      console.error(err);
      if (mode === "register") {
        const errorMessage = String(err?.message || "").toLowerCase();
        const isRateLimited = err?.status === 429 || errorMessage.includes("rate limit");

        if (isRateLimited) {
          toast.warning("Já existe um e-mail de confirmação recente. Abrindo a página de acompanhamento.");
          navigate(`/auth/confirmacao?email=${encodeURIComponent(form.email.trim())}&status=rate_limit`, { replace: true });
          return;
        }

        setPendingEmail(null);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
        }
      }
      toast.error(err?.message || "Erro ao autenticar.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: "name" | "email" | "password") => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6" style={{ backgroundColor: "#F7F4EF" }}>
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-[28px] border border-[#E6DCCF] bg-white p-8 shadow-[0_24px_80px_rgba(17,24,39,0.12)] space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F4EF] text-[#8B1A1A]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">
              {mode === "login"
                ? "Use suas credenciais para acessar a plataforma."
                : "Crie seu cadastro para iniciar."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Nome</label>
                <input
                  value={form.name}
                  onChange={updateField("name")}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="Seu nome"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">E-mail</label>
              <input
                value={form.email}
                onChange={updateField("email")}
                type="email"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="voce@exemplo.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Senha</label>
              <input
                value={form.password}
                onChange={updateField("password")}
                type="password"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="Sua senha"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#D93030] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#C11C1C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "register" ? "Enviando e-mail..." : "Entrando..."}
                </>
              ) : mode === "register" ? (
                "Criar conta"
              ) : (
                title
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setPendingEmail(null);
                if (typeof window !== "undefined") {
                  window.sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
                }
                setMode(mode === "login" ? "register" : "login");
              }}
              className="text-xs text-[#8B1A1A] hover:underline"
            >
              {mode === "login" ? "Ainda nao tem conta? Cadastre-se" : "Ja tem conta? Entrar"}
            </button>
          </div>
          {isLocalHost && mode === "register" && (
            <div>
              {!localTestActive ? (
                <button
                  onClick={() => {
                    try {
                      if (typeof window !== "undefined") {
                        window.sessionStorage.setItem(LOCAL_TEST_STORAGE_KEY, "1");
                      }
                    } catch (e) {
                      /* ignore */
                    }
                    setLocalTestActive(true);
                    toast.success("Modo de teste local ativado.");
                    navigate("/auth?mode=register&test=1", { replace: true });
                  }}
                  className="w-full rounded-xl border border-dashed border-[#C8A882] px-4 py-2 text-xs font-medium text-[#8B1A1A] hover:bg-[#FFF9F2] transition-colors"
                >
                  Ativar modo de teste local
                </button>
              ) : (
                <button
                  onClick={() => {
                    try {
                      if (typeof window !== "undefined") {
                        window.sessionStorage.setItem(LOCAL_TEST_STORAGE_KEY, "0");
                      }
                    } catch (e) {
                      /* ignore */
                    }
                    setLocalTestActive(false);
                    toast.success("Modo de teste local desativado.");
                    navigate("/auth?mode=register", { replace: true });
                  }}
                  className="w-full rounded-xl border border-dashed border-[#E6DCCF] px-4 py-2 text-xs font-medium text-[#8B1A1A] hover:bg-[#FFF9F2] transition-colors"
                >
                  Desativar modo de teste local
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
