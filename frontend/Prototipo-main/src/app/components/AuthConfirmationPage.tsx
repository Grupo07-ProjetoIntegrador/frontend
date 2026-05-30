import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Clock3, Loader2, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";

const PENDING_EMAIL_STORAGE_KEY = "flamboyant.auth.pending_email";
const LOCAL_TEST_STORAGE_KEY = "flamboyant.auth.test_mode";

export function AuthConfirmationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLocalHost = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isTestMode = searchParams.get("test") === "1";
  const isRateLimited = searchParams.get("status") === "rate_limit";
  const [pendingEmail, setPendingEmail] = useState<string | null>(() => {
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) {
      return emailFromQuery;
    }

    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY);
  });
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [localTestActive, setLocalTestActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // query param test=1 should enable as well
    const fromQuery = isTestMode;
    const fromStorage = window.sessionStorage.getItem(LOCAL_TEST_STORAGE_KEY) === "1";
    return Boolean(fromQuery || fromStorage);
  });

  const statusTitle = useMemo(() => (pendingEmail ? "Confira sua caixa de e-mail" : "Aguardando retorno"), [pendingEmail]);

  useEffect(() => {
    const emailFromQuery = searchParams.get("email");
    if (!emailFromQuery) return;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, emailFromQuery);
    }

    setPendingEmail(emailFromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (!pendingEmail && typeof window !== "undefined") {
      navigate("/auth?mode=register", { replace: true });
    }
  }, [navigate, pendingEmail]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const clearPendingState = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
  };

  const handleToggleLocalTest = () => {
    if (typeof window === "undefined") return;
    const next = !localTestActive;
    setLocalTestActive(next);
    try {
      window.sessionStorage.setItem(LOCAL_TEST_STORAGE_KEY, next ? "1" : "0");
    } catch (e) {
      // ignore
    }
    toast.success(next ? "Modo de teste local ativado." : "Modo de teste local desativado.");
  };

  const handleResend = async () => {
    if (!pendingEmail) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
      });

      if (error) {
        throw error;
      }

      toast.success("E-mail reenviado com sucesso.");
      setResendCooldown(60);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Nao foi possivel reenviar o e-mail.");
    } finally {
      setIsResending(false);
    }
  };

  const handleConfirmed = () => {
    clearPendingState();
    setPendingEmail(null);
    navigate("/auth?mode=login", { replace: true });
  };

  const handleSimulateConfirmation = () => {
    clearPendingState();
    setPendingEmail(null);
    toast.info("Modo de teste: confirmação simulada.");
    navigate("/auth?mode=login", { replace: true });
  };

  return (
        <div className="relative mx-auto min-h-[calc(100vh-2rem)] w-full max-w-7xl overflow-hidden rounded-[32px] border border-[#E3D7C6] bg-white shadow-[0_30px_90px_rgba(46,26,26,0.16)]">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(139,26,26,0.04),transparent_28%),linear-gradient(90deg,rgba(200,168,130,0.12),transparent_20%)]" />

          <div className="relative flex min-h-[calc(100vh-2rem)] flex-col">
            <header className="flex flex-col gap-4 border-b border-[#E9D7C1] bg-[#FFFDF8] px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8B1A1A] text-white shadow-sm">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8B1A1A]">JP Mall Flamboyant Shopping</p>
                  <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Confirmação de conta</h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#E3D7C6] bg-white px-3 py-1.5 text-gray-700">
                  <ShieldCheck className="h-4 w-4 text-[#8B1A1A]" />
                  Fluxo seguro
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#E3D7C6] bg-white px-3 py-1.5 text-gray-700">
                  <Clock3 className="h-4 w-4 text-[#8B1A1A]" />
                  Permanência até validar
                </span>
                {localTestActive && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#C8A882] px-3 py-1.5 text-sm font-medium text-white">
                    Modo de teste: Ativado
                  </span>
                )}
                {pendingEmail && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#E3D7C6] bg-white px-3 py-1.5 text-gray-700">
                    <MailCheck className="h-4 w-4 text-[#8B1A1A]" />
                    {pendingEmail}
                  </span>
                )}
              </div>
            </header>

            <main className="grid flex-1 grid-cols-1 gap-6 px-6 py-6 md:px-8 lg:grid-cols-[1.35fr_0.95fr] lg:gap-8 lg:py-8">
              <section className="space-y-6">
                <div className="rounded-[28px] border border-[#E6DCCF] bg-[#FFFDF8] p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#8B1A1A]">Status do cadastro</p>
                      <h2 className="text-2xl font-semibold text-gray-900">{pendingEmail ? "Confira sua caixa de e-mail" : "Aguardando retorno"}</h2>
                      <p className="max-w-2xl text-sm leading-6 text-gray-600">
                        {pendingEmail
                          ? `Enviamos a confirmação para ${pendingEmail}. O acesso fica bloqueado até a validação do e-mail.`
                          : "Nenhum cadastro pendente foi localizado nesta sessão."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#E9D7C1] bg-white px-4 py-3 text-right shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">Fila</p>
                      <p className="text-lg font-semibold text-[#8B1A1A]">1 solicitação</p>
                      <p className="text-xs text-gray-500">Cadastro aguardando validação</p>
                    </div>
                  </div>

                  {isRateLimited && (
                    <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">Limite de envio atingido</p>
                        <p className="mt-1 leading-6">
                          O Supabase bloqueou um novo e-mail por rate limit. O cadastro anterior continua pendente e você pode usar o modo de teste local para avançar sem e-mail real.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      { title: "Envio", description: "Link preparado e rastreado.", active: false },
                      { title: "Validação", description: "Abra o e-mail e confirme.", active: true },
                      { title: "Acesso", description: "Login liberado após validação.", active: false },
                    ].map((step, index) => (
                      <div key={step.title} className="rounded-2xl border border-[#E6DCCF] bg-white p-4">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F4EF] text-[#8B1A1A]">
                          {step.active ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-sm font-semibold">0{index + 1}</span>}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{step.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-[#E6DCCF] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F4EF] text-[#8B1A1A]">
                        <MailCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Caixa de entrada</p>
                        <p className="text-xs text-gray-500">Confira spam e promoções se necessário.</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-[#E9D7C1] bg-[#FFF9F2] p-4 text-sm text-gray-700">
                      O acesso só é liberado depois do clique no link enviado.
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#E6DCCF] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F4EF] text-[#8B1A1A]">
                        <RefreshCw className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Retentativa</p>
                        <p className="text-xs text-gray-500">Novo envio sem sair da tela.</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-gray-600">
                      Se a mensagem não aparecer, reenvie de forma controlada ou siga o modo de teste local.
                    </p>
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-[28px] border border-[#E6DCCF] bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#8B1A1A]">Próxima etapa</p>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">Acompanhar confirmação</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Esta área funciona como um card de CRM: status claro, ação principal e opções de acompanhamento sem poluição visual.
                  </p>

                  <div className="mt-5 space-y-3">
                    <button
                      onClick={handleResend}
                      disabled={!pendingEmail || resendCooldown > 0 || isResending}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B1A1A] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6F1D1B] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
                      {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar e-mail"}
                    </button>

                    <button
                      onClick={handleConfirmed}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E3D7C6] bg-white px-4 py-3 text-sm font-medium text-[#8B1A1A] transition-colors hover:bg-[#FFF9F2]"
                    >
                      Já confirmei o e-mail
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    {isLocalHost && (
                      <div className="space-y-2">
                        <button
                          onClick={handleToggleLocalTest}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl ${localTestActive ? "bg-[#C8A882] text-white" : "border border-[#E3D7C6] bg-white text-[#8B1A1A]"} px-4 py-3 text-sm font-medium transition-colors hover:opacity-95`}
                        >
                          {localTestActive ? "Desativar modo de teste local" : "Ativar modo de teste local"}
                        </button>

                        {localTestActive && (
                          <button
                            onClick={handleSimulateConfirmation}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#C8A882] bg-[#FFFDF8] px-4 py-3 text-sm font-medium text-[#8B1A1A] transition-colors hover:bg-[#FFF9F2]"
                          >
                            Simular confirmação local
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#E6DCCF] bg-[#8B1A1A] p-6 text-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <CheckCircle2 className="h-5 w-5 text-[#C8A882]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Controle interno</p>
                      <p className="text-lg font-semibold">Fluxo de validação</p>
                    </div>
                  </div>

                  <ul className="mt-5 space-y-3 text-sm text-white/80">
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[#C8A882]" />
                      Confirmação pendente até o e-mail ser aberto.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[#C8A882]" />
                      Reenvio controlado para evitar duplicidade.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[#C8A882]" />
                      Modo teste local disponível para demonstração.
                    </li>
                  </ul>
                </div>
              </aside>
            </main>
          </div>
      </div>
  );
}
