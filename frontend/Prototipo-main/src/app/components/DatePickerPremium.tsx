import React, { useState, useEffect } from "react";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerPremiumProps {
  value: string; // formato "yyyy-MM-dd"
  onChange: (value: string) => void;
  placeholder?: string;
}

const mesesGrid = [
  { cod: 0, abrev: "Jan", nome: "Janeiro" },
  { cod: 1, abrev: "Fev", nome: "Fevereiro" },
  { cod: 2, abrev: "Mar", nome: "Março" },
  { cod: 3, abrev: "Abr", nome: "Abril" },
  { cod: 4, abrev: "Mai", nome: "Maio" },
  { cod: 5, abrev: "Jun", nome: "Junho" },
  { cod: 6, abrev: "Jul", nome: "Julho" },
  { cod: 7, abrev: "Ago", nome: "Agosto" },
  { cod: 8, abrev: "Set", nome: "Setembro" },
  { cod: 9, abrev: "Out", nome: "Outubro" },
  { cod: 10, abrev: "Nov", nome: "Novembro" },
  { cod: 11, abrev: "Dez", nome: "Dezembro" },
];

const anoAtual = new Date().getFullYear();
const anosDisponiveis = Array.from(
  { length: 9 },
  (_, index) => anoAtual - index,
).sort((a, b) => a - b);

export function DatePickerPremium({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
}: DatePickerPremiumProps) {
  // Inicializa a navegação com a data selecionada ou a data de hoje
  const initialDate = value ? new Date(value + "T00:00:00") : new Date();
  const [navDate, setNavDate] = useState<Date>(initialDate);

  // Modos de visão: "dias" | "meses" | "anos"
  const [viewMode, setViewMode] = useState<"dias" | "meses" | "anos">("dias");

  useEffect(() => {
    if (value) {
      setNavDate(new Date(value + "T00:00:00"));
    }
  }, [value]);

  const currentYear = navDate.getFullYear();
  const currentMonth = navDate.getMonth();

  // Lógica para renderizar a grade de DIAS
  const renderDias = () => {
    const totalDays = getDaysInMonth(navDate);
    const firstDayOfMonth = startOfMonth(navDate);
    const startWeekday = getDay(firstDayOfMonth); // 0 = Domingo, 1 = Segunda...

    const blanks = Array(startWeekday).fill(null);
    const daysInMonth = Array.from({ length: totalDays }, (_, i) => i + 1);
    const allDays = [...blanks, ...daysInMonth];

    const weekDaysAbrev = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const selectedDate = value ? new Date(value + "T00:00:00") : null;

    return (
      <div className="p-3">
        {/* Cabeçalho de Navegação rápida */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() =>
              setNavDate(new Date(currentYear, currentMonth - 1, 1))
            }
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* O PULO DO GATO: Clicar aqui muda o modo para escolher o ANO */}
          <button
            type="button"
            onClick={() => setViewMode("anos")}
            className="text-sm font-semibold text-gray-700 hover:text-[#D93030] px-2 py-0.5 rounded transition-colors uppercase"
          >
            {format(navDate, "MMMM yyyy", { locale: ptBR })}
          </button>

          <button
            type="button"
            onClick={() =>
              setNavDate(new Date(currentYear, currentMonth + 1, 1))
            }
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 text-center mb-1">
          {weekDaysAbrev.map((d) => (
            <span
              key={d}
              className="text-xs font-medium text-gray-400 capitalize"
            >
              {d}
            </span>
          ))}
        </div>

        {/* Grade de números */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {allDays.map((day, idx) => {
            if (day === null) return <div key={`blank-${idx}`} />;

            const isSelected =
              selectedDate &&
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === currentMonth &&
              selectedDate.getFullYear() === currentYear;

            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === currentMonth &&
              new Date().getFullYear() === currentYear;

            return (
              <button
                key={`day-${day}`}
                type="button"
                onClick={() => {
                  const paddingMonth = String(currentMonth + 1).padStart(
                    2,
                    "0",
                  );
                  const paddingDay = String(day).padStart(2, "0");
                  onChange(`${currentYear}-${paddingMonth}-${paddingDay}`);
                }}
                className={`h-8 text-xs font-medium rounded-full flex items-center justify-center transition-colors border ${
                  isSelected
                    ? "bg-[#D93030] text-white border-[#D93030]"
                    : isToday
                      ? "bg-red-50 text-[#D93030] border-red-200"
                      : "bg-white text-gray-700 border-transparent hover:bg-gray-100"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
        {/* Linha divisória e Botão para Resetar a Data Manualmente */}
        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={() => onChange("")} // Envia string vazia para limpar o estado
            className="text-xs font-semibold text-gray-400 hover:text-[#D93030] transition-colors px-2 py-1 rounded"
          >
            Limpar Data
          </button>
        </div>
      </div>
    );
  };

  // Lógica para renderizar a grade de ANOS (3x3 igual seu seletor antigo)
  const renderAnos = () => {
    return (
      <div className="p-3 w-[230px]">
        <div className="text-center text-xs font-bold text-gray-400 uppercase mb-3">
          Escolha o Ano
        </div>
        <div className="grid grid-cols-3 gap-2">
          {anosDisponiveis.map((ano) => (
            <button
              key={ano}
              type="button"
              onClick={() => {
                setNavDate(new Date(ano, currentMonth, 1));
                setViewMode("meses"); // Passa para o próximo passo: escolher o mês!
              }}
              className={`h-11 text-xs font-semibold rounded-lg transition-colors border ${
                currentYear === ano
                  ? "bg-[#D93030] text-white border-[#D93030]"
                  : "bg-white text-gray-700 border-gray-150 hover:bg-gray-50"
              }`}
            >
              {ano}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Lógica para renderizar a grade de MESES (4x3 igual seu filtro de meses)
  const renderMeses = () => {
    return (
      <div className="p-3 w-[240px]">
        <div className="text-center text-xs font-bold text-gray-400 uppercase mb-3 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setViewMode("anos")}
            className="hover:text-[#D93030] text-[10px]"
          >
            ◀ Voltar
          </button>
          <span>Meses ({currentYear})</span>
          <div className="w-8" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {mesesGrid.map((m) => (
            <button
              key={m.cod}
              type="button"
              onClick={() => {
                setNavDate(new Date(currentYear, m.cod, 1));
                setViewMode("dias"); // Retorna para ver os dias daquele mês e ano escolhidos!
              }}
              className={`h-10 text-xs font-medium rounded-lg transition-colors border ${
                currentMonth === m.cod
                  ? "bg-[#D93030] text-white border-[#D93030]"
                  : "bg-white text-gray-700 border-gray-150 hover:bg-gray-50"
              }`}
            >
              {m.abrev}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white">
      {viewMode === "dias" && renderDias()}
      {viewMode === "anos" && renderAnos()}
      {viewMode === "meses" && renderMeses()}
    </div>
  );
}
