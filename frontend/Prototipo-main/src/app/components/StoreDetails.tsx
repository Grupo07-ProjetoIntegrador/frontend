import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";
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
  trainings: any[];
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

// ── Componente ────────────────────────────────────────────────────────────────

export function StoreDetails({
  store,
  trainings,
  onBack,
  onSelectTraining,
  defaultDataInicio = "",
  defaultDataFim = "",
}: StoreDetailsProps) {
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [isExporting, setIsExporting] = useState(false);

  // ── Export PDF Corrigido (Ajustado para horario_inicio e data) ──────────────
  const handleExportPDF = async () => {
    if (!dataInicio || !dataFim) {
      toast.error("Por favor, preencha ambas as datas para o período.");
      return;
    }
    setIsExporting(true);
    try {
      // Usa lojaId (UUID do banco) preferencialmente; fallback para store.id por compatibilidade
      const idParaBackend = store.lojaId || String(store.id);

      // 1. Buscando exatamente 'horario_inicio' e 'data' conforme a estrutura real do seu Supabase
      const { data: presencas, error: dbError } = await supabase
        .from("presencas")
        .select(`
          status_presenca,
          nome_participante,
          treinamento_id,
          treinamentos (
            tema,
            horario_inicio,
            data
          )
        `)
        .eq("loja_id", idParaBackend);

      if (dbError) throw dbError;

      // 2. Agrupa os participantes por treinamento filtrando estritamente pelo período
      const group: { [id: string]: { tema: string, data: string, presentes: string[], ausentes: string[] } } = {};

      presencas?.forEach((p: any) => {
        const t = p.treinamentos;
        if (!t) return;

        // Usa o campo 'data' puro (que já captura dia, mês e ano) para fazer o filtro do período
        // O formato esperado em dataInicio/dataFim costuma ser YYYY-MM-DD. 
        // Se o seu campo 'data' no banco vier invertido (ex: DD/MM/YYYY), ele precisa ser normalizado.
        let tDate = String(t.data || "").trim();

        // Se o campo 'data' vier no formato DD/MM/YYYY, convertemos para YYYY-MM-DD para o filtro funcionar:
        if (tDate.includes("/")) {
          const partes = tDate.split("/");
          if (partes.length === 3) {
            tDate = `${partes[2]}-${partes[1]}-${partes[0]}`; // vira YYYY-MM-DD
          }
        } else if (tDate.includes("T")) {
          tDate = tDate.split("T")[0];
        }

        if (!tDate) return;

        // Filtro estrito do período selecionado
        if (tDate < dataInicio || tDate > dataFim) return;

        if (!group[p.treinamento_id]) {
          group[p.treinamento_id] = {
            tema: t.tema || "Treinamento sem Tema",
            data: t.data || tDate, // Envia o campo de data legível para o backend Python montar o HTML
            presentes: [],
            ausentes: [],
          };
        }

        const status = String(p.status_presenca || "").toUpperCase().trim();

        // Verifica se o lojista compareceu ou não
        if (status === "PRESENTE" || status === "CONFIRMADO" || status === "SIM") {
          group[p.treinamento_id].presentes.push(p.nome_participante || "Participante Anônimo");
        } else {
          group[p.treinamento_id].ausentes.push(p.nome_participante || "Participante Anônimo");
        }
      });

      const historicoList = Object.values(group);

      // 3. Monta o payload exato com as chaves esperadas pelo script Python
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

      // 4. Dispara a requisição para o microsserviço Python
      const response = await fetch("http://localhost:8000/api/automacoes/pdf/dossie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  // ── Dados derivados ────────────────────────────────────────────────────────
  // Exibe TODOS os treinamentos do período passados ao componente (já filtrados
  // pelo pai), ordenados do mais recente para o mais antigo.
  // Isso garante que a lista funcione tanto com dados reais do backend
  // quanto com dados de attendanceList do mock.
  const sortedTrainings = [...trainings].sort((a, b) => {
    const dateA = new Date(a.dataHora || a.data_hora || 0).getTime();
    const dateB = new Date(b.dataHora || b.data_hora || 0).getTime();
    return dateB - dateA;
  });

  const totalTreinamentos = sortedTrainings.length;
  const concluidos = sortedTrainings.filter(
    (t) => resolveStatus(t) === "concluido"
  ).length;
  const agendados = sortedTrainings.filter(
    (t) => resolveStatus(t) === "agendado"
  ).length;

  // Taxa de realização: concluídos / total (excluindo cancelados)
  const naoCancel = totalTreinamentos - sortedTrainings.filter(
    (t) => resolveStatus(t) === "cancelado"
  ).length;
  const taxaRealizacao =
    naoCancel > 0 ? Math.round((concluidos / naoCancel) * 100) : 0;

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
                  {/* LUC exibido diretamente — sem formatação que altere o valor */}
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

          {/* Seletor de período para exportar PDF */}
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
              disabled={isExporting}
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
          {/* Taxa de realização */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-5 pt-5">
              <CardTitle className="text-xs font-medium text-gray-600">
                Taxa de Realização
              </CardTitle>
              <Award className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-bold text-gray-900">
                  {taxaRealizacao}%
                </div>
                {taxaRealizacao >= 70 ? (
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
                {concluidos} de {naoCancel} treinamentos concluídos
              </p>
            </CardContent>
          </Card>

          {/* Total de treinamentos no período */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-5 pt-5">
              <CardTitle className="text-xs font-medium text-gray-600">
                Total no Período
              </CardTitle>
              <Calendar className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-bold text-gray-900">
                {totalTreinamentos}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {agendados > 0
                  ? `${agendados} agendado${agendados > 1 ? "s" : ""} · `
                  : ""}
                {concluidos} concluído{concluidos !== 1 ? "s" : ""}
              </p>
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
              {(() => {
                const proximo = [...trainings]
                  .filter((t) => resolveStatus(t) === "agendado")
                  .sort(
                    (a, b) =>
                      new Date(a.dataHora || a.data_hora || 0).getTime() -
                      new Date(b.dataHora || b.data_hora || 0).getTime()
                  )[0];
                return proximo ? (
                  <>
                    <div
                      className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 cursor-pointer hover:text-[#C4151F] transition-colors"
                      onClick={() => onSelectTraining(proximo)}
                    >
                      {proximo.tema}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {proximo.data} {proximo.hora ? `às ${proximo.hora}` : ""}
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
                );
              })()}
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
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-gray-600 w-[140px] text-right px-6">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {sortedTrainings.length > 0 ? (
                  sortedTrainings.map((training) => {
                    const status = resolveStatus(training);
                    const { label, className, Icon } = STATUS_CONFIG[status];

                    return (
                      <TableRow
                        key={training.id}
                        className="group cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => onSelectTraining(training)}
                      >
                        {/* Data */}
                        <TableCell className="text-gray-600 font-medium whitespace-nowrap px-6">
                          {training.data || "—"}
                          {training.hora && (
                            <div className="text-xs text-gray-400 font-normal mt-0.5">
                              {training.hora}
                            </div>
                          )}
                        </TableCell>

                        {/* Tema + Conteúdo */}
                        <TableCell className="px-6">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-gray-900 group-hover:text-[#C4151F] transition-colors leading-snug">
                              {training.tema}
                            </span>
                            {training.conteudo && (
                              <span className="text-sm text-gray-500 line-clamp-1">
                                {training.conteudo}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Badge de status */}
                        <TableCell className="text-center px-6">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
                              className
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {label}
                          </span>
                        </TableCell>

                        {/* Ação */}
                        <TableCell className="text-right px-6">
                          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md transition-colors focus:outline-none group-hover:bg-gray-100 group-hover:text-gray-900 group-hover:border-gray-400">
                            Ver Detalhes
                            <ExternalLink className="w-3.5 h-3.5" />
                          </div>
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
                        Nenhum treinamento registrado no período selecionado.
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