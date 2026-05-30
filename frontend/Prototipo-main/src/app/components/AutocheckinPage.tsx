import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { CheckCircle2, Loader2, Mail, MapPin, ShieldAlert, Sparkles } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import figmaAsset from "../../imports/logo_2024-1.png";

const FLAMBOYANT_LAT = -16.7093;
const FLAMBOYANT_LON = -49.2344;
const RAIO_PERMITIDO_METROS = 50;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const raioTerra = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const clamped = Math.min(1, Math.max(0, a));
  return raioTerra * (2 * Math.asin(Math.sqrt(clamped)));
}

type LocationState = "idle" | "searching" | "success" | "error";

export function AutocheckinPage() {
  const [searchParams] = useSearchParams();
  const treinamentoId = searchParams.get("treinamento_id") || "";
  const [email, setEmail] = useState("");
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationMessage, setLocationMessage] = useState("Aguardando validação de localização.");
  const [isLocationValid, setIsLocationValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const canSubmit = useMemo(() => Boolean(treinamentoId && email && isLocationValid && !isSubmitting), [email, isLocationValid, isSubmitting, treinamentoId]);

  useEffect(() => {
    if (!treinamentoId) {
      setLocationState("error");
      setLocationMessage("O ID do treinamento não foi informado no QR Code.");
      setIsLocationValid(false);
      setFeedback({
        type: "error",
        message: "O link de autocheck-in está incompleto. Solicite um novo QR Code ao organizador.",
      });
      return;
    }

    if (!navigator.geolocation) {
      setLocationState("error");
      setLocationMessage("Geolocalização não suportada neste navegador.");
      setIsLocationValid(false);
      setFeedback({
        type: "error",
        message: "Seu navegador não oferece suporte à geolocalização. Use outro navegador para confirmar a presença.",
      });
      return;
    }

    setLocationState("searching");
    setLocationMessage("Solicitando permissão de localização...");
    setFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distancia = calcularDistancia(
          position.coords.latitude,
          position.coords.longitude,
          FLAMBOYANT_LAT,
          FLAMBOYANT_LON
        );

        if (distancia <= RAIO_PERMITIDO_METROS) {
          setLocationState("success");
          setLocationMessage("Localização validada no Shopping Flamboyant.");
          setIsLocationValid(true);
          return;
        }

        setLocationState("error");
        setLocationMessage(`Você está fora do perímetro permitido (${distancia.toFixed(0)}m de distância).`);
        setIsLocationValid(false);
        setFeedback({
          type: "error",
          message: "A presença só pode ser confirmada dentro do auditório do Shopping Flamboyant.",
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          [error.PERMISSION_DENIED]: "Permissão de localização negada.",
          [error.POSITION_UNAVAILABLE]: "Sinal de GPS indisponível.",
          [error.TIMEOUT]: "Tempo esgotado para obter a localização.",
        };

        setLocationState("error");
        setLocationMessage(messages[error.code] || "Falha ao acessar o GPS.");
        setIsLocationValid(false);
        setFeedback({
          type: "error",
          message: `${messages[error.code] || "Não foi possível validar a localização."} Ative a localização no aparelho e recarregue a página.`,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [treinamentoId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!treinamentoId) {
      setFeedback({ type: "error", message: "Código do treinamento inválido." });
      return;
    }

    if (!isLocationValid) {
      setFeedback({ type: "error", message: "Localização inválida. Você precisa estar dentro do Shopping Flamboyant." });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/presencas/confirmar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ treinamento_id: treinamentoId, email }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Falha ao confirmar presença");
      }

      setFeedback({
        type: "success",
        message: "Presença confirmada com sucesso. Seu status foi alterado para PRESENTE.",
      });
      setEmail("");
    } catch (error) {
      console.error("Erro no autocheck-in:", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível confirmar a presença.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EF] text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,_rgba(139,26,26,0.10),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(217,48,48,0.08),_transparent_30%)]" />

      <header className="relative z-10 border-b border-black/5 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8B1A1A] shadow-lg shadow-[#8B1A1A]/20">
              <ImageWithFallback src={figmaAsset} alt="Flamboyant" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8B1A1A]/70">JP Mall</p>
              <h1 className="text-base font-semibold text-slate-900 sm:text-lg">Autocheck-in do treinamento</h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            Geolocalização ativa
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F7F4EF] px-3 py-1 text-xs font-medium text-[#8B1A1A]">
              <MapPin className="h-3.5 w-3.5" />
              Presença geolocalizada
            </div>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Confirme sua presença no auditório</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Abra esta página pelo QR Code do treinamento, permita o acesso à localização e informe seu e-mail de inscrição para validar a presença.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    locationState === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : locationState === "error"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {locationState === "success" ? <CheckCircle2 className="h-5 w-5" /> : locationState === "error" ? <ShieldAlert className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{locationMessage}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">A autorização do navegador é obrigatória para seguir com o check-in.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                  E-mail de inscrição
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-[#D93030] focus-within:ring-4 focus-within:ring-[#D93030]/10">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D93030] to-[#8B1A1A] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#D93030]/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#D93030]/25 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:hover:translate-y-0"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isSubmitting ? "Processando presença..." : "Confirmar presença"}
              </button>
            </form>

            {feedback && (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {feedback.message}
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4 rounded-[28px] border border-black/5 bg-[#1F2937] p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-7">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Como funciona</p>
              <ol className="mt-3 space-y-3 text-sm leading-6 text-white/85">
                <li>1. Aponte a câmera para o QR Code do treinamento.</li>
                <li>2. Permita a geolocalização no navegador.</li>
                <li>3. Informe seu e-mail e confirme a presença.</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
              <p className="text-sm font-semibold text-white">Regra de validação</p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                O check-in só é liberado dentro do perímetro do Shopping Flamboyant. Fora do local, a confirmação é bloqueada.
              </p>
            </div>

            <footer className="mt-auto border-t border-white/10 pt-4 text-xs leading-5 text-white/55">
              <p>JP Mall • Treinamentos</p>
              <p>Rotas públicas e validação por geolocalização</p>
            </footer>
          </aside>
        </div>
      </main>
    </div>
  );
}