import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Store,
  TrendingUp,
  TrendingDown,
  Award,
  ExternalLink,
  BookOpen,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { cn } from "./ui/utils";

export interface StoreDetailsProps {
  store: {
    id: number;
    lojaId?: string;   // UUID string do backend — usado para exportar o dossiê PDF
    name: string;
    luc: string;
    segment: string;
    manager: string;
  };
  trainings: any[];          // Array global (usado apenas como fallback de navegação)
  onBack: () => void;
  onSelectTraining: (training: any) => void;
  defaultDataInicio?: string;
  defaultDataFim?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Determina o status visual de um treinamento com base na data e no isCancelado */
function resolveStatus(training: any): "agendado" | "concluido" | "cancelado" {
  if (training.isCancelado) return "cancelado";
  const dataHora = training.dataHora || training.data_hora || "";
  if (!dataHora) return "concluido";
  return new Date(dataHora) > new Date() ? "agendado" : "concluido";
}

/** Normaliza uma string de data (ISO ou DD/MM/YYYY) para YYYY-MM-DD */
function normalizarData(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  if (s.includes("/")) {
    const p = s.split("/");
    if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
  }
  if (s.includes("T")) return s.split("T")[0];
  return s; // já é YYYY-MM-DD
}

const STATUS_CONFIG = {
  concluido: {
    label: "Concluído",
    className: "bg-green-50 text-green-700 border-green-200",
    Icon: CheckCircle2,
  },
  agendado: {
    label: "Agendado",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: Clock,
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-50 text-red-600 border-red-200",
    Icon: XCircle,
  },
} as const;

// ── Tipo interno para um treinamento desta loja ───────────────────────────────

interface TreinamentoLoja {
  treinamento_id: string;
  tema: string;
  data: string;          // YYYY-MM-DD normalizado
  dataRaw: string;       // valor original do banco para exibição
  hora: string;
  presentes: string[];
  ausentes: string[];
}

// ── Componente ────────────────────────────────────────────────────────────────

export function StoreDetails({
  store,
  trainings,              // mantido para onSelectTraining global (fallback)
  onBack,
  onSelectTraining,
  defaultDataInicio = "",
  defaultDataFim = "",
}: StoreDetailsProps) {
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [isExporting, setIsExporting] = useState(false);

  // ── Estado dos dados da loja ──────────────────────────────────────────────
  const [todosOsTreinamentos, setTodosOsTreinamentos] = useState<TreinamentoLoja[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ── Busca no Go Backend ao montar ou ao mudar de loja ──────────────────────
  useEffect(() => {
    const idParaBackend = store.lojaId || String(store.id);

    const fetchPresencas = async () => {
      setIsLoadingData(true);
      setLoadError("");

      try {
        const response = await fetch(`https://jpmallflamboyant.live/api/api/lojas/historico?id=${idParaBackend}`);
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        const data = await response.json();

        // data já vem agrupado no formato do models.TreinamentoLojaItem do Go
        const mapped: TreinamentoLoja[] = (data || []).map((t: any) => ({
          treinamento_id: t.treinamento_id,
          tema: t.tema,
          data: t.data,
          dataRaw: t.data,
          hora: t.horario_inicio,
          presentes: t.presentes || [],
          ausentes: t.ausentes || [],
        }));

        setTodosOsTreinamentos(mapped);
      } catch (err: any) {
        console.error("StoreDetails: erro ao buscar presenças via Go backend:", err);
        setLoadError("Não foi possível carregar os dados desta loja.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchPresencas();
  }, [store.lojaId, store.id]);

  // ── Filtro reativo pelo período selecionado ───────────────────────────────
  const treinamentosNoPeriodo = useMemo(() => {
    if (!dataInicio || !dataFim) return todosOsTreinamentos;

    return todosOsTreinamentos.filter(
      (t) => t.data >= dataInicio && t.data <= dataFim
    );
  }, [todosOsTreinamentos, dataInicio, dataFim]);

  // Ordena do mais recente para o mais antigo
  const treinamentosOrdenados = useMemo(
    () => [...treinamentosNoPeriodo].sort((a, b) => b.data.localeCompare(a.data)),
    [treinamentosNoPeriodo]
  );

  // ── KPIs derivados ────────────────────────────────────────────────────────
  const totalTreinamentos = treinamentosOrdenados.length;

  const totalPresentes = treinamentosOrdenados.reduce(
    (acc, t) => acc + t.presentes.length,
    0
  );
  const totalConvocados = treinamentosOrdenados.reduce(
    (acc, t) => acc + t.presentes.length + t.ausentes.length,
    0
  );

  const taxaFrequencia =
    totalConvocados > 0 ? Math.round((totalPresentes / totalConvocados) * 100) : 0;

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!dataInicio || !dataFim) {
      toast.error("Por favor, preencha ambas as datas para o período.");
      return;
    }
    setIsExporting(true);
    try {
      // Monta o histórico a partir dos dados já carregados (sem re-consultar o banco)
      const historicoList = treinamentosOrdenados.map((t) => ({
        tema: t.tema,
        data: t.dataRaw || t.data,
        presentes: t.presentes,
        ausentes: t.ausentes,
      }));

      const payload = {
        dados_loja: {
          nome: store.name || "",
          name: store.name || "",
          segmento: store.segment || "",
          segment: store.segment || "",
          luc: store.luc || "",
        },
        period: {
          de: dataInicio,
          ate: dataFim,
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
        historico_treinamentos: historicoList,
      };

      const response = await fetch("http://localhost:8000/api/automacoes/pdf/dossie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API de PDF: ${errorText}`);
      }

      const blob = await response.blob();
      const localUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = localUrl;
      a.download = `dossie_${(store.name || "loja")
        .replace(/\s+/g, "_")
        .toLowerCase()}_${dataInicio}_${dataFim}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(localUrl);
      toast.success("Dossiê em PDF baixado com sucesso!");
    } catch (err: any) {
      console.error("Erro completo na exportação:", err);
      toast.error(`Falha ao exportar o PDF: ${err.message || "Erro desconhecido"}`);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Próximo treinamento (agendado) ────────────────────────────────────────
  // Usa o array global para buscar um agendamento futuro desta loja,
  // caso exista no array global (compatibilidade com dados do pai).
  const proximoAgendado = useMemo(() => {
    const now = new Date();
    return [...trainings]
      .filter((t) => {
        const dh = new Date(t.dataHora || t.data_hora || 0);
        return dh > now && !t.isCancelado;
      })
      .sort(
        (a, b) =>
          new Date(a.dataHora || a.data_hora || 0).getTime() -
          new Date(b.dataHora || b.data_hora || 0).getTime()
      )[0] ?? null;
  }, [trainings]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main
      className="flex-1 min-h-screen flex flex-col"
      style={{ backgroundColor: "#F7F4EF" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-6 shrink-0 relative z-20 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-[#C4151F] transition-colors mb-6 w-fit border border-transparent hover:border-gray-200 py-1.5 px-3 -ml-3 rounded-md"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para gestão
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Identidade da loja */}
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-red-100"
                style={{ backgroundColor: "#C4151F" }}
              >
                <Store className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {store.name}
                </h1>
                <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                  {store.luc && (
                    <>
                      <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                        {store.luc}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  {store.segment && (
                    <>
                      {store.segment}
                      <span>•</span>
                    </>
                  )}
                  {store.manager
                    ? `Gerente: ${store.manager}`
                    : "Gerente não informado"}
                </p>
              </div>
            </div>
          </div>

          {/* Seletor de período */}
          <div className="flex flex-wrap items-end gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pdf-start-date"
                className="text-xs font-semibold text-gray-600 uppercase tracking-wider"
              >
                De
              </label>
              <input
                id="pdf-start-date"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-all bg-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pdf-end-date"
                className="text-xs font-semibold text-gray-600 uppercase tracking-wider"
              >
                Até
              </label>
              <input
                id="pdf-end-date"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-all bg-white"
              />
            </div>
            <button
              onClick={handleExportPDF}
              disabled={isExporting || isLoadingData}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all bg-[#C4151F] hover:bg-[#A31219] disabled:opacity-50 min-h-[40px] cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Exportar Dossiê PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">

          {/* Taxa de Frequência */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-5 pt-5">
              <CardTitle className="text-xs font-medium text-gray-600">
                Taxa Geral de Frequência
              </CardTitle>
              <Award className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {isLoadingData ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-300 mt-1" />
              ) : (
                <>
                  <div className="flex items-baseline gap-3">
                    <div className="text-2xl font-bold text-gray-900">
                      {taxaFrequencia}%
                    </div>
                    {taxaFrequencia >= 70 ? (
                      <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Alta
                      </span>
                    ) : (
                      <span className="flex items-center text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                        <TrendingDown className="w-3 h-3 mr-1" />
                        Baixa
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {totalPresentes} presentes de {totalConvocados} convocados
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total de treinamentos no período */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-5 pt-5">
              <CardTitle className="text-xs font-medium text-gray-600">
                Treinamentos no Período
              </CardTitle>
              <Calendar className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {isLoadingData ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-300 mt-1" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-gray-900">
                    {totalTreinamentos}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {dataInicio && dataFim
                      ? `${dataInicio} → ${dataFim}`
                      : "Todos os períodos"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Próximo treinamento */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-5 pt-5">
              <CardTitle className="text-xs font-medium text-gray-600">
                Próximo Treinamento
              </CardTitle>
              <BookOpen className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {proximoAgendado ? (
                <>
                  <div
                    className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 cursor-pointer hover:text-[#C4151F] transition-colors"
                    onClick={() => onSelectTraining(proximoAgendado)}
                  >
                    {proximoAgendado.tema}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {proximoAgendado.data}{" "}
                    {proximoAgendado.hora ? `às ${proximoAgendado.hora}` : ""}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-gray-400">
                    Nenhum agendado
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    no período selecionado
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Tabela de Histórico ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#C4151F]" />
              Histórico de Treinamentos
            </h2>
            <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
              {totalTreinamentos}{" "}
              {totalTreinamentos === 1 ? "registro" : "registros"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-600 w-[140px] px-6">
                    Data
                  </TableHead>
                  <TableHead className="font-semibold text-gray-600 px-6">
                    Tema
                  </TableHead>
                  <TableHead className="font-semibold text-gray-600 w-[160px] text-center px-6">
                    Presença
                  </TableHead>
                  <TableHead className="font-semibold text-gray-600 w-[100px] text-center px-6">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {isLoadingData ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-sm">Carregando dados da loja...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : loadError ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-red-400">
                      <p className="text-sm">{loadError}</p>
                    </TableCell>
                  </TableRow>
                ) : treinamentosOrdenados.length > 0 ? (
                  treinamentosOrdenados.map((treinamento) => {
                    const totalConv = treinamento.presentes.length + treinamento.ausentes.length;
                    const pct = totalConv > 0
                      ? Math.round((treinamento.presentes.length / totalConv) * 100)
                      : 0;

                    // Status visual baseado na data
                    const dataObj = treinamento.data ? new Date(treinamento.data + "T00:00:00") : null;
                    const isFuturo = dataObj ? dataObj > new Date() : false;
                    const statusKey: keyof typeof STATUS_CONFIG = isFuturo ? "agendado" : "concluido";
                    const { label, className: statusClass, Icon } = STATUS_CONFIG[statusKey];

                    // Tenta encontrar o objeto correspondente no array global de trainings
                    const originalTraining = trainings.find(
                      (t) => String(t.id) === treinamento.treinamento_id
                    ) || trainings.find(
                      (t) => t.tema === treinamento.tema
                    );

                    return (
                      <TableRow
                        key={treinamento.treinamento_id}
                        className={cn(
                          "group transition-colors",
                          originalTraining ? "cursor-pointer hover:bg-gray-50/80" : "hover:bg-gray-50/80"
                        )}
                        onClick={originalTraining ? () => onSelectTraining(originalTraining) : undefined}
                      >
                        {/* Data */}
                        <TableCell className="text-gray-600 font-medium whitespace-nowrap px-6">
                          {treinamento.dataRaw || treinamento.data || "—"}
                          {treinamento.hora && (
                            <div className="text-xs text-gray-400 font-normal mt-0.5">
                              {treinamento.hora}
                            </div>
                          )}
                        </TableCell>

                        {/* Tema */}
                        <TableCell className="px-6">
                          <span className={cn(
                            "font-semibold text-gray-900 leading-snug transition-colors flex items-center gap-1.5",
                            originalTraining && "group-hover:text-[#C4151F]"
                          )}>
                            {treinamento.tema}
                            {originalTraining && (
                              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                            )}
                          </span>
                        </TableCell>

                        {/* Presença: X / Y */}
                        <TableCell className="text-center px-6">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={cn(
                              "text-sm font-semibold",
                              pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-500" : "text-red-500"
                            )}>
                              {treinamento.presentes.length} / {totalConv}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {pct}% de presença
                            </span>
                          </div>
                        </TableCell>

                        {/* Badge de status */}
                        <TableCell className="text-center px-6">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
                              statusClass
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-12 text-gray-400"
                    >
                      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">
                        Nenhum treinamento registrado para esta loja no período selecionado.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </main>
  );
}