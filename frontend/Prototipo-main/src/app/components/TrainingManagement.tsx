import { useEffect, useState, useRef } from "react";
import {
  Plus,
  ExternalLink,
  Calendar,
  BookOpen,
  Tag,
  Search,
  ChevronDown,
  Filter,
  ChevronRight,
  Edit2,
  Trash2,
  Users,
  Clock,
  Star,
  Award,
  AlertTriangle,
  Store,
  UserCheck,
  Activity,
  List,
  ChevronLeft,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DatePickerPremium } from "./DatePickerPremium";
import { TrainingForm } from "./TrainingForm";
import { TrainingDetails } from "./TrainingDetails";
import { TrainingSettings } from "./TrainingSettings";
import { StoreDetails } from "./StoreDetails";
import { StoreExplorer, LojaExplorador } from "./StoreExplorer";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from "./ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Calendar as CalendarComponent } from "./ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "./ui/card";
import { Progress } from "./ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { cn } from "./ui/utils";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { API_BASE_URL } from "../lib/config";

type ApiTraining = {
  id: string;
  tema: string;
  segmento?: string;
  data?: string;
  data_hora?: string;
  horario_inicio?: string;
  horario_fim?: string;
  conteudo?: string;
  status?: string;
  capacidade_maxima?: number;
  descricao?: string;
  categoria?: string;
  local?: string;
  local_id?: string;
  modalidade?: string;
  objetivo?: string;
  observacoes?: string;
  material_apoio?: string;
  responsavel?: string;
  area_responsavel?: string;
  tags?: string;
  recorrente?: boolean;
};

const PopoverClose = PopoverPrimitive.Close;

const mesesGrid = [
  { cod: "01", abrev: "Jan", nome: "Janeiro" },
  { cod: "02", abrev: "Fev", nome: "Fevereiro" },
  { cod: "03", abrev: "Mar", nome: "Março" },
  { cod: "04", abrev: "Abr", nome: "Abril" },
  { cod: "05", abrev: "Mai", nome: "Maio" },
  { cod: "06", abrev: "Jun", nome: "Junho" },
  { cod: "07", abrev: "Jul", nome: "Julho" },
  { cod: "08", abrev: "Ago", nome: "Agosto" },
  { cod: "09", abrev: "Set", nome: "Setembro" },
  { cod: "10", abrev: "Out", nome: "Outubro" },
  { cod: "11", abrev: "Nov", nome: "Novembro" },
  { cod: "12", abrev: "Dez", nome: "Dezembro" },
];

const anoAtual = new Date().getFullYear();
const anosDisponiveis = Array.from(
  { length: 9 },
  (_, index) => anoAtual - index,
);

const formatTrainingDate = (dateTime?: string, fallback = "") => {
  if (!dateTime) return fallback;
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) return fallback || dateTime;
  return format(date, "dd MMM yyyy", { locale: ptBR });
};

const normalizeTrainingFromApi = (training: ApiTraining) => {
  const dataHora = training.data_hora || "";
  const status = (training.status || "").toLowerCase();
  const horarioInicio =
    training.horario_inicio ||
    (dataHora ? format(new Date(dataHora), "HH:mm") : "00:00");

  return {
    id: training.id,
    tema: training.tema,
    descricao: training.descricao || "",
    categoria: training.categoria || "Geral",
    segmento: training.segmento || "Geral",
    data: formatTrainingDate(dataHora, training.data || ""),
    hora: horarioInicio,
    horarioInicio,
    horarioFim: training.horario_fim || "",
    dataHora: dataHora || new Date().toISOString(),
    local: training.local || "",
    local_id: training.local_id || "",
    modalidade: training.modalidade || "Presencial",
    conteudo: training.conteudo || "",
    objetivo: training.objetivo || "",
    observacoes: training.observacoes || "",
    materialApoio: training.material_apoio || "",
    responsavel: training.responsavel || "",
    areaResponsavel: training.area_responsavel || "",
    tags: training.tags || "",
    recorrente: !!training.recorrente,
    isCancelado: status === "cancelado",
    status: status || "agendado",
    capacidade_maxima: training.capacidade_maxima,
    capacidadeMaxima:
      training.capacidade_maxima !== undefined
        ? String(training.capacidade_maxima)
        : "",
    attendanceList: [],
  };
};

const mockStoreData = [
  {
    id: 1,
    name: "Renner",
    segment: "Vestuário",
    manager: "Carlos Silva",
    luc: "LUC-101",
  },
  {
    id: 2,
    name: "C&A",
    segment: "Vestuário",
    manager: "Ana Oliveira",
    luc: "LUC-102",
  },
  {
    id: 3,
    name: "Centauro",
    segment: "Artigos Esportivos",
    manager: "Pedro Santos",
    luc: "LUC-105",
  },
  {
    id: 4,
    name: "O Boticário",
    segment: "Cosméticos",
    manager: "Julia Lima",
    luc: "LUC-104",
  },
  {
    id: 5,
    name: "Riachuelo",
    segment: "Vestuário",
    manager: "Roberto Almeida",
    luc: "LUC-103",
  },
  {
    id: 6,
    name: "Loja de Informática XYZ",
    segment: "Tecnologia",
    manager: "Fernanda Costa",
    luc: "LUC-106",
  },
  {
    id: 7,
    name: "Moda Íntima ABC",
    segment: "Vestuário",
    manager: "Marcos Pereira",
    luc: "LUC-107",
  },
  {
    id: 8,
    name: "Acessórios e Cia",
    segment: "Acessórios",
    manager: "Luciana Gomes",
    luc: "LUC-108",
  },
  {
    id: 9,
    name: "Ótica Elegance",
    segment: "Óticas",
    manager: "Beatriz Nogueira",
    luc: "LUC-109",
  },
];

