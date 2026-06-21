/**
 * StoreExplorer.tsx
 *
 * Componente "Explorador de Lojas" para a aba de Engajamento.
 *
 * Responsabilidades:
 * - Buscar do backend /api/lojas/explorador?data_inicio=&data_fim= as lojas ativas
 * com totalTreinamentos e taxaParticipacao já calculados pelo servidor.
 * - Exibir uma tabela filtrável por nome, LUC e segmento com paginação numérica de 10 itens.
 * - Ao clicar em uma loja, chama onSelectStore(store, trainings) para navegar ao detalhe.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Hash,
  Store,
  Loader2,
  AlertCircle,
  ChevronRight,
  Tag,
  ChevronLeft,
  ChevronsLeft, // 🟢 Ícone para ir para a primeira página
  ChevronsRight, // 🟢 Ícone para ir para a última página
} from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { API_BASE_URL } from "../lib/config";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { cn } from "./ui/utils";

// ──────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────

export interface LojaExplorador {
  id: string; // UUID string do backend (ex: "a1b2-...")
  luc: string;
  nome: string;
  segmento: string;
  totalTreinamentos: number;
  taxaParticipacao: number; // 0-100
}

interface StoreExplorerProps {
  /** Data início do período global no formato YYYY-MM-DD */
  dataInicio: string;
  /** Data fim do período global no formato YYYY-MM-DD */
  dataFim: string;
  /** Callback disparado quando o usuário clica em "Ver Detalhes" de uma loja */
  onSelectStore: (store: LojaExplorador) => void;
}

// ──────────────────────────────────────────────
// Utilitários
// ──────────────────────────────────────────────

/** Retorna classe de cor de acordo com o percentual de participação */
function getParticipacaoColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 50) return "text-amber-500";
  return "text-[#D93030]";
}

/** Retorna cor da barra de progresso de acordo com o percentual */
function getBarColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-[#D93030]";
}

