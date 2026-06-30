import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeft,
  UploadCloud,
  FileSpreadsheet,
  Calendar,
  BookOpen,
  Trash2,
  X,
  Users,
  CheckSquare,
  Store,
  Settings2,
  Edit2,
  Plus,
  Download,
  Loader2,
  Search,
  Hash,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { supabase } from "../lib/supabaseClient";
import { API_BASE_URL } from "../lib/config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { cn } from "./ui/utils";

export interface TrainingDetailsProps {
  training: {
    id: number | string;
    tema: string;
    data: string;
    hora: string;
    conteudo: string;
    capacidade_maxima?: number;
    dataHora?: string;
    attendanceList?: any[];
    material_apoio?: string; // 🟢 Propriedade adicionada explicitamente à interface do TypeScript
  };
  onBack: () => void;
  onUpdateAttendance?: (id: number | string, list: any[]) => void;
  onOpenSettings?: () => void;
  onEditTraining?: () => void;
}

/** Auxiliar para calcular o bloco numérico visível de páginas */
const getPageNumbers = (current: number, total: number) => {
  const maxVisiblePages = 5;
  let startPage = Math.max(1, current - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(total, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  return pages;
};

export function TrainingDetails({
  training,
  onBack,
  onUpdateAttendance,
  onOpenSettings,
  onEditTraining,
}: TrainingDetailsProps) {
  console.log(
    "👀 Dados brutos do Treinamento que chegaram no Details:",
    training,
  );

  const now = new Date();
  const isAgendado = training.dataHora
    ? new Date(training.dataHora) > now
    : false;

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attendees, setAttendees] = useState<
    {
      id: number;
      luc: string;
      loja: string;
      representante: string;
      status: string;
    }[]
  >([]);
  const [attendeeToDelete, setAttendeeToDelete] = useState<{
    id: string | number;
    nome: string;
  } | null>(null);
  const [formLinks, setFormLinks] = useState({ view: "", edit: "" });
  const [formCreator, setFormCreator] = useState({ name: "", email: "" });
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isFormGenerating, setIsFormGenerating] = useState(false);
  const [isFormDeleting, setIsFormDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const [showAttendanceBlock, setShowAttendanceBlock] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAttendee, setNewAttendee] = useState({
    luc: "",
    loja: "",
    representante: "",
    status: "Presente",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingAttendeeId, setEditingAttendeeId] = useState<string | number | null>(null);
  const [lojasCadastradas, setLojasCadastradas] = useState<{ luc: string; nome: string }[]>([]);
  const [lojaInputValue, setLojaInputValue] = useState("");

  // Estados para Filtros e Paginação
  const [filterLuc, setFilterLuc] = useState("");
  const [filterLoja, setFilterLoja] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 10;

  // Estado para controle de loading na listagem de chamadas
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Armazena dinamicamente a propriedade caso chegue mapeada em camelCase ou PascalCase do componente pai
  const materialApoioUrl =
    training.material_apoio ||
    (training as any).materialApoio ||
    (training as any).MaterialApoio;

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token || "";

      const url = `${API_BASE_URL}/api/relatorios/treinamento/chamada?treinamento_id=${training.id}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Erro ao gerar PDF.");

      const blob = await response.blob();
      const localUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = localUrl;
      a.download = `lista_chamada_${training.tema.replace(/\s+/g, "_").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(localUrl);
      toast.success("Lista de chamada em PDF baixada com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao exportar a lista de chamada em PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const fetchPresencas = useCallback(async () => {
    try {
      setIsLoadingData(true);
      console.log("🔎 Buscando presenças para o treinamento ID:", training.id);
      const response = await fetch(
        `${API_BASE_URL}/api/treinamentos/presencas?treinamento_id=${training.id}&_t=${Date.now()}`,
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Dados recebidos do banco:", data);
        setAttendees(data);
        if (onUpdateAttendance) {
          onUpdateAttendance(training.id, data);
        }
      } else {
        console.error(
          "🚨 O Servidor Go recusou a busca. Status:",
          response.status,
        );
      }
    } catch (error) {
      console.error("🚨 Erro grave de conexão:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, [training.id, onUpdateAttendance]);

  const processFile = async (file: File) => {
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");

    if (!isCsv && !isXlsx) {
      toast.error(
        "Formato inválido. Por favor, envie uma planilha .csv ou .xlsx",
      );
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("planilha", file);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/treinamentos/upload?treinamento_id=${training.id}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) throw new Error("Falha ao processar a planilha.");

      const data = await response.json();
      toast.success(data.mensagem);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await fetchPresencas();
    } catch (error) {
      console.error(error);
      toast.error(
        "Erro ao importar a planilha. Verifique se as lojas do arquivo existem no sistema.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Busca lojas do banco para o autocomplete do modal
  useEffect(() => {
    const fetchLojas = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/lojas`);
        if (res.ok) {
          const data: { luc: string; nome: string }[] = await res.json();
          setLojasCadastradas(data.filter((l) => l.luc && l.nome));
        }
      } catch (err) {
        console.warn("Falha ao buscar lojas para o autocomplete:", err);
      }
    };
    fetchLojas();
  }, []);

  const idCarregadoRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (idCarregadoRef.current === training?.id) return;

    if (training && training.id) {
      idCarregadoRef.current = training.id;
      fetchPresencas();
    }
  }, [training?.id, fetchPresencas]);

  const fetchFormLink = useCallback(async () => {
    setIsFormLoading(true);
    setFormError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/treinamentos/formulario?id=${training.id}`,
      );

      if (response.status === 404) {
        setFormLinks({ view: "", edit: "" });
        setFormCreator({ name: "", email: "" });
        return false;
      }

      if (!response.ok) throw new Error("Erro ao buscar formulário");

      const payload = await response.json();
      const viewLink = payload.url_formulario || "";
      const editLink = payload.url_edicao || "";
      const creatorName = payload.creator_name || "";
      const creatorEmail = payload.creator_email || "";
      setFormLinks({ view: viewLink, edit: editLink });
      setFormCreator({ name: creatorName, email: creatorEmail });
      return !!viewLink;
    } catch (error) {
      console.error("Erro ao buscar link do formulário:", error);
      setFormError("Não foi possível carregar o link do formulário.");
      return false;
    } finally {
      setIsFormLoading(false);
    }
  }, [training.id]);

  useEffect(() => {
    fetchFormLink();
  }, [fetchFormLink]);

  useEffect(() => {
    if (!isFormGenerating) return;

    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      attempts += 1;
      const hasLink = await fetchFormLink();

      if (hasLink) {
        setIsFormGenerating(false);
        return;
      }

      if (attempts >= maxAttempts) {
        setIsFormGenerating(false);
        setFormError("Tempo de geração excedido. Tente novamente.");
      }
    };

    const interval = setInterval(poll, 2000);
    poll();

    return () => clearInterval(interval);
  }, [fetchFormLink, isFormGenerating]);

  // Reset da página ativa para a 1 sempre que houver digitação nos filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [filterLuc, filterLoja, filterStatus]);

  // Lógica de filtragem reativa
  const participantesFiltrados = attendees.filter((a) => {
    const matchLuc = (a.luc || "")
      .toLowerCase()
      .includes(filterLuc.toLowerCase());
    const matchLoja = (a.loja || "")
      .toLowerCase()
      .includes(filterLoja.toLowerCase());

    let matchStatus = true;
    if (filterStatus !== "TODOS") {
      matchStatus =
        (a.status || "").toUpperCase() === filterStatus.toUpperCase();
    }
    return matchLuc && matchLoja && matchStatus;
  });

  // Cálculos de paginação
  const totalPaginas =
    Math.ceil(participantesFiltrados.length / ITENS_POR_PAGINA) || 1;
  const indiceInicial = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const participantesPaginados = participantesFiltrados.slice(
    indiceInicial,
    indiceInicial + ITENS_POR_PAGINA,
  );
  const paginasVisiveis = getPageNumbers(paginaAtual, totalPaginas);

  const handleAddAttendee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newAttendee.luc ||
      !newAttendee.loja ||
      !newAttendee.representante ||
      !newAttendee.status
    ) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    try {
      const url = isEditing
        ? `${API_BASE_URL}/api/treinamentos/presencas/editar`
        : `${API_BASE_URL}/api/treinamentos/presencas/manual`;
      
      const body = isEditing
        ? {
            id: editingAttendeeId,
            luc: newAttendee.luc.trim(),
            representante: newAttendee.representante.trim(),
            status: newAttendee.status,
          }
        : {
            treinamento_id: training.id,
            luc: newAttendee.luc.trim(),
            representante: newAttendee.representante.trim(),
            status: newAttendee.status,
          };

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(isEditing ? "Participante editado com sucesso!" : "Participante adicionado com sucesso!");
        setNewAttendee({
          luc: "",
          loja: "",
          representante: "",
          status: "Presente",
        });
        setLojaInputValue("");
        setIsAddModalOpen(false);
        setIsEditing(false);
        setEditingAttendeeId(null);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await fetchPresencas();
      } else {
        toast.error(data.erro || `Falha ao ${isEditing ? "editar" : "adicionar"} participante.`);
      }
    } catch (error) {
      console.error("Erro ao conectar com o servidor:", error);
      toast.error("Erro de conexão com o servidor Go.");
    }
  };

  const handleRemoveAttendee = async (id: string | number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/treinamentos/presencas/deletar?id=${id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Participante removido com sucesso!");
        setAttendeeToDelete(null);
        await fetchPresencas();
      } else {
        toast.error(data.erro || "Falha ao remover participante do banco.");
      }
    } catch (error) {
      console.error("Erro ao conectar com o servidor:", error);
      toast.error("Erro de conexão com o servidor Go.");
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
    e.target.value = "";
  };

  const ROOM_CAPACITY = training.capacidade_maxima
    ? Number(training.capacidade_maxima)
    : 50;
  const totalInscritos = attendees.length;
  const totalPresentes = attendees.filter(
    (a) => a.status?.toUpperCase() === "PRESENTE",
  ).length;
  const comparecimentoPercent =
    totalInscritos > 0
      ? Math.round((totalPresentes / totalInscritos) * 100)
      : 0;
  const ocupacaoPercent = Math.min(
    100,
    Math.round((totalPresentes / ROOM_CAPACITY) * 100),
  );
  const lojasUnicas = new Set(
    attendees.map((a) => a.loja?.trim().toUpperCase()).filter(Boolean),
  ).size;

  return (
    <div
      className="flex-1 min-h-screen flex flex-col p-4 md:p-8 overflow-y-auto"
      style={{ backgroundColor: "#F7F4EF" }}
    >
      {/* Header */}
      <div className="mb-6 md:mb-8 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onBack}
              className="mt-0.5 md:mt-1 p-2 -ml-2 sm:ml-0 rounded-lg text-gray-500 hover:bg-white hover:text-[#D93030] transition-colors border border-transparent hover:border-gray-200 hover:shadow-sm shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1
                className="text-2xl md:text-3xl mb-2 md:mb-3 leading-tight"
                style={{ color: "#8B1A1A" }}
              >
                Palestra: {training.tema}
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Calendar
                    className="w-4 h-4 shrink-0"
                    style={{ color: "#D93030" }}
                  />
                  {training.data} às {training.hora}
                </span>
                <span className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full shrink-0" />
                <span className="flex items-center gap-1.5">
                  <BookOpen
                    className="w-4 h-4 shrink-0"
                    style={{ color: "#D93030" }}
                  />
                  <span className="line-clamp-2 sm:line-clamp-1">
                    {training.conteudo}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap sm:flex-nowrap">
            {/* 🟢 BOTÃO DO MATERIAL DE APOIO TOTALMENTE TRATADO E BLINDADO CONTRA ERROS DE CASING 🟢 */}
            {materialApoioUrl && (
              <a
                href={materialApoioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors min-h-[44px] shadow-sm font-semibold"
                title="Visualizar ou Baixar Material de Apoio"
              >
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>Material de Apoio</span>
              </a>
            )}

            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors min-h-[44px]"
              title="Exportar Lista de Chamada em PDF"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Gerando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar PDF</span>
                </>
              )}
            </button>
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
              title="Abrir configurações do treinamento"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Configurações</span>
            </button>
            <button
              onClick={onEditTraining}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
              title="Editar treinamento"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Editar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <Card className="bg-white border-gray-200 shadow-sm transition-all duration-700">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">
                Comparecimento
              </CardTitle>
              <Users className="h-3.5 w-3.5 text-gray-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold text-gray-900">
                {comparecimentoPercent}%
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {totalPresentes} presentes / {totalInscritos} inscritos
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm transition-all duration-700">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">
                Ocupação da Sala
              </CardTitle>
              <CheckSquare className="h-3.5 w-3.5 text-gray-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold text-gray-900">
                {ocupacaoPercent}%
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {totalPresentes} ocupadas / {ROOM_CAPACITY} vagas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm transition-all duration-700">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">
                Lojas Representadas
              </CardTitle>
              <Store className="h-3.5 w-3.5 text-gray-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold text-gray-900">
                {lojasUnicas}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Lojas diferentes nesta turma
              </p>
            </CardContent>
          </Card>
        </div>

        {isAgendado && attendees.length === 0 && !showAttendanceBlock ? (
          <Card className="bg-gray-50/50 border-dashed border-2 border-gray-200 shadow-none mb-8 w-full flex-1 flex">
            <CardContent className="flex flex-col items-center justify-center py-16 w-full text-center flex-1">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-5 shadow-sm border border-gray-100">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Treinamento Agendado
              </h3>
              <p className="text-sm text-gray-500 max-w-md mb-8">
                Este treinamento ainda não ocorreu. A lista de presença será
                disponibilizada após a sua realização.
              </p>
              <button
                onClick={() => setShowAttendanceBlock(true)}
                className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Lançar Lista Antecipada
              </button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center mt-6 mb-8 transition-colors duration-200 ${
                isDragging
                  ? "border-red-500 bg-red-50"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv, .xlsx"
                onChange={handleFileInput}
              />
              <UploadCloud
                className={`w-12 h-12 mb-4 transition-colors ${isDragging ? "text-red-500" : "text-gray-400"}`}
              />
              <h3
                className="text-lg font-semibold"
                style={{ color: "#1F2937" }}
              >
                Importar Lista de Presença
              </h3>
              <p className="text-sm text-gray-500 mt-1 text-center max-w-md">
                Arraste e solte o arquivo da lista de presença (CSV ou XLSX) ou
                clique para selecionar.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="mt-6 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {isUploading ? (
                  "Processando e Salvando..."
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" /> Selecionar Arquivo
                  </>
                )}
              </button>
            </div>

            {/* Lista Consolidada */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-8">
              {/* Cabecalho da tabela */}
              <div className="p-4 md:p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-red-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Lista de Presença Consolidada
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100 w-fit">
                    Exibindo {indiceInicial + 1}-
                    {Math.min(
                      indiceInicial + ITENS_POR_PAGINA,
                      participantesFiltrados.length,
                    )}{" "}
                    de {participantesFiltrados.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditingAttendeeId(null);
                    setNewAttendee({
                      luc: "",
                      loja: "",
                      representante: "",
                      status: "Presente",
                    });
                    setLojaInputValue("");
                    setIsAddModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Adicionar Manualmente
                </button>
              </div>

              {/* Barra de Filtros */}
              <div className="p-4 bg-gray-50/60 border-b border-gray-200 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-40">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por LUC..."
                    value={filterLuc}
                    onChange={(e) => setFilterLuc(e.target.value)}
                    className="w-full pl-9 pr-3 h-9 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D93030]/20 text-gray-900"
                  />
                </div>
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar loja..."
                    value={filterLoja}
                    onChange={(e) => setFilterLoja(e.target.value)}
                    className="w-full pl-9 pr-3 h-9 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D93030]/20 text-gray-900"
                  />
                </div>
                <div className="relative w-full sm:w-44">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full pl-9 pr-8 h-9 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D93030]/20 text-gray-600 appearance-none cursor-pointer"
                  >
                    <option value="TODOS">Todos os status</option>
                    <option value="PRESENTE">Presente</option>
                    <option value="AUSENTE">Ausente</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                    ▼
                  </span>
                </div>
              </div>

              {/* Corpo da tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">LUC</th>
                      <th className="px-6 py-3 font-medium">Loja</th>
                      <th className="px-6 py-3 font-medium">Representante</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-center">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {isLoadingData ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                            <Loader2 className="w-6 h-6 animate-spin text-[#D93030]" />
                            <span className="text-sm">
                              Carregando lista de chamada...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : participantesFiltrados.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          Nenhum participante encontrado para os filtros
                          aplicados.
                        </td>
                      </tr>
                    ) : (
                      participantesPaginados.map((attendee, index) => (
                        <tr
                          key={attendee.id || index}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {attendee.luc}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {attendee.loja}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {attendee.representante}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                attendee.status?.toUpperCase() === "PRESENTE"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              }`}
                            >
                              {attendee.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1 mx-auto w-fit">
                              <button
                                onClick={() => {
                                  setIsEditing(true);
                                  setEditingAttendeeId(attendee.id);
                                  // Normaliza status do banco (PRESENTE/AUSENTE) para o valor do <select>
                                  const rawStatus = attendee.status || "";
                                  const normalizedStatus =
                                    rawStatus.toUpperCase() === "AUSENTE" ? "Ausente" : "Presente";
                                  const lojaName = attendee.loja || "";
                                  setLojaInputValue(lojaName);
                                  setNewAttendee({
                                    luc: attendee.luc || "",
                                    loja: lojaName,
                                    representante: attendee.representante || "",
                                    status: normalizedStatus,
                                  });
                                  setIsAddModalOpen(true);
                                }}
                                className="text-gray-400 hover:text-[#8B1A1A] transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                                title="Editar presença"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setAttendeeToDelete({
                                    id: attendee.id,
                                    nome: attendee.representante,
                                  })
                                }
                                className="text-gray-400 hover:text-red-600 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                                title="Remover presença"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rodapé com Paginação Numérica */}
              {!isLoadingData && participantesFiltrados.length > 0 && (
                <div className="px-6 py-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-xs text-gray-500">
                    Página{" "}
                    <span className="font-medium text-gray-700">
                      {paginaAtual}
                    </span>{" "}
                    de{" "}
                    <span className="font-medium text-gray-700">
                      {totalPaginas}
                    </span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPaginaAtual(1)}
                      disabled={paginaAtual === 1}
                      className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded-lg disabled:opacity-40 bg-white hover:bg-gray-50 transition-colors"
                      title="Primeira Página"
                    >
                      <ChevronsLeft className="w-4 h-4 text-gray-600" />
                    </button>

                    <button
                      onClick={() =>
                        setPaginaAtual((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={paginaAtual === 1}
                      className="h-8 px-2.5 flex items-center gap-1 border border-gray-200 rounded-lg text-xs font-medium disabled:opacity-40 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                      <span className="hidden sm:inline">Anterior</span>
                    </button>

                    {paginasVisiveis.map((page) => (
                      <button
                        key={page}
                        onClick={() => setPaginaAtual(page)}
                        className={cn(
                          "h-8 w-8 rounded-lg text-xs font-semibold transition-all duration-150 border",
                          paginaAtual === page
                            ? "bg-[#D93030] text-white border-[#D93030] shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50",
                        )}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() =>
                        setPaginaAtual((prev) =>
                          Math.min(prev + 1, totalPaginas),
                        )
                      }
                      disabled={paginaAtual === totalPaginas}
                      className="h-8 px-2.5 flex items-center gap-1 border border-gray-200 rounded-lg text-xs font-medium disabled:opacity-40 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <span className="hidden sm:inline">Próximo</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                    </button>

                    <button
                      onClick={() => setPaginaAtual(totalPaginas)}
                      disabled={paginaAtual === totalPaginas}
                      className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded-lg disabled:opacity-40 bg-white hover:bg-gray-50 transition-colors"
                      title="Última Página"
                    >
                      <ChevronsRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Manual Attendee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditing ? "Editar Participante" : "Adicionar Participante"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {isEditing ? "Edite os dados do lojista selecionado." : "Insira os dados do lojista manualmente."}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditing(false);
                  setEditingAttendeeId(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAttendee} className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="loja"
                    className="text-sm font-medium"
                    style={{ color: "#2A1A1A" }}
                  >
                    Nome da Loja
                  </label>
                  <input
                    id="loja"
                    list="lojas-list"
                    required
                    autoComplete="off"
                    value={lojaInputValue}
                    onChange={(e) => {
                      const typed = e.target.value;
                      setLojaInputValue(typed);
                      // Tenta encontrar a loja exata para preencher o LUC
                      const match = lojasCadastradas.find(
                        (l) => l.nome.toLowerCase() === typed.toLowerCase()
                      );
                      if (match) {
                        setNewAttendee({ ...newAttendee, loja: match.nome, luc: match.luc });
                      } else {
                        setNewAttendee({ ...newAttendee, loja: typed, luc: "" });
                      }
                    }}
                    placeholder="Comece a digitar o nome da loja..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-colors text-sm text-gray-900"
                  />
                  <datalist id="lojas-list">
                    {lojasCadastradas
                      .filter((l) =>
                        l.nome.toLowerCase().includes(lojaInputValue.toLowerCase())
                      )
                      .slice(0, 20)
                      .map((l) => (
                        <option key={l.luc} value={l.nome} />
                      ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="luc"
                    className="text-sm font-medium"
                    style={{ color: "#2A1A1A" }}
                  >
                    LUC
                  </label>
                  <input
                    id="luc"
                    readOnly
                    value={newAttendee.luc}
                    placeholder="Preenchido automaticamente ao selecionar a loja"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-500 cursor-not-allowed select-none"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="representante"
                    className="text-sm font-medium"
                    style={{ color: "#2A1A1A" }}
                  >
                    Nome do Representante
                  </label>
                  <input
                    id="representante"
                    required
                    value={newAttendee.representante}
                    onChange={(e) =>
                      setNewAttendee({
                        ...newAttendee,
                        representante: e.target.value,
                      })
                    }
                    placeholder="Ex: Ana Silva"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-colors text-sm text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="status"
                    className="text-sm font-medium"
                    style={{ color: "#2A1A1A" }}
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    required
                    value={newAttendee.status}
                    onChange={(e) =>
                      setNewAttendee({ ...newAttendee, status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-all text-sm text-gray-900 bg-white"
                  >
                    <option value="Presente">Presente</option>
                    <option value="Ausente">Ausente</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditing(false);
                    setEditingAttendeeId(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-200"
                  style={{ backgroundColor: "#C4151F" }}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Deleção */}
      <AlertDialog
        open={!!attendeeToDelete}
        onOpenChange={(open) => !open && setAttendeeToDelete(null)}
      >
        <AlertDialogContent className="bg-white rounded-lg max-w-sm w-full p-6 border border-gray-100">
          <AlertDialogHeader>
            <h3 className="text-lg font-semibold text-gray-900">
              Remover Participante?
            </h3>
            <AlertDialogDescription className="text-sm text-gray-500 mt-2">
              Você está prestes a remover a presença de{" "}
              <strong>{attendeeToDelete?.nome}</strong>. Esta ação não poderá
              ser desfeita no banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex items-center justify-end gap-3">
            <AlertDialogCancel className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                attendeeToDelete && handleRemoveAttendee(attendeeToDelete.id)
              }
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: "#D93030" }}
            >
              Confirmar e Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
