import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { CheckCircle2, Loader2, Mail, MapPin, ShieldAlert, Sparkles } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import figmaAsset from "../../imports/logo_2024-1.png";
import { API_BASE_URL } from "../lib/config";

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

// Interface baseada na rota /api/treinamentos/geofencing do seu Go
interface GeofencingDados {
  nome_local: string;
  latitude: number;
  longitude: number;
  raio_amplitude: number;
}

export function AutocheckinPage() {
  const [searchParams] = useSearchParams();
  const treinamentoId = searchParams.get("treinamento_id") || "";

  const [email, setEmail] = useState("");
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationMessage, setLocationMessage] = useState("Aguardando validação de localização.");
  const [isLocationValid, setIsLocationValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Guardando a posição capturada do usuário para enviar ao backend no submit
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [dadosGeofence, setDadosGeofence] = useState<GeofencingDados | null>(null);
  const [isLoadingDados, setIsLoadingDados] = useState(true);

  const canSubmit = useMemo(() =>
    Boolean(treinamentoId && email && isLocationValid && !isSubmitting && !isLoadingDados),
    [email, isLocationValid, isSubmitting, treinamentoId, isLoadingDados]
  );

  // 1. PASSO: Busca os dados geográficos usando a sua rota oficial do Go
  useEffect(() => {
    if (!treinamentoId) {
      setIsLoadingDados(false);
      return;
    }

    async function carregarGeofencing() {
      try {
        setIsLoadingDados(true);
        // Consumindo sua rota exata do Go passando query param
        const response = await fetch(`${API_BASE_URL}/api/treinamentos/geofencing?treinamento_id=${treinamentoId}`);

        if (!response.ok) {
          throw new Error("Este treinamento não possui uma cerca virtual (geofencing) configurada.");
        }

        const data: GeofencingDados = await response.json();
        setDadosGeofence(data);
      } catch (err) {
        console.error(err);
        setFeedback({
          type: "error",
          message: "Erro ao carregar validações do local. Fale com o organizador.",
        });
      } finally {
        setIsLoadingDados(false);
      }
    }

    carregarGeofencing();
  }, [treinamentoId]);

  // 2. PASSO: Valida o GPS local comparando com o retorno da sua API
  useEffect(() => {
    if (!treinamentoId || isLoadingDados) return;

    if (!dadosGeofence) {
      setLocationState("error");
      setLocationMessage("Geofencing não localizado para este treinamento.");
      return;
    }

    if (!navigator.geolocation) {
      setLocationState("error");
      setLocationMessage("Geolocalização não suportada neste navegador.");
      setIsLocationValid(false);
      return;
    }

    setLocationState("searching");
    setLocationMessage("Verificando sua distância até o local...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLon = position.coords.longitude;

        // Salva no estado para usar no POST posterior
        setUserCoords({ lat: uLat, lon: uLon });

        const distancia = calcularDistancia(
          uLat,
          uLon,
          dadosGeofence.latitude,
          dadosGeofence.longitude
        );

        if (distancia <= dadosGeofence.raio_amplitude) {
          setLocationState("success");
          setLocationMessage(`Localização confirmada em: ${dadosGeofence.nome_local}.`);
          setIsLocationValid(true);
          return;
        }

        setLocationState("error");
        setLocationMessage(`Fora do perímetro (Distância: ${distancia.toFixed(0)}m).`);
        setIsLocationValid(false);
        setFeedback({
          type: "error",
          message: `Você precisa estar fisicamente no(a) ${dadosGeofence.nome_local} para efetuar o check-in.`,
        });
      },
      (error) => {
        setLocationState("error");
        setLocationMessage("Não foi possível obter o sinal do seu GPS.");
        setIsLocationValid(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [treinamentoId, dadosGeofence, isLoadingDados]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!treinamentoId || !isLocationValid || !userCoords) return;

    setIsSubmitting(true);

    try {
      // Enviando o objeto completo exigido pelo seu ConfirmarPresencaRequest do Go
      const response = await fetch(`${API_BASE_URL}/api/presencas/confirmar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treinamento_id: treinamentoId,
          email: email,
          user_latitude: userCoords.lat,
          user_longitude: userCoords.lon
        }),
      });

      if (!response.ok) {
        // Captura o objeto de erro estruturado que seu backend envia se falhar a geocerca secundária
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.erro || "Falha ao confirmar presença no servidor.");
      }

      setFeedback({
        type: "success",
        message: "Sua presença foi registrada com sucesso no sistema!",
      });
      setEmail("");
    } catch (error) {
      console.error("Erro no autocheck-in:", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível concluir o check-in.",
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
              <h1 className="text-base font-semibold text-slate-900 sm:text-lg">Autocheck-in</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
            <Sparkles className="h-3.5 w-3.5" /> Geocerca Ativa
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F7F4EF] px-3 py-1 text-xs font-medium text-[#8B1A1A]">
              <MapPin className="h-3.5 w-3.5" /> Presença via GPS
            </div>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {isLoadingDados ? "Buscando local..." : dadosGeofence?.nome_local || "Validando ambiente"}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
              A validação biométrica de posição está ativa. Digite o e-mail cadastrado na sua inscrição para confirmar a presença.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${locationState === "success" ? "bg-emerald-100 text-emerald-700" :
                    locationState === "error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}>
                  {locationState === "success" ? <CheckCircle2 className="h-5 w-5" /> :
                    locationState === "error" ? <ShieldAlert className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{locationMessage}</p>
                  <p className="mt-1 text-xs text-slate-500">A aprovação do GPS pelo smartphone é obrigatória.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">E-mail Corporativo / Inscrição</label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-[#D93030] focus-within:ring-4 focus-within:ring-[#D93030]/10">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@shopping.com"
                    className="w-full bg-transparent text-sm outline-none"
                    required
                    disabled={isLoadingDados}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D93030] to-[#8B1A1A] px-5 py-4 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isSubmitting ? "Sincronizando presença..." : "Confirmar presença"}
              </button>
            </form>

            {feedback && (
              <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
                }`}>
                {feedback.message}
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4 rounded-[28px] border border-black/5 bg-[#1F2937] p-5 text-white sm:p-7">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Instruções</p>
              <ol className="mt-3 space-y-3 text-sm text-white/85">
                <li>1. Ative o GPS de alta precisão no celular.</li>
                <li>2. Aguarde o card do local ficar verde.</li>
                <li>3. Insira o e-mail e clique em confirmar.</li>
              </ol>
            </div>
            <div className="footer mt-auto border-t border-white/10 pt-4 text-xs text-white/55">
              <p>JP Mall • Geofencing Ativo</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}