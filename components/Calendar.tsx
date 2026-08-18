
"use client";

import { useEffect, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

type Availability = {
  id: number;
  date: string;
  status: "available" | "unavailable";
};

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailability();
  }, [currentMonth]);

  async function loadAvailability() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const firstDay = format(
      startOfMonth(currentMonth),
      "yyyy-MM-dd"
    );

    const lastDay = format(
      endOfMonth(currentMonth),
      "yyyy-MM-dd"
    );

    const { data, error } = await supabase
      .from("availability")
      .select("id, date, status")
      .eq("guide_id", user.id)
      .gte("date", firstDay)
      .lte("date", lastDay)
      .order("date");

    if (error) {
      console.error(
        "ERRO AO CARREGAR DISPONIBILIDADE:",
        String(error.message),
        "CODE:",
        String(error.code),
        "DETAILS:",
        String(error.details),
        "HINT:",
        String(error.hint)
      );
    } else {
      setAvailability(data || []);
    }

    setLoading(false);
  }

  async function toggleDay(day: Date) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const date = format(day, "yyyy-MM-dd");

    const existing = availability.find(
      (item) => item.date === date
    );

    // Não marcado → Disponível
    if (!existing) {
      const { data, error } = await supabase
        .from("availability")
        .insert({
          guide_id: user.id,
          date,
          status: "available",
        })
        .select("id, date, status")
        .single();

      if (error) {
        console.error(
          "ERRO AO CRIAR DISPONIBILIDADE:",
          String(error.message),
          "CODE:",
          String(error.code),
          "DETAILS:",
          String(error.details),
          "HINT:",
          String(error.hint)
        );
        return;
      }

      setAvailability((current) => [...current, data]);
      return;
    }

    // Disponível → Indisponível
    if (existing.status === "available") {
      const { data, error } = await supabase
        .from("availability")
        .update({
          status: "unavailable",
        })
        .eq("id", existing.id)
        .select("id, date, status")
        .single();

      if (error) {
        console.error(
          "ERRO AO ATUALIZAR DISPONIBILIDADE:",
          String(error.message),
          "CODE:",
          String(error.code),
          "DETAILS:",
          String(error.details),
          "HINT:",
          String(error.hint)
        );
        return;
      }

      setAvailability((current) =>
        current.map((item) =>
          item.id === existing.id ? data : item
        )
      );

      return;
    }

    // Indisponível → Remove a marcação
    const { error } = await supabase
      .from("availability")
      .delete()
      .eq("id", existing.id);

    if (error) {
      console.error(
        "ERRO AO REMOVER DISPONIBILIDADE:",
        String(error.message),
        "CODE:",
        String(error.code),
        "DETAILS:",
        String(error.details),
        "HINT:",
        String(error.hint)
      );
      return;
    }

    setAvailability((current) =>
      current.filter((item) => item.id !== existing.id)
    );
  }

  const calendarStart = startOfWeek(
    startOfMonth(currentMonth),
    {
      weekStartsOn: 1,
    }
  );

  const calendarEnd = endOfWeek(
    endOfMonth(currentMonth),
    {
      weekStartsOn: 1,
    }
  );

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const monthName = format(
    currentMonth,
    "MMMM yyyy",
    {
      locale: ptBR,
    }
  );

  return (
    <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm sm:p-6">

      {/* CABEÇALHO DO CALENDÁRIO */}

      <div className="mb-6 flex items-center justify-between rounded-2xl bg-gray-50 p-3">

        <button
          type="button"
          onClick={() =>
            setCurrentMonth(
              subMonths(currentMonth, 1)
            )
          }
          className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-xl font-extrabold text-gray-900 shadow-sm transition hover:border-[#e91e8c] hover:bg-pink-50 hover:text-[#e91e8c]"
          aria-label="Mês anterior"
        >
          ←
        </button>

        <h4 className="text-xl font-extrabold capitalize text-gray-900 sm:text-2xl">
          {monthName}
        </h4>

        <button
          type="button"
          onClick={() =>
            setCurrentMonth(
              addMonths(currentMonth, 1)
            )
          }
          className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-xl font-extrabold text-gray-900 shadow-sm transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
          aria-label="Próximo mês"
        >
          →
        </button>

      </div>

      {/* DIAS DA SEMANA */}

      <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-extrabold uppercase tracking-wide text-gray-800 sm:text-sm">
        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sáb</div>
        <div>Dom</div>
      </div>

      {/* CALENDÁRIO */}

      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c]" />

          <p className="mt-4 text-sm font-medium text-gray-600">
            Carregando calendário...
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2">

            {days.map((day) => {
              const date = format(
                day,
                "yyyy-MM-dd"
              );

              const existing =
                availability.find(
                  (item) => item.date === date
                );

              const sameMonth =
                isSameMonth(
                  day,
                  currentMonth
                );

              let dayClass =
                "bg-gray-100 text-gray-800 hover:bg-gray-200";

              if (
                sameMonth &&
                existing?.status === "available"
              ) {
                dayClass =
                  "bg-green-500 text-white hover:bg-green-600";
              }

              if (
                sameMonth &&
                existing?.status === "unavailable"
              ) {
                dayClass =
                  "bg-red-500 text-white hover:bg-red-600";
              }

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() =>
                    toggleDay(day)
                  }
                  disabled={
                    loading || !sameMonth
                  }
                  className={[
                    "aspect-square rounded-xl text-sm font-extrabold transition sm:text-base",
                    !sameMonth
                      ? "cursor-default bg-gray-100 text-gray-400"
                      : dayClass,
                  ].join(" ")}
                >
                  {format(day, "d")}
                </button>
              );
            })}

          </div>

          {/* LEGENDA */}

          <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-gray-100 pt-5 text-sm font-semibold text-gray-700">

            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-md bg-green-500 ring-1 ring-green-200" />
              <span>Disponível</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-md bg-red-500 ring-1 ring-red-200" />
              <span>Indisponível</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-md border border-gray-300 bg-gray-100" />
              <span>Não marcado</span>
            </div>

          </div>
        </>
      )}

    </div>
  );
}