export function TrainingManagement() {
  const [trainingsList, setTrainingsList] = useState<any[]>([]);
  const [isLoadingTrainings, setIsLoadingTrainings] = useState(true);
  const [trainingsError, setTrainingsError] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [activeFilter, setActiveFilter] = useState<
    "todos" | "tema" | "segmento" | "data" | "conteudo" | "status"
  >("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateQuery, setDateQuery] = useState<Date>();
  const [dateInput, setDateInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingTraining, setEditingTraining] = useState<any>(null);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [selectedTrainingSettings, setSelectedTrainingSettings] =
    useState<any>(null);
  const [trainingToDelete, setTrainingToDelete] = useState<any>(null);
  const [selectedStore, setSelectedStore] = useState<LojaExplorador | null>(
    null,
  );
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [lucSearchQuery, setLucSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [dashboardData, setDashboardData] = useState<any>(null);

  const handleSelectStore = (loja: LojaExplorador | null) => {
    setSelectedStore(loja);
    if (loja) {
      sessionStorage.setItem("flamboyant.selectedStore", JSON.stringify(loja));
    } else {
      sessionStorage.removeItem("flamboyant.selectedStore");
    }
  };

  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem("flamboyant.activeTab", tab);
  };

  const handleSetViewMode = (mode: "list" | "calendar") => {
    setViewMode(mode);
    sessionStorage.setItem("flamboyant.viewMode", mode);
  };

  const [tipoFiltro, setTipoFiltro] = useState<string>("ano");
  const [anoSelecionado, setAnoSelecionado] = useState<number>(2026);
  const [mesSelecionado, setMesSelecionado] = useState<string>("01");
  const [mesInicio, setMesInicio] = useState<string>("01");
  const [mesFim, setMesFim] = useState<string>("12");
  const [dataInicioCustom, setDataInicioCustom] = useState<string>("");
  const [dataFimCustom, setDataFimCustom] = useState<string>("");

  const [currentMonthInicio, setCurrentMonthInicio] = useState<Date>(
    new Date(anoSelecionado, new Date().getMonth(), 1),
  );
  const [currentMonthFim, setCurrentMonthFim] = useState<Date>(
    new Date(anoSelecionado, new Date().getMonth(), 1),
  );

  // EFEITO 1: Atualiza a folha do calendário se o usuário mudar o ano no seletor principal
  useEffect(() => {
    setCurrentMonthInicio(
      new Date(anoSelecionado, currentMonthInicio.getMonth(), 1),
    );
    setCurrentMonthFim(new Date(anoSelecionado, currentMonthFim.getMonth(), 1));
  }, [anoSelecionado]);

  // EFEITO 2: Reset automático das datas customizadas ao trocar o tipo de filtro
  useEffect(() => {
    setDataInicioCustom("");
    setDataFimCustom("");
  }, [tipoFiltro]);

  // Função centralizada e única que busca os treinamentos da API
  const carregarTreinamentos = async () => {
    setIsLoadingTrainings(true);
    setTrainingsError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/treinamentos`);
      if (!response.ok) throw new Error("Erro ao buscar treinamentos");
      const data: ApiTraining[] = await response.json();
      setTrainingsList((data || []).map(normalizeTrainingFromApi));
    } catch (error) {
      console.error("Erro ao carregar treinamentos:", error);
      setTrainingsError(
        "Erro ao conectar com a API. Confira se o backend Go esta rodando.",
      );
      setTrainingsList([]);
    } finally {
      setIsLoadingTrainings(false);
    }
  };

  useEffect(() => {
    carregarTreinamentos();
    if (typeof window !== "undefined") {
      const savedTab = sessionStorage.getItem("flamboyant.activeTab");
      if (savedTab) {
        setActiveTab(savedTab);
      }
      const savedViewMode = sessionStorage.getItem("flamboyant.viewMode");
      if (savedViewMode === "list" || savedViewMode === "calendar") {
        setViewMode(savedViewMode);
      }
      const savedStore = sessionStorage.getItem("flamboyant.selectedStore");
      if (savedStore) {
        try {
          setSelectedStore(JSON.parse(savedStore));
        } catch (e) {
          console.error("Erro ao restaurar loja do sessionStorage:", e);
        }
      }
    }
  }, []);

  // Restaura a rota após F5: se havia um treinamento selecionado, re-seleciona ele assim que a lista carregar
  useEffect(() => {
    if (trainingsList.length === 0) return;

    const savedId = sessionStorage.getItem("flamboyant.selectedTrainingId");
    const savedView = sessionStorage.getItem("flamboyant.selectedView");

    if (savedId && savedView) {
      const found = trainingsList.find((t) => String(t.id) === savedId);
      if (found) {
        if (savedView === "details") {
          setSelectedTraining(found);
        } else if (savedView === "settings") {
          setSelectedTrainingSettings(found);
        }
      }
    }
  }, [trainingsList]);

  // ─── Derivação reativa do período selecionado ───
  const periodoDataInicio: string = (() => {
    if (tipoFiltro === "ano") return `${anoSelecionado}-01-01`;
    if (tipoFiltro === "mes") return `${anoSelecionado}-${mesSelecionado}-01`;
    if (tipoFiltro === "periodo_mes")
      return `${anoSelecionado}-${mesInicio}-01`;
    if (tipoFiltro === "personalizado" || tipoFiltro === "dia")
      return dataInicioCustom || `${anoSelecionado}-01-01`;
    return `${anoSelecionado}-01-01`;
  })();

  const periodoDataFim: string = (() => {
    if (tipoFiltro === "ano") return `${anoSelecionado}-12-31`;
    if (tipoFiltro === "mes") {
      const primeiroDia = new Date(
        anoSelecionado,
        parseInt(mesSelecionado) - 1,
        1,
      );
      return format(endOfMonth(primeiroDia), "yyyy-MM-dd");
    }
    if (tipoFiltro === "periodo_mes") {
      const ultimoDiaObjeto = endOfMonth(
        new Date(anoSelecionado, parseInt(mesFim) - 1, 1),
      );
      return format(ultimoDiaObjeto, "yyyy-MM-dd");
    }
    if (tipoFiltro === "dia")
      return dataInicioCustom || `${anoSelecionado}-12-31`;
    if (tipoFiltro === "personalizado")
      return dataFimCustom || `${anoSelecionado}-12-31`;
    return `${anoSelecionado}-12-31`;
  })();

  const carregarDadosDashboard = async () => {
    const dataInicio = periodoDataInicio;
    const dataFim = periodoDataFim;

    if (
      (tipoFiltro === "personalizado" || tipoFiltro === "dia") &&
      !dataInicioCustom
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/treinamentos/dashboard?data_inicio=${dataInicio}&data_fim=${dataFim}`,
      );
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error("Erro ao carregar dashboard do backend Go:", error);
    }
  };

  useEffect(() => {
    carregarDadosDashboard();
  }, [
    tipoFiltro,
    anoSelecionado,
    mesSelecionado,
    mesInicio,
    mesFim,
    dataInicioCustom,
    dataFimCustom,
  ]);

  const storeExplorerData = mockStoreData.map((store) => {
    const pastTrainings = trainingsList.filter((t) => {
      if (t.isCancelado) return false;

      const trainingDateStr = t.dataHora.split("T")[0];
      return (
        trainingDateStr >= periodoDataInicio &&
        trainingDateStr <= periodoDataFim
      );
    });

    const periodAttendance = pastTrainings
      .map((t) => t.attendanceList?.find((a: any) => a.id === store.id))
      .filter(Boolean) as any[];

    const total = periodAttendance.length;
    const presentes = periodAttendance.filter(
      (a) => a.status === "Presente",
    ).length;
    const participation = total > 0 ? Math.round((presentes / total) * 100) : 0;

    return { ...store, totalTrainings: total, participation };
  });

  const now = new Date();

  // Determina o grupo de status de cada treinamento para ordenação
  const getStatusGroup = (t: any): number => {
    if (t.isCancelado) return 2; // cancelados por último
    if (new Date(t.dataHora).getTime() >= now.getTime()) return 0; // agendados primeiro
    return 1; // concluídos no meio
  };

  const filteredTrainings = [...trainingsList].sort((a, b) => {
    const groupA = getStatusGroup(a);
    const groupB = getStatusGroup(b);

    // Prioriza grupo: agendados (0) → concluídos (1) → cancelados (2)
    if (groupA !== groupB) return groupA - groupB;

    const dateA = new Date(a.dataHora).getTime();
    const dateB = new Date(b.dataHora).getTime();

    // Agendados: ASC (o mais próximo de acontecer aparece primeiro)
    if (groupA === 0) return dateA - dateB;

    // Concluídos e cancelados: DESC (mais recente primeiro)
    return dateB - dateA;
  }).filter((row) => {
    if (activeFilter === "data") {
      if (!dateInput) return true;
      const rowDate = new Date(row.dataHora);
      if (isNaN(rowDate.getTime())) return true;
      return format(rowDate, "dd/MM/yyyy").includes(dateInput);
    }

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    const dataTreinamento = new Date(row.dataHora);
    let status = "agendado";
    if (row.isCancelado) status = "cancelado";
    else if (dataTreinamento < now) status = "concluido";

    const matchTema = row.tema.toLowerCase().includes(query);
    const matchSegmento = (row.segmento || "Geral (Todos os Segmentos)")
      .toLowerCase()
      .includes(query);
    const matchConteudo = row.conteudo.toLowerCase().includes(query);
    const matchStatus = status.includes(query);
    const matchMatchData =
      row.data.toLowerCase().includes(query) || row.dataHora.includes(query);

    if (activeFilter === "todos")
      return (
        matchTema ||
        matchSegmento ||
        matchConteudo ||
        matchStatus ||
        matchMatchData
      );
    if (activeFilter === "tema") return matchTema;
    if (activeFilter === "segmento") return matchSegmento;
    if (activeFilter === "conteudo") return matchConteudo;
    if (activeFilter === "status") return matchStatus;
    return true;
  });

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (
      (e.nativeEvent as any).inputType === "deleteContentBackward" &&
      dateInput.endsWith("/") &&
      value === dateInput.slice(0, -1)
    ) {
      value = value.slice(0, -1);
    }

    let digits = value.replace(/\D/g, "");
    if (digits.length > 8) digits = digits.slice(0, 8);

    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setDateInput(formatted);

    if (formatted === "") {
      setDateQuery(undefined);
    } else if (formatted.length === 10) {
      const [d, m, y] = formatted.split("/");
      const parsedDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (!isNaN(parsedDate.getTime())) setDateQuery(parsedDate);
    }
  };

  const handleDelete = async () => {
    if (trainingToDelete) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/treinamentos/deletar?id=${trainingToDelete.id}`,
          { method: "DELETE" },
        );
        if (response.ok) {
          setTrainingsList((prev) =>
            prev.filter((t) => t.id !== trainingToDelete.id),
          );
          setTrainingToDelete(null);
        } else {
          alert("Erro ao excluir. O servidor Go recusou o pedido.");
        }
      } catch (error) {
        console.error("Erro ao conectar com o Go:", error);
      }
    }
  };

  const handleSuccess = async () => {
    setIsCreating(false);
    setEditingTraining(null);
    await carregarTreinamentos();
  };

  // Abre o detalhamento de uma loja pelo nome (usado nos cards Top 5 e Radar de Risco)
  const handleOpenStoreByName = async (name: string) => {
    try {
      const url = `${API_BASE_URL}/api/lojas/explorador?data_inicio=${periodoDataInicio}&data_fim=${periodoDataFim}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const lojas: any[] = await res.json();
      const loja = lojas.find(
        (l) => l.nome?.toLowerCase() === name?.toLowerCase()
      );
      if (loja) {
        handleSelectStore(loja as any);
      }
    } catch (err) {
      console.error("Erro ao buscar loja pelo nome:", err);
    }
  };

  const openSettingsPage = (training: any) => {
    setEditingTraining(null);
    setSelectedTraining(null);
    setSelectedTrainingSettings(training);
    sessionStorage.setItem(
      "flamboyant.selectedTrainingId",
      String(training.id),
    );
    sessionStorage.setItem("flamboyant.selectedView", "settings");
  };

  const openEditingPage = (training: any) => {
    setSelectedTraining(null);
    setSelectedTrainingSettings(null);
    setEditingTraining(training);
    sessionStorage.removeItem("flamboyant.selectedTrainingId");
    sessionStorage.removeItem("flamboyant.selectedView");
  };

  const selectTrainingDetails = (training: any) => {
    setSelectedTraining(training);
    sessionStorage.setItem(
      "flamboyant.selectedTrainingId",
      String(training.id),
    );
    sessionStorage.setItem("flamboyant.selectedView", "details");
  };

  const filterOptions: {
    key: "todos" | "tema" | "segmento" | "data" | "conteudo" | "status";
    label: string;
  }[] = [
    { key: "todos", label: "Todos" },
    { key: "tema", label: "Tema" },
    { key: "segmento", label: "Segmento" },
    { key: "data", label: "Data" },
    { key: "conteudo", label: "Conteúdo" },
    { key: "status", label: "Status" },
  ];

  const handlePrevMonth = () => setCalendarMonth(subMonths(calendarMonth, 1));
  const handleNextMonth = () => setCalendarMonth(addMonths(calendarMonth, 1));

  const renderCalendarView = (filteredTrainings: typeof trainingsList) => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col mt-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 capitalize">
            {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevMonth}
              className="h-8 w-8 text-gray-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              className="h-8 w-8 text-gray-600"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-gray-500 uppercase"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[120px] bg-gray-200 gap-px">
          {days.map((day) => {
            const isSameMonthDay = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, now);
            const dayTrainings = filteredTrainings.filter((t) =>
              isSameDay(new Date(t.dataHora), day),
            );

            return (
              <div
                key={day.toString()}
                className={cn(
                  "bg-white p-2 flex flex-col gap-1 overflow-y-auto",
                  !isSameMonthDay && "bg-gray-50 text-gray-400",
                )}
              >
                <div className="flex justify-end mb-1">
                  <span
                    className={cn(
                      "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-[#8B1A1A] text-white" : "text-gray-700",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                {dayTrainings.map((t) => {
                  const isAgendado = new Date(t.dataHora) > now;
                  const pillClass = t.isCancelado
                    ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    : isAgendado
                      ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
                  const Icon = t.isCancelado
                    ? XCircle
                    : isAgendado
                      ? Clock
                      : CheckCircle2;

                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTrainingDetails(t)}
                      className={cn(
                        "text-left px-2 py-1 text-xs rounded-md border flex items-center gap-1.5 w-full truncate transition-colors",
                        pillClass,
                      )}
                      title={t.tema}
                    >
                      <Icon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{t.tema}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (selectedTraining) {
    return (
      <TrainingDetails
        training={selectedTraining}
        onBack={() => {
          setSelectedTraining(null);
          sessionStorage.removeItem("flamboyant.selectedTrainingId");
          sessionStorage.removeItem("flamboyant.selectedView");
        }}
        onOpenSettings={() => openSettingsPage(selectedTraining)}
        onEditTraining={() => openEditingPage(selectedTraining)}
        onUpdateAttendance={(id, list) => {
          setTrainingsList((prev) =>
            prev.map((t) => (t.id === id ? { ...t, attendanceList: list } : t)),
          );
          setSelectedTraining((prev: any) => ({
            ...prev,
            attendanceList: list,
          }));
        }}
      />
    );
  }

  if (selectedStore) {
    const storeForDetails = {
      id: 0,
      lojaId: selectedStore.id,
      name: selectedStore.nome || (selectedStore as any).Nome || "",
      luc: selectedStore.luc || (selectedStore as any).LUC || "",
      segment: selectedStore.segmento || (selectedStore as any).Segmento || "",
      manager:
        (selectedStore as any).gerente ||
        (selectedStore as any).Gerente ||
        "Não informado",
    };
    return (
      <StoreDetails
        store={storeForDetails}
        trainings={trainingsList}
        onBack={() => {
          handleSelectStore(null);
          handleSetActiveTab("dashboard");
        }}
        onSelectTraining={(training) => setSelectedTraining(training)}
        defaultDataInicio={periodoDataInicio}
        defaultDataFim={periodoDataFim}
      />
    );
  }

  if (selectedTrainingSettings) {
    return (
      <TrainingSettings
        training={selectedTrainingSettings}
        onBack={() => {
          setSelectedTraining(selectedTrainingSettings);
          setSelectedTrainingSettings(null);
          sessionStorage.setItem("flamboyant.selectedTrainingId", String(selectedTrainingSettings.id));
          sessionStorage.setItem("flamboyant.selectedView", "details");
        }}
        onEdit={() => openEditingPage(selectedTrainingSettings)}
      />
    );
  }

  if (isCreating || editingTraining) {
    const formData = editingTraining
      ? {
          ...editingTraining,
          data: editingTraining.dataHora
            ? editingTraining.dataHora.split("T")[0]
            : "",
          horarioInicio: editingTraining.hora || "",
          segmento: editingTraining.segmento || "Geral (Todos os Segmentos)",
        }
      : undefined;
    return (
      <TrainingForm
        initialData={formData}
        onBack={() => {
          setIsCreating(false);
          setEditingTraining(null);
        }}
        onSuccess={handleSuccess}
      />
    );
  }

  const totalPages = Math.ceil(filteredTrainings.length / itemsPerPage);
  const currentItems = filteredTrainings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  // 🟢 Função para redirecionar o usuário do gráfico direto para o calendário do mês clicado
  const handleChartBarClick = (data: any) => {
    if (!data || !data.name) return;

    // Procura o código do mês baseado na abreviação (ex: "Jan" -> "01", "Jun" -> "06")
    const mesEncontrado = mesesGrid.find(
      (m) =>
        m.abrev.toLowerCase() === data.name.toLowerCase() ||
        m.nome.toLowerCase() === data.name.toLowerCase(),
    );

    if (mesEncontrado) {
      // 1. Muda para a aba "Agenda e Lista"
      handleSetActiveTab("list");

      // 2. Garante que a visualização seja em modo "Calendário"
      handleSetViewMode("calendar");

      // 3. Move o ponteiro do mês do calendário para o mês correspondente (usando o ano selecionado no topo)
      const mesIndex = parseInt(mesEncontrado.cod) - 1; // Meses no JavaScript começam em 0
      setCalendarMonth(new Date(anoSelecionado, mesIndex, 1));

      // Opcional: Se quiser dar um feedback suave na tela
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <main
        className="flex-1 min-h-screen flex flex-col"
        style={{ backgroundColor: "#F7F4EF" }}
      >
        <Tabs
          value={activeTab}
          onValueChange={handleSetActiveTab}
          className="flex-1 flex flex-col w-full h-full"
        >
          {/* Header */}
          <div className="pt-6 px-4 md:px-8 bg-transparent relative z-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 relative z-20">
              <h1
                className="text-xl md:text-[1.5rem] font-semibold"
                style={{ color: "#1F2937" }}
              >
                Gestão de Treinamentos
              </h1>
              <div className="flex items-center w-full md:w-auto self-start md:self-auto relative z-30 pointer-events-auto">
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90 w-full md:w-auto shrink-0 min-h-[44px] cursor-pointer relative z-30"
                  style={{ backgroundColor: "#D93030" }}
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Novo Treinamento
                </button>
              </div>
            </div>
            <TabsList className="bg-white border border-gray-200 shadow-sm p-1 rounded-md inline-flex w-full sm:w-auto h-auto">
              <TabsTrigger
                value="list"
                className="px-4 py-2 text-sm font-medium text-gray-500 bg-transparent rounded-sm hover:text-red-600 transition-all data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none flex-1 sm:flex-none"
              >
                Agenda e Lista
              </TabsTrigger>
              <TabsTrigger
                value="dashboard"
                className="px-4 py-2 text-sm font-medium text-gray-500 bg-transparent rounded-sm hover:text-red-600 transition-all data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none flex-1 sm:flex-none"
              >
                Engajamento das Lojas
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="list"
            className="flex-1 flex flex-col m-0 p-0 outline-none data-[state=active]:flex pt-4"
          >
            <div className="px-4 md:px-8 mb-4 flex flex-col md:flex-row items-center gap-3 w-full justify-between">
              <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  onClick={() => handleSetViewMode("list")}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors",
                    viewMode === "list"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  <List className="w-4 h-4" /> Lista
                </button>
                <button
                  onClick={() => handleSetViewMode("calendar")}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors",
                    viewMode === "calendar"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  <Calendar className="w-4 h-4" /> Calendário
                </button>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex items-center bg-white border border-gray-200 rounded-lg hover:border-gray-300 focus-within:ring-2 focus-within:ring-[#D93030] focus-within:border-transparent transition-colors group w-full md:w-auto">
                  <div className="relative flex items-center flex-1 min-w-[120px]">
                    {activeFilter === "data" ? (
                      <Popover>
                        <PopoverAnchor asChild>
                          <div className="flex items-center w-full md:w-48 lg:w-56 pr-2">
                            <Input
                              type="text"
                              value={dateInput}
                              onChange={handleDateInputChange}
                              placeholder="DD/MM/AAAA"
                              className="pl-3 pr-2 py-2 text-sm focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 border-0 shadow-none bg-transparent w-full min-h-[44px] text-gray-900"
                              maxLength={10}
                            />
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-[#D93030] shrink-0 hover:bg-transparent"
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                          </div>
                        </PopoverAnchor>
                        <PopoverContent
                          align="start"
                          sideOffset={4}
                          className="w-auto p-0 bg-white shadow-md z-50"
                        >
                          <CalendarComponent
                            mode="single"
                            selected={dateQuery}
                            onSelect={(date) => {
                              setDateQuery(date);
                              setDateInput(
                                date
                                  ? format(date, "dd/MM/yyyy", { locale: ptBR })
                                  : "",
                              );
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <>
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none group-focus-within:text-[#D93030] transition-colors" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar..."
                          className="pl-9 pr-3 py-2 text-sm focus:outline-none bg-transparent w-full md:w-48 lg:w-56 min-h-[44px]"
                        />
                      </>
                    )}
                  </div>
                  <div className="h-5 w-px bg-gray-200 shrink-0" />
                  <div className="relative flex items-center shrink-0">
                    <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none group-focus-within:text-[#D93030] transition-colors hidden md:block" />
                    <select
                      value={activeFilter}
                      onChange={(e) => {
                        setActiveFilter(e.target.value as any);
                        setSearchQuery("");
                        setDateQuery(undefined);
                        setDateInput("");
                      }}
                      className="appearance-none bg-transparent text-gray-600 text-sm focus:outline-none cursor-pointer w-auto pl-3 md:pl-8 pr-8 py-2 hover:text-gray-900 transition-colors min-h-[44px]"
                    >
                      {filterOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 pointer-events-none group-focus-within:text-[#D93030] transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 md:px-8 pb-8 flex-1 flex flex-col">
              {viewMode === "calendar" ? (
                renderCalendarView(filteredTrainings)
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col">
                  <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2
                      className="text-gray-800"
                      style={{ fontSize: "0.9375rem", fontWeight: 600 }}
                    >
                      Próximos e Recentes
                    </h2>
                    <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
                      {filteredTrainings.length} eventos
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="hidden md:block w-full overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center justify-center gap-1.5">
                                <Tag className="w-3 h-3" /> Tema
                              </div>
                            </th>
                            <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center justify-center gap-1.5">
                                <Filter className="w-3 h-3" /> Segmento
                              </div>
                            </th>
                            <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center justify-center gap-1.5">
                                <Calendar className="w-3 h-3" /> Data
                              </div>
                            </th>
                            <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center justify-center gap-1.5">
                                <BookOpen className="w-3 h-3" /> Conteúdo
                              </div>
                            </th>
                            <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(isLoadingTrainings ||
                            trainingsError ||
                            currentItems.length === 0) && (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-6 py-8 text-center text-sm text-gray-500"
                              >
                                {isLoadingTrainings
                                  ? "Carregando treinamentos do banco de dados..."
                                  : trainingsError ||
                                    "Nenhum treinamento encontrado."}
                              </td>
                            </tr>
                          )}
                          {currentItems.map((row, idx) => {
                            const dataTreinamento = new Date(row.dataHora);
                            let status = "agendado";
                            if (row.isCancelado) status = "cancelado";
                            else if (dataTreinamento < now)
                              status = "concluido";

                            return (
                              <tr
                                key={row.id}
                                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx === currentItems.length - 1 ? "border-b-0" : ""}`}
                              >
                                <td
                                  className="px-6 py-4 cursor-pointer text-center"
                                  onClick={() => selectTrainingDetails(row)}
                                >
                                  <span className="text-sm font-medium text-gray-800">
                                    {row.tema}
                                  </span>
                                </td>
                                <td
                                  className="px-6 py-4 cursor-pointer text-center"
                                  onClick={() => selectTrainingDetails(row)}
                                >
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {row.segmento ||
                                      "Geral (Todos os Segmentos)"}
                                  </span>
                                </td>
                                <td
                                  className="px-6 py-4 cursor-pointer text-center"
                                  onClick={() => selectTrainingDetails(row)}
                                >
                                  <span className="inline-flex items-center justify-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                                    <Calendar className="w-3 h-3" /> {row.data}{" "}
                                    às {row.hora}
                                  </span>
                                </td>
                                <td
                                  className="px-6 py-4 cursor-pointer text-center"
                                  onClick={() => selectTrainingDetails(row)}
                                >
                                  <span className="text-sm text-gray-500 hover:text-gray-700 transition-colors line-clamp-2 md:line-clamp-none">
                                    {row.conteudo}
                                  </span>
                                </td>
                                <td
                                  className="px-6 py-4 text-center cursor-pointer"
                                  onClick={() => selectTrainingDetails(row)}
                                >
                                  <div className="flex justify-center items-center">
                                    {status === "concluido" && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
                                        Concluído
                                      </span>
                                    )}
                                    {status === "agendado" && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">
                                        Agendado
                                      </span>
                                    )}
                                    {status === "cancelado" && (
                                      <span
                                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 border border-red-200 whitespace-nowrap"
                                        style={{ color: "#D93030" }}
                                      >
                                        Cancelado
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTraining(row);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-[#D93030] hover:bg-red-50 rounded-md transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                                      title="Editar treinamento"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTrainingToDelete(row);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                                      title="Excluir treinamento"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden flex flex-col">
                      {(isLoadingTrainings ||
                        trainingsError ||
                        currentItems.length === 0) && (
                        <div className="p-6 text-center text-sm text-gray-500">
                          {isLoadingTrainings
                            ? "Carregando treinamentos do banco de dados..."
                            : trainingsError ||
                              "Nenhum treinamento encontrado."}
                        </div>
                      )}
                      {currentItems.map((row, idx) => {
                        const dataTreinamento = new Date(row.dataHora);
                        let status = "agendado";
                        if (row.isCancelado) status = "cancelado";
                        else if (dataTreinamento < now) status = "concluido";

                        return (
                          <div
                            key={row.id}
                            className={`p-4 border-b border-gray-100 active:bg-gray-50 transition-colors cursor-pointer ${idx === currentItems.length - 1 ? "border-b-0" : ""}`}
                            onClick={() => selectTrainingDetails(row)}
                          >
                            <div className="flex justify-between items-start mb-2 gap-3">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1">
                                  {row.tema}
                                </h3>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                  {row.segmento || "Geral (Todos os Segmentos)"}
                                </span>
                              </div>
                              <div className="shrink-0 flex items-center gap-2 mt-1">
                                {status === "concluido" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                                    Concluído
                                  </span>
                                )}
                                {status === "agendado" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                                    Agendado
                                  </span>
                                )}
                                {status === "cancelado" && (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-50 border border-red-200"
                                    style={{ color: "#D93030" }}
                                  >
                                    Cancelado
                                  </span>
                                )}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTraining(row);
                                    }}
                                    className="p-1 text-gray-400 hover:text-[#D93030] hover:bg-red-50 rounded-md transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                                    title="Editar treinamento"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTrainingToDelete(row);
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                                    title="Excluir treinamento"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1.5 mt-2">
                              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />{" "}
                                {row.data} às {row.hora}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="line-clamp-1">
                                  {row.conteudo}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="px-4 md:px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <p className="text-xs text-gray-400 text-center sm:text-left">
                      Mostrando {currentItems.length} de{" "}
                      {filteredTrainings.length} registros
                    </p>
                    <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 justify-center sm:justify-start">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap min-h-[44px]"
                      >
                        Anterior
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1.5 text-xs rounded-md transition-colors shrink-0 min-h-[44px] ${currentPage === page ? "text-white shadow-sm" : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"}`}
                            style={
                              currentPage === page
                                ? {
                                    backgroundColor: "#D93030",
                                    borderColor: "#D93030",
                                  }
                                : undefined
                            }
                          >
                            {page}
                          </button>
                        ),
                      )}
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(prev + 1, totalPages),
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap min-h-[44px]"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* PARTE DE FILTRAGEM DO DASHBOARD */}
          <TabsContent
            value="dashboard"
            className="flex-1 flex flex-col m-0 p-0 outline-none data-[state=active]:flex pt-4"
          >
            <div className="px-4 md:px-8 pb-8 space-y-6">
              <div className="flex flex-col gap-4 w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-50 pb-2">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Visão Geral do Shopping
                  </h2>
                </div>
                <div className="flex flex-wrap items-end gap-4 w-full">
                  {/* 1. Seleção do Modo do Filtro (Shadcn) */}
                  <div className="flex flex-col gap-1.5 w-full sm:w-[200px]">
                    <label className="text-xs font-semibold text-gray-500">
                      Tipo de Filtro
                    </label>
                    <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                      <SelectTrigger className="bg-white border-gray-200 text-sm">
                        <SelectValue placeholder="Tipo de Filtro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ano">Ano</SelectItem>
                        <SelectItem value="mes">Mês</SelectItem>
                        <SelectItem value="periodo_mes">
                          De Mês X até Mês Y
                        </SelectItem>
                        <SelectItem value="dia">Dia</SelectItem>
                        <SelectItem value="personalizado">
                          Período Customizado
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2. INPUT EM GRADE: Filtro por Ano */}
                  {(tipoFiltro === "ano" ||
                    tipoFiltro === "mes" ||
                    tipoFiltro === "periodo_mes") && (
                    <div className="flex flex-col gap-1.5 w-full sm:w-[130px]">
                      <label className="text-xs font-semibold text-gray-500">
                        Ano
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-gray-50 text-gray-700">
                            <span>{anoSelecionado}</span>
                            <span className="text-xs text-gray-400">▼</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="p-3 bg-white border border-gray-200 rounded-xl shadow-xl w-[210px] z-50">
                          <div className="grid grid-cols-3 gap-2">
                            {anosDisponiveis.map((ano) => (
                              <PopoverClose key={ano} asChild>
                                <button
                                  type="button"
                                  onClick={() => setAnoSelecionado(ano)}
                                  className={`h-10 text-xs font-semibold rounded-lg transition-colors border ${anoSelecionado === ano ? "bg-[#D93030] text-white border-[#D93030]" : "bg-white text-gray-700 border-gray-150 hover:bg-gray-50"}`}
                                >
                                  {ano}
                                </button>
                              </PopoverClose>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* 3. INPUT EM GRADE: Só um mês */}
                  {tipoFiltro === "mes" && (
                    <div className="flex flex-col gap-1.5 w-full sm:w-[150px]">
                      <label className="text-xs font-semibold text-gray-500">
                        Selecione o Mês
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-gray-50 text-gray-700">
                            <span>
                              {mesesGrid.find((m) => m.cod === mesSelecionado)
                                ?.nome || "Mês"}
                            </span>
                            <span className="text-xs text-gray-400">▼</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="p-3 bg-white border border-gray-200 rounded-xl shadow-xl w-[240px] z-50">
                          <div className="grid grid-cols-4 gap-2">
                            {mesesGrid.map((m) => (
                              <PopoverClose key={m.cod} asChild>
                                <button
                                  type="button"
                                  onClick={() => setMesSelecionado(m.cod)}
                                  className={`h-10 text-xs font-medium rounded-lg transition-colors border ${mesSelecionado === m.cod ? "bg-[#D93030] text-white border-[#D93030]" : "bg-white text-gray-700 border-gray-150 hover:bg-gray-50"}`}
                                >
                                  {m.abrev}
                                </button>
                              </PopoverClose>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* 4. INPUT EM GRADE: Mês X até Mês Y */}
                  {tipoFiltro === "periodo_mes" && (
                    <>
                      <div className="flex flex-col gap-1.5 w-full sm:w-[150px]">
                        <label className="text-xs font-semibold text-gray-500">
                          Mês Início
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-gray-50 text-gray-700">
                              <span>
                                {mesesGrid.find((m) => m.cod === mesInicio)
                                  ?.abrev || "Início"}
                              </span>
                              <span className="text-xs text-gray-400">▼</span>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="p-3 bg-white border border-gray-200 rounded-xl shadow-xl w-[240px] z-50">
                            <div className="grid grid-cols-4 gap-2">
                              {mesesGrid.map((m) => (
                                <PopoverClose key={m.cod} asChild>
                                  <button
                                    type="button"
                                    onClick={() => setMesInicio(m.cod)}
                                    className={`h-10 text-xs font-medium rounded-lg transition-colors border ${mesInicio === m.cod ? "bg-[#D93030] text-white border-[#D93030]" : "bg-white text-gray-700 border-gray-150 hover:bg-gray-50"}`}
                                  >
                                    {m.abrev}
                                  </button>
                                </PopoverClose>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="flex flex-col gap-1.5 w-full sm:w-[150px]">
                        <label className="text-xs font-semibold text-gray-500">
                          Mês Fim
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-gray-50 text-gray-700">
                              <span>
                                {mesesGrid.find((m) => m.cod === mesFim)
                                  ?.abrev || "Fim"}
                              </span>
                              <span className="text-xs text-gray-400">▼</span>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="p-3 bg-white border border-gray-200 rounded-xl shadow-xl w-[240px] z-50">
                            <div className="grid grid-cols-4 gap-2">
                              {mesesGrid.map((m) => (
                                <PopoverClose key={m.cod} asChild>
                                  <button
                                    type="button"
                                    onClick={() => setMesFim(m.cod)}
                                    className={`h-10 text-xs font-medium rounded-lg transition-colors border ${mesFim === m.cod ? "bg-[#D93030] text-white border-[#D93030]" : "bg-white text-gray-700 border-gray-150 hover:bg-gray-50"}`}
                                  >
                                    {m.abrev}
                                  </button>
                                </PopoverClose>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </>
                  )}

                  {/* 5. INPUTS EM POPOVER PREMIUM */}
                  {(tipoFiltro === "dia" || tipoFiltro === "personalizado") && (
                    <div className="flex flex-col gap-1.5 w-full sm:w-[170px]">
                      <label className="text-xs font-semibold text-gray-500">
                        {tipoFiltro === "dia"
                          ? "Selecione o Dia"
                          : "Data Inicial"}
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-gray-50 text-gray-700">
                            <span>
                              {dataInicioCustom
                                ? format(
                                    new Date(dataInicioCustom + "T00:00:00"),
                                    "dd/MM/yyyy",
                                  )
                                : "dd/mm/aaaa"}
                            </span>
                            <span className="text-xs text-gray-400">📅</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50"
                          align="start"
                        >
                          <DatePickerPremium
                            value={dataInicioCustom}
                            onChange={(newDate) => setDataInicioCustom(newDate)}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {tipoFiltro === "personalizado" && (
                    <div className="flex flex-col gap-1.5 w-full sm:w-[170px]">
                      <label className="text-xs font-semibold text-gray-500">
                        Data Final
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-gray-50 text-gray-700">
                            <span>
                              {dataFimCustom
                                ? format(
                                    new Date(dataFimCustom + "T00:00:00"),
                                    "dd/MM/yyyy",
                                  )
                                : "dd/mm/aaaa"}
                            </span>
                            <span className="text-xs text-gray-400">📅</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50"
                          align="start"
                        >
                          <DatePickerPremium
                            value={dataFimCustom}
                            onChange={(newDate) => setDataFimCustom(newDate)}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </div>

              {/* Top 4 Cards Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Taxa de Presença
                    </CardTitle>
                    <UserCheck className="h-4 w-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboardData?.taxaPresencaMedia ?? 0}%
                    </div>
                    <p className="text-xs text-green-600 font-medium mt-1">
                      Geral do período
                    </p>
                    <Progress
                      value={dashboardData?.taxaPresencaMedia ?? 0}
                      className="h-1.5 mt-4 bg-gray-100"
                      indicatorClassName="bg-[#D93030]"
                    />
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Lojas Impactadas
                    </CardTitle>
                    <Store className="h-4 w-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboardData?.totalLojasImpactadas ?? 0}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Lojas engajadas (de{" "}
                      {dashboardData?.totalLojasCadastradas ?? 0} totais)
                    </p>
                    <Progress
                      value={
                        dashboardData?.totalLojasCadastradas > 0
                          ? ((dashboardData?.totalLojasImpactadas ?? 0) /
                              dashboardData.totalLojasCadastradas) *
                            100
                          : 0
                      }
                      className="h-1.5 mt-4 bg-gray-100"
                      indicatorClassName="bg-[#D93030]"
                    />
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Média Colab. / Loja
                    </CardTitle>
                    <Users className="h-4 w-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboardData?.mediaColabPorLoja
                        ? Number(dashboardData.mediaColabPorLoja).toFixed(1)
                        : "0.0"}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Funcionários por loja engajada
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Total de Participações
                    </CardTitle>
                    <Award className="h-4 w-4 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboardData?.totalParticipacoes ?? 0}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Capacitações no período
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Row 2: Top 5 Lojas Engajadas e Radar de Risco */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <Card className="bg-white border-gray-200 shadow-sm flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" /> Top 5 Lojas
                      Engajadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="flex flex-col justify-between flex-1 gap-y-3">
                      {(dashboardData?.topEngajamento ?? []).length > 0 ? (
                        (dashboardData?.topEngajamento ?? []).map(
                          (loja: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-1 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors group"
                              onClick={() => handleOpenStoreByName(loja.name)}
                              title={`Ver detalhes de ${loja.name}`}
                            >
                              <div className="flex items-center gap-4">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-sm font-bold text-gray-700 group-hover:bg-red-100 group-hover:text-[#D93030] transition-colors">
                                  {i + 1}
                                </span>
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-gray-900 group-hover:text-[#D93030] transition-colors">
                                    {loja.name}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {loja.total}{" "}
                                    {loja.total === 1
                                      ? "treinamento"
                                      : "treinamentos"}{" "}
                                    no período
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D93030] transition-colors" />
                            </div>
                          ),
                        )
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4 my-auto">
                          Nenhum dado no período.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-[#D93030]" /> Radar
                      de Risco (Lojas Omissas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(dashboardData?.radarRisco ?? []).length > 0 ? (
                        (dashboardData?.radarRisco ?? []).map(
                          (loja: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 hover:border-red-200 transition-colors group"
                              onClick={() => handleOpenStoreByName(loja.name)}
                              title={`Ver detalhes de ${loja.name}`}
                            >
                              <div>
                                <p className="text-sm font-bold text-gray-900 group-hover:text-[#D93030] transition-colors">
                                  {loja.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Última presença:{" "}
                                  {loja.ultimaPresenca || "Nunca"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-red-500">
                                  {loja.faltas ?? 0}{" "}
                                  {loja.faltas === 1 ? "falta" : "faltas"}
                                </span>
                                <ChevronRight className="w-4 h-4 text-red-300 group-hover:text-[#D93030] transition-colors" />
                              </div>
                            </div>
                          ),
                        )
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Sem lojas em risco no período.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Row 3: Evolução de Participação */}
              <Card className="mt-6 bg-white border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#D93030]" /> Evolução de
                    Participação
                  </CardTitle>
                  <CardDescription>
                    Comparativo de inscritos x presentes no período selecionado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full mt-4">
                    {(dashboardData?.evolucaoMensal ?? []).length > 0 ? (
                      <ResponsiveContainer
                        key={`rc-${tipoFiltro}-${anoSelecionado}`}
                        width="100%"
                        height="100%"
                      >
                        <BarChart
                          id="participation-chart"
                          data={dashboardData.evolucaoMensal}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          onClick={(state) => {
                            if (
                              state &&
                              state.activePayload &&
                              state.activePayload.length > 0
                            ) {
                              handleChartBarClick(
                                state.activePayload[0].payload,
                              );
                            }
                          }}
                        >
                          <CartesianGrid
                            key="grid"
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#E5E7EB"
                          />
                          <XAxis
                            key="xaxis"
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#6B7280" }}
                            dy={10}
                          />
                          <YAxis
                            key="yaxis"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#6B7280" }}
                          />
                          <Tooltip
                            key="tooltip"
                            cursor={{ fill: "#F3F4F6" }}
                            contentStyle={{
                              borderRadius: "8px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                          />
                          <Legend
                            key="legend"
                            iconType="circle"
                            wrapperStyle={{ paddingTop: "20px" }}
                          />
                          <Bar
                            key="bar1"
                            dataKey="inscritos"
                            name="Inscritos"
                            fill="#E5E7EB"
                            radius={[4, 4, 0, 0]}
                            barSize={32}
                            cursor="pointer"
                            className="hover:opacity-80 transition-opacity"
                          />
                          <Bar
                            key="bar2"
                            dataKey="presentes"
                            name="Presentes"
                            fill="#D93030"
                            radius={[4, 4, 0, 0]}
                            barSize={32}
                            cursor="pointer"
                            className="hover:opacity-80 transition-opacity"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
                        Sem dados para o período.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Store Explorer */}
              <StoreExplorer
                dataInicio={periodoDataInicio}
                dataFim={periodoDataFim}
                onSelectStore={(loja) => handleSelectStore(loja)}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Modal */}
        {trainingToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Tem certeza que deseja excluir?
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Você está prestes a remover o treinamento{" "}
                  <strong>{trainingToDelete.tema}</strong>. Atenção: Esta ação
                  não poderá ser desfeita.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setTrainingToDelete(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-200 min-h-[44px]"
                    style={{ backgroundColor: "#D93030" }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
