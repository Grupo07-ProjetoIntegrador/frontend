import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, UploadCloud, FileSpreadsheet, CheckCircle2, User, Building, Calendar, BookOpen, UserPlus, Trash2, X, XCircle, Users, CheckSquare, Store, Link, Copy, Settings2, Edit2, Plus, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { supabase } from "../lib/supabaseClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

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
  };
  onBack: () => void;
  onUpdateAttendance?: (id: number | string, list: any[]) => void;
  onOpenSettings?: () => void;
  onEditTraining?: () => void;
}
export function TrainingDetails({ training, onBack, onUpdateAttendance, onOpenSettings, onEditTraining }: TrainingDetailsProps) {
  console.log("👀 Dados brutos do Treinamento que chegaram no Details:", training);
  
  const API_BASE_URL = "https://jpmallflamboyant.live/api";
  const now = new Date();
  const isConcluido = training.dataHora ? new Date(training.dataHora) < now : false;
  const isAgendado = training.dataHora ? new Date(training.dataHora) > now : false;

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); 

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token || "";

      const url = `https://jpmallflamboyant.live/api/relatorios/treinamento/chamada?treinamento_id=${training.id}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar PDF.");
      }

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
  const [attendees, setAttendees] = useState<{ id: number; luc: string; loja: string; representante: string; status: string }[]>([]);
  const [attendeeToDelete, setAttendeeToDelete] = useState<{ id: string | number; nome: string } | null>(null);
  const [formLinks, setFormLinks] = useState({ view: "", edit: "" });
  const [formCreator, setFormCreator] = useState({ name: "", email: "" });
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isFormGenerating, setIsFormGenerating] = useState(false);
  const [isFormDeleting, setIsFormDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [showAttendanceBlock, setShowAttendanceBlock] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(training.attendanceList && training.attendanceList.length > 0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAttendee, setNewAttendee] = useState({ luc: "", loja: "", representante: "", status: "Presente" });

  const updateAttendees = (newList: any[]) => {
    setAttendees(newList);
    if (onUpdateAttendance) {
      onUpdateAttendance(training.id, newList);
    }
  };
  
  const fetchPresencas = useCallback(async () => {
    try {
      // 1. Mostra qual ID o React está tentando buscar
      console.log("🔎 Buscando presenças para o treinamento ID:", training.id);
      
      const response = await fetch(`https://jpmallflamboyant.live/api/treinamentos/presencas?treinamento_id=${training.id}&_t=${Date.now()}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // 2. Mostra exatamente o que o Banco de Dados devolveu
        console.log("✅ Dados recebidos do banco:", data);
        
        setAttendees(data);
        
        if (onUpdateAttendance) {
          onUpdateAttendance(training.id, data);
        }
      } else {
        // 3. Se o Go barrar a requisição (ex: porque o ID é 1 em vez de UUID), o erro aparece aqui!
        console.error("🚨 O Servidor Go recusou a busca. Status:", response.status);
      }
    } catch (error) {
      console.error("🚨 Erro grave de conexão:", error);
    }
  }, [training.id, onUpdateAttendance]);

  const processFile = async (file: File) => {
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');

    if (!isCsv && !isXlsx) {
      toast.error("Formato inválido. Por favor, envie uma planilha .csv ou .xlsx");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("planilha", file);

    try {
      const response = await fetch(`https://jpmallflamboyant.live/api/treinamentos/upload?treinamento_id=${training.id}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Falha ao processar a planilha.");
      }

      const data = await response.json();
      toast.success(data.mensagem);

      // Aguarda 400 milissegundos para dar tempo do Supabase consolidar a escrita dos dados
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Agora sim busca a lista atualizada do banco
      await fetchPresencas();

    } catch (error) {
      console.error(error);
      toast.error("Erro ao importar a planilha. Verifique se as lojas do arquivo existem no sistema.");
    } finally {
      setIsUploading(false);
    }
  };
  
  // Cria uma referência para guardar qual ID já foi carregado e impedir loops
  const idCarregadoRef = useRef<string | number | null>(null);

  useEffect(() => {
    // Se o ID do treinamento atual for igual ao que já buscamos, bloqueia a chamada (mata o loop!)
    if (idCarregadoRef.current === training?.id) {
      return;
    }

    if (training && training.id) {
      idCarregadoRef.current = training.id; // Registra que estamos buscando este ID
      fetchPresencas();
    }
  }, [training?.id, fetchPresencas]);  

  const fetchFormLink = useCallback(async () => {
    setIsFormLoading(true);
    setFormError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/treinamentos/formulario?id=${training.id}`);

      if (response.status === 404) {
        setFormLinks({ view: "", edit: "" });
        setFormCreator({ name: "", email: "" });
        return false;
      }

      if (!response.ok) {
        throw new Error("Erro ao buscar formulário");
      }

      const payload = await response.json();
      const viewLink = payload.url_formulario || "";
      const editLink = payload.url_edicao || "";
      const creatorName = payload.creator_name || "";
      const creatorEmail = payload.creator_email || "";
      setFormLinks({
        view: viewLink,
        edit: editLink,
      });
      setFormCreator({ name: creatorName, email: creatorEmail });
      return !!viewLink;
    } catch (error) {
      console.error("Erro ao buscar link do formulário:", error);
      setFormError("Nao foi possivel carregar o link do formulário.");
      return false;
    } finally {
      setIsFormLoading(false);
    }
  }, [API_BASE_URL, training.id]);

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

  const handleGenerateForm = async () => {
    setIsFormGenerating(true);
    setFormError("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || "";
      const url = `${API_BASE_URL}/api/treinamentos/gerar-formulario?id=${training.id}` + (userId ? `&user_id=${userId}` : "");
      const response = await fetch(url, {
        method: "POST",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao gerar formulario");
      }

      toast.info("Geracao do formulário iniciada.");
    } catch (error) {
      console.error("Erro ao gerar formulário:", error);
      toast.error("Nao foi possivel iniciar a geracao do formulário.");
      setIsFormGenerating(false);
    }
  };

  const handleRegenerateForm = async () => {
    setIsFormGenerating(true);
    setFormError("");
    setFormLinks({ view: "", edit: "" });
    setFormCreator({ name: "", email: "" });

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || "";
      const url = `${API_BASE_URL}/api/treinamentos/regerar-formulario?id=${training.id}` + (userId ? `&user_id=${userId}` : "");
      const response = await fetch(url, {
        method: "POST",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao regerar formulário");
      }

      const payload = await response.json().catch(() => null);
      if (payload && payload.drive_deleted === false) {
        toast.info("Regeracao iniciada. O arquivo antigo no Drive pode ter permanecido.");
      } else {
        toast.info("Regeracao do formulário iniciada.");
      }
    } catch (error) {
      console.error("Erro ao regerar formulário:", error);
      toast.error("Não foi possivel regerar o formulário.");
      setIsFormGenerating(false);
    }
  };

  const handleDeleteForm = async () => {
    setIsFormDeleting(true);
    setFormError("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || "";
      const url = `${API_BASE_URL}/api/treinamentos/apagar-formulario?id=${training.id}` + (userId ? `&user_id=${userId}` : "");
      const response = await fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao apagar formulário");
      }

      const payload = await response.json().catch(() => null);
      setFormLinks({ view: "", edit: "" });
      setFormCreator({ name: "", email: "" });
      if (payload && payload.drive_deleted === false) {
        toast.info("Link removido no sistema, mas o arquivo no Drive pode ter permanecido.");
      } else {
        toast.success("Formulário removido.");
      }
    } catch (error) {
      console.error("Erro ao apagar formulário:", error);
      toast.error("Não foi possivel apagar o formulário.");
    } finally {
      setIsFormDeleting(false);
    }
  };

  const handleCopyLink = async (value: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      toast.success("Link copiado!");
    } catch (error) {
      console.error("Erro ao copiar link:", error);
      toast.error("Nao foi possivel copiar o link.");
    }
  };

  const handleAddAttendee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação inicial do front
    if (!newAttendee.luc || !newAttendee.loja || !newAttendee.representante || !newAttendee.status) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    try {
      // Envia os dados estruturados para o backend em Go
      const response = await fetch("https://jpmallflamboyant.live/api/api/treinamentos/presencas/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          treinamento_id: training.id,
          luc: newAttendee.luc.trim(),
          representante: newAttendee.representante.trim(),
          status: newAttendee.status
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Participante adicionado com sucesso!");
        
        // Limpa o formulário do modal e fecha ele
        setNewAttendee({ luc: "", loja: "", representante: "", status: "Presente" });
        setIsAddModalOpen(false);

        // Dá um pequeno intervalo e força a atualização da lista trazendo o dado real do banco
        await new Promise((resolve) => setTimeout(resolve, 300));
        await fetchPresencas(); 
      } else {
        // Exibe o erro retornado pelo Go (ex: se o LUC digitado não existir)
        toast.error(data.erro || "Falha ao adicionar participante.");
      }
    } catch (error) {
      console.error("Erro ao conectar com o servidor:", error);
      toast.error("Erro de conexão com o servidor Go.");
    }
  };

  const handleRemoveAttendee = async (id: string | number) => {
    try {
      const response = await fetch(`https://jpmallflamboyant.live/api/api/treinamentos/presencas/deletar?id=${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Participante removido com sucesso!");
        setAttendeeToDelete(null); // Fecha o modal limpando o estado
        await fetchPresencas();    // Atualiza a tabela do banco
      } else {
        toast.error(data.erro || "Falha ao remover participante do banco.");
      }
    } catch (error) {
      console.error("Erro ao conectar com o servidor:", error);
      toast.error("Erro de conexão com o servidor Go.");
    }
  };

  // const handleRemoveAttendee = async (id: string | number) => {
  //   // 1. Mostra a mensagem de confirmação nativa do navegador
  //   const confirmou = window.confirm("Tem certeza que deseja remover esta presença do banco de dados?");
    
  //   if (!confirmou) return; // Se o usuário clicar em cancelar, interrompe aqui

  //   try {
  //     // 2. Faz a requisição DELETE para a nova rota do seu Go
  //     const response = await fetch(`https://jpmallflamboyant.live/api/api/treinamentos/presencas/deletar?id=${id}`, {
  //       method: "DELETE",
  //       headers: {
  //         "Content-Type": "application/json",
  //       }
  //     });

  //     const data = await response.json();

  //     if (response.ok) {
  //       toast.success("Participante removido com sucesso!");
        
  //       // 3. Atualiza a lista na tela trazendo os dados zerados e atualizados do banco Go
  //       await fetchPresencas();
  //     } else {
  //       toast.error(data.erro || "Falha ao remover participante do banco.");
  //     }
  //   } catch (error) {
  //     console.error("Erro ao conectar com o servidor:", error);
  //     toast.error("Erro de conexão com o servidor Go.");
  //   }
  // }; 
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
    e.target.value = '';
  };

  const ROOM_CAPACITY = training.capacidade_maxima ? Number(training.capacidade_maxima) : 50;;
  const totalInscritos = attendees.length;   
  const totalPresentes = attendees.filter(
    (a) => a.status?.toUpperCase() === "PRESENTE"
  ).length;    
  const comparecimentoPercent = totalInscritos > 0 ? Math.round((totalPresentes / totalInscritos) * 100) : 0;   
  const ocupacaoPercent = Math.min(100, Math.round((totalPresentes / ROOM_CAPACITY) * 100)); 
  const lojasUnicas = new Set(attendees.map((a) => a.loja?.trim().toUpperCase()).filter(Boolean)).size; 

  
  return (
    <div className="flex-1 min-h-screen flex flex-col p-4 md:p-8 overflow-y-auto" style={{ backgroundColor: "#F7F4EF" }}>
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
              <h1 className="text-2xl md:text-3xl mb-2 md:mb-3 leading-tight" style={{ color: "#8B1A1A" }}>
                Palestra: {training.tema}
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 shrink-0" style={{ color: "#D93030" }} />
                  {training.data} às {training.hora}
                </span>
                <span className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full shrink-0" />
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 shrink-0" style={{ color: "#D93030" }} />
                  <span className="line-clamp-2 sm:line-clamp-1">{training.conteudo}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
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
          
          {/* Card 1: Comparecimento */}
          <Card className="bg-white border-gray-200 shadow-sm transition-all duration-700">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">Comparecimento</CardTitle>
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

          {/* Card 2: Ocupação da Sala */}
          <Card className="bg-white border-gray-200 shadow-sm transition-all duration-700">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">Ocupação da Sala</CardTitle>
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

          {/* Card 3: Lojas Representadas */}
          <Card className="bg-white border-gray-200 shadow-sm transition-all duration-700">
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">Lojas Representadas</CardTitle>
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
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <Card className={`bg-white border-gray-200 shadow-sm transition-all duration-700 ease-in-out ${isListEmpty ? 'opacity-60' : 'opacity-100'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">Comparecimento</CardTitle>
              <Users className="h-3.5 w-3.5 text-gray-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-xl font-bold text-gray-900 transition-opacity duration-500 delay-100 ${isListEmpty ? 'opacity-50' : 'opacity-100'}`}>
                {!isListEmpty ? `${comparecimentoPercent}%` : '--'}
              </div>
              <p className={`text-[11px] text-muted-foreground mt-0.5 transition-opacity duration-500 delay-200 ${isListEmpty ? 'opacity-50' : 'opacity-100'}`}>
                {!isListEmpty ? `${totalPresentes} presentes / ${totalInscritos} inscritos` : 'Aguardando dados...'}
              </p>
            </CardContent>
          </Card>

          <Card className={`bg-white border-gray-200 shadow-sm transition-all duration-700 ease-in-out ${isListEmpty ? 'opacity-60' : 'opacity-100'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">Ocupação da Sala</CardTitle>
              <CheckSquare className="h-3.5 w-3.5 text-gray-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-xl font-bold text-gray-900 transition-opacity duration-500 delay-100 ${isListEmpty ? 'opacity-50' : 'opacity-100'}`}>
                {!isListEmpty ? `${ocupacaoPercent}%` : '--'}
              </div>
              <p className={`text-[11px] text-muted-foreground mt-0.5 transition-opacity duration-500 delay-200 ${isListEmpty ? 'opacity-50' : 'opacity-100'}`}>
                {!isListEmpty ? `${totalPresentes} ocupadas / ${ROOM_CAPACITY} vagas` : 'Aguardando dados...'}
              </p>
            </CardContent>
          </Card>

          <Card className={`bg-white border-gray-200 shadow-sm transition-all duration-700 ease-in-out ${isListEmpty ? 'opacity-60' : 'opacity-100'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-gray-600">Lojas Representadas</CardTitle>
              <Store className="h-3.5 w-3.5 text-gray-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-xl font-bold text-gray-900 transition-opacity duration-500 delay-100 ${isListEmpty ? 'opacity-50' : 'opacity-100'}`}>
                {!isListEmpty ? lojasUnicas : '--'}
              </div>
              <p className={`text-[11px] text-muted-foreground mt-0.5 transition-opacity duration-500 delay-200 ${isListEmpty ? 'opacity-50' : 'opacity-100'}`}>
                {!isListEmpty ? 'Lojas diferentes nesta turma' : 'Aguardando dados...'}
              </p>
            </CardContent>
          </Card>
        </div> */}

        {isAgendado && attendees.length === 0 && !showAttendanceBlock ? (
          <Card className="bg-gray-50/50 border-dashed border-2 border-gray-200 shadow-none mb-8 w-full flex-1 flex">
            <CardContent className="flex flex-col items-center justify-center py-16 w-full text-center flex-1">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-5 shadow-sm border border-gray-100">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Treinamento Agendado</h3>
              <p className="text-sm text-gray-500 max-w-md mb-8">
                Este treinamento ainda não ocorreu. A lista de presença será disponibilizada após a sua realização.
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
                isDragging ? "border-red-500 bg-red-50" : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              {/* Input Oculto */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv, .xlsx"
                onChange={handleFileInput}
              />

              <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragging ? "text-red-500" : "text-gray-400"}`} />

              <h3 className="text-lg font-semibold" style={{ color: "#1F2937" }}>
                Importar Lista de Presença
              </h3>

              <p className="text-sm text-gray-500 mt-1 text-center max-w-md">
                Arraste e solte o arquivo da lista de presença (CSV ou XLSX) ou clique para selecionar.
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

            {/* Upload Section / Lista Consolidada */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-8">
              {/*Cabecalho da tabela*/}
              <div className="p-4 md:p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Lista de Presença Consolidada
                  </h3>
                  {/*O react conta quantas pessoas tem na lista automaticamente*/}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                    {attendees.length} presenças registradas
                  </span>
                </div>
                <button onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                  <Plus className="w-4 h-4" /> Adicionar Manualmente
                </button>
              </div>
              {/*Corpo da tabela*/}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">LUC</th>
                      <th className="px-6 py-3 font-medium">Loja</th>
                      <th className="px-6 py-3 font-medium">Representante</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {/* Se alista estiver vazia, mostra mensagem amigavel*/}
                    {attendees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          Nenhuma presença registrada ainda. Faça o upload da planilha ou adicione manualmente.
                        </td>
                      </tr>
                    ) : (
                      /* Se a lista tiver dados, o MAP desenha cada linha baseada no Banco de Dados!*/
                      attendees.map((attendee, index) => (
                        <tr key={attendee.id || index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{attendee.luc}</td>
                          <td className="px-6 py-4 text-gray-600">{attendee.loja}</td>
                          <td className="px-6 py-4 text-gray-600">{attendee.representante}</td>
                          <td className="px-6 py-4">
                            {/* Muda a cor da pilula de acordo com o status */}
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              attendee.status === "PRESENTE" || attendee.status === "Presente"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              }`}>
                                {attendee.status}
                                </span>                            
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => setAttendeeToDelete({ id: attendee.id, nome: attendee.representante })}
                                    className="text-gray-400 hover:text-red-600 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                    title="Remover presença"
                                  >
                                    <Trash2 className="w-4 h-4" />
                            </button>                            
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
                <h3 className="text-lg font-semibold text-gray-900">Adicionar Participante</h3>
                <p className="text-sm text-gray-500 mt-1">Insira os dados do lojista manualmente.</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAttendee} className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="luc" className="text-sm font-medium" style={{ color: "#2A1A1A" }}>LUC</label>
                  <input
                    id="luc"
                    required
                    value={newAttendee.luc}
                    onChange={(e) => setNewAttendee({ ...newAttendee, luc: e.target.value })}
                    placeholder="Ex: LUC-101"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-colors text-sm text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="loja" className="text-sm font-medium" style={{ color: "#2A1A1A" }}>Nome da Loja</label>
                  <input
                    id="loja"
                    required
                    value={newAttendee.loja}
                    onChange={(e) => setNewAttendee({ ...newAttendee, loja: e.target.value })}
                    placeholder="Ex: O Boticário"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-colors text-sm text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="representante" className="text-sm font-medium" style={{ color: "#2A1A1A" }}>Nome do Representante</label>
                  <input
                    id="representante"
                    required
                    value={newAttendee.representante}
                    onChange={(e) => setNewAttendee({ ...newAttendee, representante: e.target.value })}
                    placeholder="Ex: Ana Silva"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-colors text-sm text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="status" className="text-sm font-medium" style={{ color: "#2A1A1A" }}>Status</label>
                  <select
                    id="status"
                    required
                    value={newAttendee.status}
                    onChange={(e) => setNewAttendee({ ...newAttendee, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C4151F]/20 focus:border-[#C4151F] transition-colors text-sm text-gray-900 bg-white"
                  >
                    <option value="Presente">Presente</option>
                    <option value="Não Presente">Ausente</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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

      {/* Modal Lindo de Confirmação de Deleção */}
      <AlertDialog open={!!attendeeToDelete} onOpenChange={(open) => !open && setAttendeeToDelete(null)}>
        <AlertDialogContent className="bg-white rounded-lg max-w-sm w-full p-6 border border-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-gray-900">
              Remover Participante?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-500 mt-2">
              Você está prestes a remover a presença de <strong>{attendeeToDelete?.nome}</strong>. Esta ação não poderá ser desfeita no banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex items-center justify-end gap-3">
            <AlertDialogCancel className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => attendeeToDelete && handleRemoveAttendee(attendeeToDelete.id)}
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
