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
  status:
    | "available"
    | "unavailable"
    | "escalated";
};

export default function Calendar() {
  const [currentMonth, setCurrentMonth] =
    useState(new Date());

  const [availability, setAvailability] =
    useState<Availability[]>([]);

  const [loading, setLoading] =
    useState(true);

  // ============================================================
  // CARREGAR DISPONIBILIDADE
  // ============================================================

  useEffect(() => {
    loadAvailability();

    // ==========================================================
    // ATUALIZAÇÃO EM TEMPO REAL
    // ==========================================================

    const channel = supabase
      .channel("guide-availability")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availability",
        },
        async () => {
          await loadAvailability();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      .select(
        "id, date, status"
      )
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

  // ============================================================
  // ALTERAR DIA
  // ============================================================

  async function toggleDay(day: Date) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const date = format(
      day,
      "yyyy-MM-dd"
    );

    const existing =
      availability.find(
        (item) =>
          item.date === date
      );

    // ==========================================================
    // ESCALADO
    // ==========================================================
    // O administrador escalou esse guia.
    //
    // O guia NÃO pode alterar esse dia.
    // ==========================================================

    if (
      existing?.status ===
      "escalated"
    ) {
      return;
    }

    // ==========================================================
    // NÃO MARCADO → DISPONÍVEL
    // ==========================================================

    if (!existing) {
      const { data, error } =
        await supabase
          .from("availability")
          .insert({
            guide_id: user.id,
            date,
            status: "available",
          })
          .select(
            "id, date, status"
          )
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

      setAvailability(
        (current) => [
          ...current,
          data,
        ]
      );

      return;
    }

    // ==========================================================
    // DISPONÍVEL → INDISPONÍVEL
    // ==========================================================

    if (
      existing.status ===
      "available"
    ) {
      const { data, error } =
        await supabase
          .from("availability")
          .update({
            status: "unavailable",
          })
          .eq(
            "id",
            existing.id
          )
          .select(
            "id, date, status"
          )
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

      setAvailability(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              existing.id
                ? data
                : item
          )
      );

      return;
    }

    // ==========================================================
    // INDISPONÍVEL → REMOVE MARCAÇÃO
    // ==========================================================

    if (
      existing.status ===
      "unavailable"
    ) {
      const { error } =
        await supabase
          .from("availability")
          .delete()
          .eq(
            "id",
            existing.id
          );

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

      setAvailability(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              existing.id
          )
      );
    }
  }

  // ============================================================
  // CALENDÁRIO
  // ============================================================

  const calendarStart =
    startOfWeek(
      startOfMonth(
        currentMonth
      ),
      {
        weekStartsOn: 1,
      }
    );

  const calendarEnd =
    endOfWeek(
      endOfMonth(
        currentMonth
      ),
      {
        weekStartsOn: 1,
      }
    );

  const days =
    eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });

  // ============================================================
  // MÊS
  // ============================================================

  const monthName =
    format(
      currentMonth,
      "MMMM yyyy",
      {
        locale: ptBR,
      }
    );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm sm:mt-6 sm:rounded-3xl sm:p-6">

      {/* ====================================================== */}
      {/* CABEÇALHO */}
      {/* ====================================================== */}

      <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-50 p-2 sm:mb-6 sm:rounded-2xl sm:p-3">

        {/* MÊS ANTERIOR */}

        <button
          type="button"
          onClick={() =>
            setCurrentMonth(
              subMonths(
                currentMonth,
                1
              )
            )
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-extrabold text-gray-900 shadow-sm transition hover:border-[#e91e8c] hover:bg-pink-50 hover:text-[#e91e8c] sm:h-11 sm:w-11 sm:rounded-xl sm:border-2 sm:text-xl"
          aria-label="Mês anterior"
        >
          ←
        </button>

        {/* MÊS */}

        <h4 className="text-base font-extrabold capitalize text-gray-900 sm:text-xl md:text-2xl">
          {monthName}
        </h4>

        {/* PRÓXIMO MÊS */}

        <button
          type="button"
          onClick={() =>
            setCurrentMonth(
              addMonths(
                currentMonth,
                1
              )
            )
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-extrabold text-gray-900 shadow-sm transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] sm:h-11 sm:w-11 sm:rounded-xl sm:border-2 sm:text-xl"
          aria-label="Próximo mês"
        >
          →
        </button>

      </div>

      {/* ====================================================== */}
      {/* DIAS DA SEMANA */}
      {/* ====================================================== */}

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold uppercase tracking-wide text-gray-700 sm:mb-3 sm:gap-2 sm:text-xs md:text-sm">

        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sáb</div>
        <div>Dom</div>

      </div>

      {/* ====================================================== */}
      {/* CALENDÁRIO */}
      {/* ====================================================== */}

      {loading ? (
        <div className="py-10 text-center sm:py-12">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c] sm:h-9 sm:w-9" />

          <p className="mt-3 text-sm font-medium text-gray-600 sm:mt-4">
            Carregando calendário...
          </p>

        </div>
      ) : (
        <>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">

            {days.map(
              (day) => {

                const date =
                  format(
                    day,
                    "yyyy-MM-dd"
                  );

                const existing =
                  availability.find(
                    (item) =>
                      item.date ===
                      date
                  );

                const sameMonth =
                  isSameMonth(
                    day,
                    currentMonth
                  );

                const isEscalated =
                  existing?.status ===
                  "escalated";

                let dayClass =
                  "bg-gray-100 text-gray-800 hover:bg-gray-200";

                // ==================================================
                // DISPONÍVEL
                // ==================================================

                if (
                  sameMonth &&
                  existing?.status ===
                    "available"
                ) {
                  dayClass =
                    "bg-green-500 text-white hover:bg-green-600";
                }

                // ==================================================
                // INDISPONÍVEL
                // ==================================================

                if (
                  sameMonth &&
                  existing?.status ===
                    "unavailable"
                ) {
                  dayClass =
                    "bg-red-500 text-white hover:bg-red-600";
                }

                // ==================================================
                // ESCALADO
                // ==================================================

                if (
                  sameMonth &&
                  isEscalated
                ) {
                  dayClass =
                    "cursor-not-allowed bg-[#c9aa00] text-white shadow-inner";
                }

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() =>
                      toggleDay(day)
                    }
                    disabled={
                      loading ||
                      !sameMonth ||
                      isEscalated
                    }
                    title={
                      isEscalated
                        ? "Você foi escalado para este dia pelo administrador"
                        : undefined
                    }
                    className={[
                      "aspect-square rounded-lg text-xs font-extrabold transition sm:rounded-xl sm:text-sm md:text-base",

                      !sameMonth
                        ? "cursor-default bg-gray-100 text-gray-400"
                        : dayClass,

                      isEscalated &&
                      sameMonth
                        ? "cursor-not-allowed"
                        : "",
                    ].join(
                      " "
                    )}
                  >
                    {format(
                      day,
                      "d"
                    )}
                  </button>
                );
              }
            )}

          </div>

          {/* ==================================================== */}
          {/* LEGENDA */}
          {/* ==================================================== */}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-700 sm:mt-6 sm:gap-5 sm:pt-5 sm:text-sm">

            {/* ESCALADO */}

            <div className="flex items-center gap-1.5 sm:gap-2">

              <span className="h-3 w-3 rounded-md bg-[#c9aa00] ring-1 ring-[#d6c36a] sm:h-4 sm:w-4" />

              <span>
                Escalado
              </span>

            </div>

            {/* DISPONÍVEL */}

            <div className="flex items-center gap-1.5 sm:gap-2">

              <span className="h-3 w-3 rounded-md bg-green-500 ring-1 ring-green-200 sm:h-4 sm:w-4" />

              <span>
                Disponível
              </span>

            </div>

            {/* INDISPONÍVEL */}

            <div className="flex items-center gap-1.5 sm:gap-2">

              <span className="h-3 w-3 rounded-md bg-red-500 ring-1 ring-red-200 sm:h-4 sm:w-4" />

              <span>
                Indisponível
              </span>

            </div>

            {/* NÃO MARCADO */}

            <div className="flex items-center gap-1.5 sm:gap-2">

              <span className="h-3 w-3 rounded-md border border-gray-300 bg-gray-100 sm:h-4 sm:w-4" />

              <span>
                Não marcado
              </span>

            </div>

          </div>

          {/* ==================================================== */}
          {/* AVISO DE ESCALA */}
          {/* ==================================================== */}

          {availability.some(
            (item) =>
              item.status ===
              "escalated"
          ) && (
            <div className="mt-4 rounded-xl border border-[#d6c36a] bg-[#fff9d9] px-4 py-3 text-xs font-semibold text-[#806600] sm:mt-5 sm:rounded-2xl sm:text-sm">

              🟡 Os dias em mostarda foram escalados pelo
              administrador. Esses dias não podem ser alterados
              por você.

            </div>
          )}

        </>
      )}

    </div>
  );
}