/** 🟢 Converte "YYYY-MM-DD" para "DD/MM/YYYY" */
function formatarDataBR(dataStr: string): string {
  if (!dataStr) return "";
  const partes = dataStr.split("-");
  if (partes.length !== 3) return dataStr; // Caso a string não esteja no formato esperado
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/** 🟢 Função auxiliar para calcular quais números de página devem aparecer */
const getPageNumbers = (current: number, total: number) => {
  const maxVisiblePages = 5; // Mostra no máximo 5 números por vez para não quebrar o layout
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

// ──────────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────────

export function StoreExplorer({
  dataInicio,
  dataFim,
  onSelectStore,
}: StoreExplorerProps) {
  const [lojas, setLojas] = useState<LojaExplorador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [lucSearch, setLucSearch] = useState("");
  const [segmentSearch, setSegmentSearch] = useState("");

  // Estados para controle de Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 10;

  // ── Fetch ─────────────────────────────────────
  const fetchLojas = useCallback(async () => {
    if (!dataInicio || !dataFim) return;

    setIsLoading(true);
    setError("");

    try {
      const url = `${API_BASE_URL}/api/lojas/explorador?data_inicio=${dataInicio}&data_fim=${dataFim}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Servidor retornou ${res.status}`);
      const data: LojaExplorador[] = await res.json();
      setLojas(Array.isArray(data) ? data : []);
      setPaginaAtual(1); // Reseta para a primeira página ao mudar o período de datas
    } catch (err) {
      console.error("StoreExplorer: erro ao buscar lojas:", err);
      setError(
        "Não foi possível carregar as lojas. Verifique se o backend Go está em execução.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [dataInicio, dataFim]);

  // Re-busca automaticamente quando o período muda
  useEffect(() => {
    fetchLojas();
  }, [fetchLojas]);

  // Reseta para a página 1 sempre que o usuário digitar algo nos filtros de busca
  useEffect(() => {
    setPaginaAtual(1);
  }, [storeSearch, lucSearch, segmentSearch]);

  // ── Filtro local ──────────────────────────────
  const lojasFiltradas = lojas.filter(
    (l) =>
      l.nome.toLowerCase().includes(storeSearch.toLowerCase()) &&
      l.luc.toLowerCase().includes(lucSearch.toLowerCase()) &&
      l.segmento.toLowerCase().includes(segmentSearch.toLowerCase()),
  );

  // Lógica para fatiar (slice) a lista com o que deve aparecer na página atual
  const totalPaginas = Math.ceil(lojasFiltradas.length / ITENS_POR_PAGINA) || 1;
  const indiceInicial = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const indiceFinal = indiceInicial + ITENS_POR_PAGINA;
  const lojasPaginadas = lojasFiltradas.slice(indiceInicial, indiceFinal);

  // 🟢 Gera a lista de números reativos que vão aparecer na barra
  const paginasVisiveis = getPageNumbers(paginaAtual, totalPaginas);

  // ── Renders ───────────────────────────────────
  const renderContent = () => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={5} className="px-6 py-12 text-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <Loader2 className="w-7 h-7 animate-spin text-[#D93030]" />
              <span className="text-sm">Carregando lojas do servidor...</span>
            </div>
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td colSpan={5} className="px-6 py-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="w-7 h-7 text-red-400" />
              <p className="text-sm text-red-500 max-w-xs">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLojas}
                className="text-[#D93030] border-red-200 hover:bg-red-50"
              >
                Tentar novamente
              </Button>
            </div>
          </td>
        </tr>
      );
    }

    if (lojasPaginadas.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="px-6 py-10 text-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <Store className="w-7 h-7" />
              <p className="text-sm">
                {lojas.length === 0
                  ? "Nenhuma loja ativa encontrada no sistema."
                  : "Nenhuma loja encontrada para os filtros aplicados."}
              </p>
            </div>
          </td>
        </tr>
      );
    }

    return lojasPaginadas.map((loja) => (
      <TableRow
        key={loja.id}
        className="cursor-pointer hover:bg-gray-50 transition-colors group"
        onClick={() => onSelectStore(loja)}
      >
        {/* Loja / LUC */}
        <TableCell className="font-medium text-gray-900">
          <div className="flex flex-col">
            <span className="group-hover:text-[#D93030] transition-colors">
              {loja.nome}
            </span>
            <span className="text-xs text-gray-500 font-normal">
              {loja.luc}
            </span>
          </div>
        </TableCell>

        {/* Segmento */}
        <TableCell>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
            {loja.segmento}
          </span>
        </TableCell>

        {/* Total de Treinamentos */}
        <TableCell className="text-center">
          <span className="text-sm font-semibold text-gray-900">
            {loja.totalTreinamentos}
          </span>
          <div className="text-[11px] text-gray-400 font-normal">
            {loja.totalTreinamentos === 1 ? "treinamento" : "treinamentos"}
          </div>
        </TableCell>

        {/* % Participação */}
        <TableCell className="text-center min-w-[140px]">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "text-sm font-semibold",
                getParticipacaoColor(loja.taxaParticipacao),
              )}
            >
              {loja.taxaParticipacao}%
            </span>
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  getBarColor(loja.taxaParticipacao),
                )}
                style={{ width: `${loja.taxaParticipacao}%` }}
              />
            </div>
          </div>
        </TableCell>

        {/* Ação */}
        <TableCell className="text-right">
          <Button
            variant="outline"
            size="sm"
            className="text-[#D93030] border-gray-200 hover:bg-red-50 hover:text-[#D93030] hover:border-red-200 gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onSelectStore(loja);
            }}
          >
            Ver Detalhes
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <Card className="mt-8 bg-white border-gray-200 shadow-sm">
      <CardHeader className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Store className="w-4 h-4 text-[#D93030]" />
            Explorador de Lojas
          </CardTitle>
          <CardDescription>
            Análise o desempenho e engajamento de cada loja no período
            selecionado
          </CardDescription>
        </div>
        {/* Filtros locais */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="relative w-full sm:w-40">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="store-explorer-luc-filter"
              placeholder="Filtrar por LUC..."
              value={lucSearch}
              onChange={(e) => setLucSearch(e.target.value)}
              className="pl-9 bg-gray-50 border-transparent focus:bg-white text-sm"
            />
          </div>
          <div className="relative w-full sm:w-44">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="store-explorer-segment-filter"
              placeholder="Filtrar segmento..."
              value={segmentSearch}
              onChange={(e) => setSegmentSearch(e.target.value)}
              className="pl-9 bg-gray-50 border-transparent focus:bg-white text-sm"
            />
          </div>
          <div className="relative w-full sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="store-explorer-name-filter"
              placeholder="Buscar loja..."
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              className="pl-9 bg-gray-50 border-transparent focus:bg-white text-sm"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Indicador de período ativo */}
        {!isLoading && !error && (
          <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Período:{" "}
              <span className="font-medium text-gray-700">
                {formatarDataBR(dataInicio)} → {formatarDataBR(dataFim)}
              </span>
            </p>
            <p className="text-xs text-gray-500">
              Exibindo {indiceInicial + 1}-
              {Math.min(indiceFinal, lojasFiltradas.length)} de{" "}
              {lojasFiltradas.length} encontradas
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-white">
                <TableHead className="font-semibold text-gray-600 pl-6">
                  Loja / LUC
                </TableHead>
                <TableHead className="font-semibold text-gray-600">
                  Segmento
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-center">
                  Treinamentos Totais
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-center">
                  % Participação
                </TableHead>
                <TableHead className="font-semibold text-gray-600 text-right pr-6">
                  Ação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderContent()}</TableBody>
          </Table>
        </div>

        {/* 🟢 RODAPÉ: Controles com Números, Atalhos de Primeira e Última Página */}
        {!isLoading && !error && lojasFiltradas.length > 0 && (
          <div className="px-6 py-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-gray-500">
              Página{" "}
              <span className="font-medium text-gray-700">{paginaAtual}</span>{" "}
              de{" "}
              <span className="font-medium text-gray-700">{totalPaginas}</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Pular para Primeira Página */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPaginaAtual(1)}
                disabled={paginaAtual === 1}
                className="h-8 w-8 text-gray-600 border-gray-200 disabled:opacity-40"
                title="Primeira Página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>

              {/* Página Anterior */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                disabled={paginaAtual === 1}
                className="h-8 px-2 text-gray-600 border-gray-200 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>

              {/* 🟢 RENDERIZAÇÃO DOS NÚMEROS DO BLOCO DINÂMICO */}
              {paginasVisiveis.map((page) => (
                <Button
                  key={page}
                  variant={paginaAtual === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaginaAtual(page)}
                  className={cn(
                    "h-8 w-8 font-medium transition-all duration-200",
                    paginaAtual === page
                      ? "bg-[#D93030] text-white border-[#D93030] hover:bg-[#B82525]"
                      : "text-gray-600 border-gray-200 hover:bg-gray-50",
                  )}
                >
                  {page}
                </Button>
              ))}

              {/* Próxima Página */}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPaginaAtual((prev) => Math.min(prev + 1, totalPaginas))
                }
                disabled={paginaAtual === totalPaginas}
                className="h-8 px-2 text-gray-600 border-gray-200 disabled:opacity-40 flex items-center gap-1"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>

              {/* Pular para Última Página */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPaginaAtual(totalPaginas)}
                disabled={paginaAtual === totalPaginas}
                className="h-8 w-8 text-gray-600 border-gray-200 disabled:opacity-40"
                title="Última Página"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
