import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeft, BookOpen, Calendar, Copy, Download, Edit2, Filter, Link, Mail, Printer, QrCode, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";
import QRCode from "react-qr-code";
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

export interface TrainingSettingsProps {
  training: {
    id: number | string;
    tema: string;
    data: string;
    hora: string;
    conteudo: string;
    dataHora?: string;
    segmento?: string;
    segmentoAlvo?: string;
    descricao?: string;
    objetivo?: string;
    local?: string;
  };
  onBack: () => void;
  onEdit: () => void;
}

type DisparoDestinatario = {
  id: string;
  nome: string;
  email: string;
  segmento: string;
};

export function TrainingSettings({ training, onBack, onEdit }: TrainingSettingsProps) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  const [formLinks, setFormLinks] = useState({ view: "", edit: "" });
  const [formCreator, setFormCreator] = useState({ name: "", email: "" });
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isFormGenerating, setIsFormGenerating] = useState(false);
  const [isFormDeleting, setIsFormDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [dispatchMode, setDispatchMode] = useState<"individual" | "segmento_loja" | "segmento_treinamento">("individual");
  const [recipientDraft, setRecipientDraft] = useState({ nome: "", email: "", segmento: "" });
  const [recipients, setRecipients] = useState<DisparoDestinatario[]>([]);
  const [allStores, setAllStores] = useState<Array<{ id: string; nome: string; email: string; segmento?: string }>>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [dispatchSegmentFilter, setDispatchSegmentFilter] = useState("all");
  const [isDispatching, setIsDispatching] = useState(false);
  const [isImportingStores, setIsImportingStores] = useState(false);
  const autocheckinQrRef = useRef<HTMLDivElement>(null);
  const formQrRef = useRef<HTMLDivElement>(null);

  const trainingSegment = training.segmento || training.segmentoAlvo || "";

  // Lista fixa de segmentos para 'segmento_treinamento'
  const trainingSegmentOptions = useMemo(() => (
    [
      { value: "geral", label: "Geral" },
      { value: "lojas", label: "Lojas" },
      { value: "alimentação", label: "Alimentação" },
      { value: "academia", label: "Academia" },
    ]
  ), []);

  // Unique segments coming from the lojas in DB (used when dispatchMode === 'segmento_loja')
  const uniqueStoreSegments = useMemo(() => {
    const setSeg = new Set<string>();
    allStores.forEach((s) => {
      const seg = (s.segmento || "").trim();
      if (seg) setSeg.add(seg);
    });
    return Array.from(setSeg).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [allStores]);

  const segmentOptions = useMemo(() => {
    if (dispatchMode === "segmento_loja") {
      return uniqueStoreSegments.map((s) => ({ value: s, label: s }));
    }
    if (dispatchMode === "segmento_treinamento") {
      return trainingSegmentOptions;
    }
    return [];
  }, [dispatchMode, uniqueStoreSegments, trainingSegmentOptions]);

  const nameSuggestions = useMemo(() => {
    if (dispatchMode !== "individual") return [];

    const query = recipientDraft.nome.trim().toLowerCase();
    if (!query) return [];

    return allStores
      .filter((store) => {
        const storeName = (store.nome || "").trim().toLowerCase();
        return storeName.includes(query);
      })
      .slice(0, 8);
  }, [allStores, dispatchMode, recipientDraft.nome]);

  const visibleRecipients = useMemo(() => {
    const normalizedFilter = dispatchSegmentFilter.trim().toLowerCase();

    return recipients.filter((recipient) => {
      const recipientSegment = (recipient.segmento || "").trim().toLowerCase();

      if (dispatchMode === "segmento_treinamento") {
        // prefer explicit filter from the UI, fallback to training.segmento
        const target = normalizedFilter && normalizedFilter !== "all"
          ? normalizedFilter
          : (trainingSegment ? trainingSegment.trim().toLowerCase() : "");
        if (!target) return true;
        if (target === "geral" || target === "all") return true; // 'Geral' significa todos
        if (target === "lojas") {
          return recipientSegment !== "alimentação" && recipientSegment !== "academia" && recipientSegment !== "alimentacao";
        }
        return recipientSegment === target;
      }

      if (normalizedFilter === "all") return true;

      if (normalizedFilter === "lojas") {
        return recipientSegment !== "alimentação" && recipientSegment !== "academia" && recipientSegment !== "alimentacao";
      }

      return recipientSegment === normalizedFilter;
    });
  }, [dispatchMode, dispatchSegmentFilter, recipients, trainingSegment]);

  const autocheckinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/autocheckin?treinamento_id=${training.id}`;
  }, [training.id]);

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
      setFormLinks({
        view: payload.url_formulario || "",
        edit: payload.url_edicao || "",
      });
      setFormCreator({
        name: payload.creator_name || "",
        email: payload.creator_email || "",
      });
      return !!payload.url_formulario;
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

  useEffect(() => {
    if (dispatchMode === "segmento_treinamento" && trainingSegment) {
      const t = trainingSegment.trim().toLowerCase();
      if (t === "geral") setDispatchSegmentFilter("all");
      else if (t === "lojas") setDispatchSegmentFilter("lojas");
      else if (t === "alimentação" || t === "alimentacao") setDispatchSegmentFilter("alimentação");
      else if (t === "academia") setDispatchSegmentFilter("academia");
      else setDispatchSegmentFilter("all");
    }
  }, [dispatchMode, trainingSegment]);

  // When switching modes, adjust the visible filter default
  useEffect(() => {
    if (dispatchMode === "segmento_loja") {
      if (uniqueStoreSegments.length > 0) setDispatchSegmentFilter(uniqueStoreSegments[0]);
      else setDispatchSegmentFilter("");
    } else if (dispatchMode === "segmento_treinamento") {
      setDispatchSegmentFilter("geral");
    } else {
      setDispatchSegmentFilter("all");
    }
  }, [dispatchMode, uniqueStoreSegments]);

  const handleRecipientNameChange = (value: string) => {
    setRecipientDraft((current) => ({ ...current, nome: value }));

    const q = value.trim().toLowerCase();
    if (!q) return;

    // try exact or startsWith match in allStores
    const match = allStores.find((s) => (s.nome || "").toLowerCase() === q)
      || allStores.find((s) => (s.nome || "").toLowerCase().startsWith(q))
      || allStores.find((s) => (s.nome || "").toLowerCase().includes(q));

    if (match) {
      setRecipientDraft((current) => ({ ...current, email: match.email || current.email || "", segmento: match.segmento || current.segmento || "" }));
    }
  };

  const handleImportStores = useCallback(async () => {
    setIsImportingStores(true);
    try {
      const url = `${API_BASE_URL}/api/lojas`;
      let lojas: Array<{ id: string; nome: string; email: string; segmento?: string }> = [];

      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "");
          throw new Error(errorText || "Erro ao buscar lojas");
        }

        lojas = await resp.json();
      } catch (backendError) {
        console.warn("Backend indisponível para listar lojas, tentando Supabase diretamente.", backendError);

        const { data, error } = await supabase
          .from("lojas")
          .select("id, nome, email, segmento")
          .eq("status", true)
          .not("email", "is", null)
          .neq("email", "");

        if (error) {
          throw error;
        }

        lojas = data || [];
      }

      const mapped: DisparoDestinatario[] = lojas.map((l) => ({ id: l.id, nome: l.nome, email: l.email, segmento: l.segmento || '' }));
      setAllStores(lojas.map((l) => ({ id: l.id, nome: l.nome, email: l.email, segmento: l.segmento })));
      setRecipients(mapped);
      setSelectedRecipientIds(mapped.map(m => m.id));
      toast.success(`Importadas ${mapped.length} lojas com e-mail.`);
    } catch (e) {
      console.error(e);
      toast.error('Nao foi possivel importar lojas com e-mail. Verifique o backend ou o acesso ao Supabase.');
    } finally {
      setIsImportingStores(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    handleImportStores();
  }, [handleImportStores]);

  const handleAddRecipient = () => {
    const nome = recipientDraft.nome.trim();
    const email = recipientDraft.email.trim();
    const segmento = recipientDraft.segmento.trim();

    if (!email) {
      toast.error("Informe ao menos o e-mail do destinatário.");
      return;
    }

    if (recipients.some((recipient) => recipient.email.toLowerCase() === email.toLowerCase())) {
      toast.error("Esse e-mail já foi adicionado na lista.");
      return;
    }

    const id = crypto.randomUUID();
    setRecipients((current) => [...current, { id, nome, email, segmento }]);
    setSelectedRecipientIds((current) => [...current, id]);
    setRecipientDraft({ nome: "", email: "", segmento: "" });
    toast.success("Destinatário adicionado.");
  };

  const handleToggleRecipient = (recipientId: string) => {
    setSelectedRecipientIds((current) => (
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId]
    ));
  };

  const handleToggleAllVisible = (checked: boolean) => {
    const visibleIds = visibleRecipients.map((recipient) => recipient.id);
    setSelectedRecipientIds((current) => {
      const next = current.filter((id) => !visibleIds.includes(id));
      return checked ? [...next, ...visibleIds] : next;
    });
  };

  const handleRemoveRecipient = (recipientId: string) => {
    setRecipients((current) => current.filter((recipient) => recipient.id !== recipientId));
    setSelectedRecipientIds((current) => current.filter((id) => id !== recipientId));
  };

  const handleSendInvites = async () => {
    const destinatarios = recipients.filter((recipient) => selectedRecipientIds.includes(recipient.id));

    if (destinatarios.length === 0) {
      toast.error("Selecione ao menos um destinatário para o disparo.");
      return;
    }

    setIsDispatching(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || "";

      const response = await fetch(`${API_BASE_URL}/api/treinamentos/disparar-convite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          treinamento_id: training.id,
          modo: dispatchMode,
            segmento_loja: dispatchSegmentFilter === "all" ? "" : dispatchSegmentFilter,
            segmento_treinamento: dispatchMode === "segmento_treinamento" ? dispatchSegmentFilter : trainingSegment,
          destinatarios: destinatarios.map((destinatario) => ({
            nome: destinatario.nome,
            email: destinatario.email,
            segmento: destinatario.segmento,
          })),
          user_id: userId,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao disparar convites");
      }

      toast.success("Disparo de e-mails iniciado.");
    } catch (error) {
      console.error("Erro ao disparar convites:", error);
      toast.error("Nao foi possivel iniciar o disparo de e-mails.");
    } finally {
      setIsDispatching(false);
    }
  };

  const handleGenerateForm = async () => {
    setIsFormGenerating(true);
    setFormError("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || "";
      const url = `${API_BASE_URL}/api/treinamentos/gerar-formulario?id=${training.id}` + (userId ? `&user_id=${userId}` : "");
      const response = await fetch(url, { method: "POST" });

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
      const response = await fetch(url, { method: "POST" });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao regerar formulário");
      }

      const payload = await response.json().catch(() => null);
      if (payload && payload.drive_deleted === false) {
        toast.info("Regeracao iniciada. O arquivo antigo no Drive pode ter permanecido.");
      } else {
        toast.info("Regeração do formulário iniciada.");
      }
    } catch (error) {
      console.error("Erro ao regerar formulário:", error);
      toast.error("Nao foi possivel regerar o formulário.");
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
      const response = await fetch(url, { method: "DELETE" });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao apagar formulário");
      }

      setFormLinks({ view: "", edit: "" });
      setFormCreator({ name: "", email: "" });
      const payload = await response.json().catch(() => null);
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

  const downloadQrAsPng = async (containerRef: RefObject<HTMLDivElement>, filename: string) => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) {
      toast.error("QR Code indisponível para download.");
      return;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1024");
    clone.setAttribute("height", "1024");

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = new Image();
      image.decoding = "async";
      image.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Falha ao carregar QR Code"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas indisponível");
      }

      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = filename;
      link.click();
    } catch (error) {
      console.error("Erro ao exportar QR Code:", error);
      toast.error("Não foi possível baixar a imagem do QR Code.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const printQr = (containerRef: RefObject<HTMLDivElement>, title: string) => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) {
      toast.error("QR Code indisponível para impressão.");
      return;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "900");
    clone.setAttribute("height", "900");

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const printWindow = window.open("", "_blank", "width=900,height=900");

    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão.");
      URL.revokeObjectURL(objectUrl);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
            body { min-height: 100vh; display: grid; place-items: center; }
            .wrapper { text-align: center; padding: 24px; }
            img { width: 420px; height: 420px; display: block; margin: 0 auto; }
            h1 { font-size: 18px; margin: 0 0 12px; color: #1f2937; }
            p { font-size: 12px; color: #6b7280; margin: 12px 0 0; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <h1>${title}</h1>
            <img src="${objectUrl}" alt="${title}" />
            <p>Imprima este QR Code para uso no auditório.</p>
          </div>
          <script>
            const image = document.querySelector('img');
            image.onload = () => { window.print(); setTimeout(() => window.close(), 250); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  };

  const renderQrActions = (containerRef: RefObject<HTMLDivElement>, filename: string, title: string) => (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        onClick={() => downloadQrAsPng(containerRef, filename)}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Download className="h-4 w-4" />
        Baixar imagem do QR Code
      </button>
      <button
        onClick={() => printQr(containerRef, title)}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: "#F7F4EF" }}>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="w-full space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
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
                  <div className="flex items-center gap-2 mb-1 text-gray-500 text-sm font-medium">
                    <Settings2 className="w-4 h-4" />
                    Configuração do treinamento
                  </div>
                  <h1 className="text-2xl md:text-3xl mb-2 md:mb-3 leading-tight" style={{ color: "#8B1A1A" }}>
                    {training.tema}
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

              <button
                onClick={onEdit}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
                title="Editar treinamento"
              >
                <Edit2 className="w-4 h-4" />
                Editar treinamento
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-gray-700">
                <Link className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium">Formulário de inscrição</span>
              </div>
              {!formLinks.view ? (
                <button
                  onClick={handleGenerateForm}
                  disabled={isFormGenerating || isFormDeleting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFormGenerating ? "Gerando..." : "Gerar Formulário"}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <AlertDialog open={isRegenerateDialogOpen} onOpenChange={setIsRegenerateDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={isFormGenerating || isFormDeleting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFormGenerating ? "Regerando..." : "Regerar Formulário"}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regerar formulário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O link atual sera substituido por um novo formulário para este treinamento.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerateForm}>
                          Regerar formulário
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={isFormGenerating || isFormDeleting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-red-200 rounded-lg text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFormDeleting ? "Apagando..." : "Apagar link"}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Apagar link do formulário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso remove o link do sistema e tenta apagar o arquivo no Google Drive.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteForm}
                          className="bg-red-600 text-white hover:bg-red-700"
                        >
                          Apagar link
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            {isFormGenerating && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="flex items-end gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <span>O formulário está sendo gerado</span>
              </div>
            )}

            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-[#F7F4EF] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-[#D93030]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">QR CODE AUTOCHECK-IN</p>
                    <p className="text-xs text-gray-500">Link da página interna de presença deste treinamento.</p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
                  <div ref={autocheckinQrRef} className="flex items-center justify-center rounded-xl bg-white p-3">
                    <QRCode value={autocheckinUrl} size={220} bgColor="#FFFFFF" fgColor="#111827" />
                  </div>

                  <div className="w-full space-y-3">
                    <p className="break-all text-center text-xs text-gray-500">{autocheckinUrl}</p>
                    {renderQrActions(autocheckinQrRef, `qr-autocheckin-${training.id}.png`, `QR Code Autocheck-in - ${training.tema}`)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-[#F7F4EF] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-[#D93030]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">QR CODE DO FORMULÁRIO</p>
                    <p className="text-xs text-gray-500">QR do link viewform já ativo para este treinamento.</p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
                  <div ref={formQrRef} className="flex min-h-[220px] items-center justify-center rounded-xl bg-white p-3">
                    {formLinks.view ? (
                      <QRCode value={formLinks.view} size={220} bgColor="#FFFFFF" fgColor="#111827" />
                    ) : (
                      <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                        Gere o formulário para visualizar o QR Code correspondente.
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-3">
                    <p className="break-all text-center text-xs text-gray-500">{formLinks.view || "Link indisponível até a geração do formulário."}</p>
                    {formLinks.view ? renderQrActions(formQrRef, `qr-formulario-${training.id}.png`, `QR Code Formulário - ${training.tema}`) : null}
                  </div>
                </div>
              </div>
            </div>

            {formLinks.view && (
              <div className="space-y-3">
                {(formCreator.name || formCreator.email) && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <span className="font-medium text-gray-700">Criado por:</span>{" "}
                    {formCreator.name || "Sem nome"}
                    {formCreator.email ? ` (${formCreator.email})` : ""}
                  </div>
                )}
                {formLinks.edit && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-600">Link de edição</span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        value={formLinks.edit}
                        readOnly
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                      />
                      <button
                        onClick={() => handleCopyLink(formLinks.edit)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar link
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-600">Link para preencher o formulário</span>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      value={formLinks.view}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                    />
                    <button
                      onClick={() => handleCopyLink(formLinks.view)}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar link
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-[#F7F4EF] p-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#D93030]" />
                    <p className="text-sm font-semibold text-gray-900">Disparo de e-mail</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Monte a lista de destinatários, filtre por segmento e envie os convites dentro da aba de configurações.
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-xs font-medium text-gray-600">
                  {([
                    ["individual", "Individual"],
                    ["segmento_loja", "Segmento de Loja"],
                    ["segmento_treinamento", "Segmento do Treinamento"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setDispatchMode(value)}
                      className={`rounded-md px-3 py-1.5 transition-colors ${
                        dispatchMode === value
                          ? "bg-[#8B1A1A] text-white"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {dispatchMode === "individual" ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-600">Nome</label>
                        <input
                          value={recipientDraft.nome}
                          onChange={(event) => handleRecipientNameChange(event.target.value)}
                          list="store-name-suggestions"
                          placeholder="Nome do lojista"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-[#D93030]"
                        />
                        <datalist id="store-name-suggestions">
                          {nameSuggestions.map((store) => (
                            <option key={store.id} value={store.nome} />
                          ))}
                        </datalist>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-600">E-mail</label>
                      <input
                        type="email"
                        value={recipientDraft.email}
                        onChange={(event) => setRecipientDraft((current) => ({ ...current, email: event.target.value }))}
                        placeholder="contato@loja.com"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-[#D93030]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-600">Segmento</label>
                      <input
                        value={recipientDraft.segmento}
                        onChange={(event) => setRecipientDraft((current) => ({ ...current, segmento: event.target.value }))}
                        placeholder="Alimentação, Vestuário..."
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-[#D93030]"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleAddRecipient}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#8B1A1A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6F1414]"
                    >
                      <Mail className="h-4 w-4" />
                      Adicionar destinatário
                    </button>

                    <button
                      onClick={handleImportStores}
                      disabled={isImportingStores}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      {isImportingStores ? 'Carregando...' : 'Recarregar lojas'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleImportStores}
                    disabled={isImportingStores}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    {isImportingStores ? 'Carregando...' : 'Recarregar lojas'}
                  </button>

                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <select
                      value={dispatchSegmentFilter}
                      onChange={(event) => setDispatchSegmentFilter(event.target.value)}
                      className="bg-transparent outline-none"
                    >
                      {segmentOptions.length > 0 ? (
                        segmentOptions.map((segment) => (
                          <option key={segment.value} value={segment.value}>
                            {segment.label}
                          </option>
                        ))
                      ) : (
                        <option value="">Sem segmentos disponíveis</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

                {trainingSegment && (
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                    Segmento do treinamento: {trainingSegment}
                  </span>
                )}
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 text-xs text-gray-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={visibleRecipients.length > 0 && visibleRecipients.every((recipient) => selectedRecipientIds.includes(recipient.id))}
                      onChange={(event) => handleToggleAllVisible(event.target.checked)}
                    />
                    Selecionar visíveis
                  </label>
                  <span>{selectedRecipientIds.length} selecionado(s)</span>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {visibleRecipients.length > 0 ? (
                    visibleRecipients.map((recipient) => (
                      <div key={recipient.id} className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-b-0">
                        <label className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedRecipientIds.includes(recipient.id)}
                            onChange={() => handleToggleRecipient(recipient.id)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-900">{recipient.nome || recipient.email}</span>
                            <span className="block truncate text-xs text-gray-500">{recipient.email}</span>
                          </span>
                        </label>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{recipient.segmento || "Sem segmento"}</span>
                          <button
                            onClick={() => handleRemoveRecipient(recipient.id)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      Nenhum destinatário disponível para este filtro.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  {dispatchMode === "segmento_treinamento"
                    ? "O envio será limitado aos destinatários com o mesmo segmento do treinamento."
                    : dispatchMode === "segmento_loja"
                      ? "O envio será limitado ao segmento selecionado no filtro visual."
                      : "Selecione individualmente os destinatários que devem receber o convite."}
                </p>

                <button
                  onClick={handleSendInvites}
                  disabled={isDispatching || selectedRecipientIds.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0A5F59] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {isDispatching ? "Enviando..." : "Disparar e-mails"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
