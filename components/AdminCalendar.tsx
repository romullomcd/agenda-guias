"use client";

import { useEffect, useMemo, useState } from "react";
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

type Guide = {
  id: string;
  name: string;
  active: boolean;
};

type Availability = {
  id: number;
  guide_id: string;
  date: string;
  status: "available" | "unavailable";
};

export default function AdminCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [guides, setGuides] = useState<Guide[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selectedGuide, setSelectedGuide] = useState("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("admin-availability")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availability",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMonth]);

  async function loadData() {
    setLoading(true);

    const firstDay = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const lastDay = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const [guidesResult, availabilityResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, active")
        .eq("role", "guide")
        .order("name"),

      supabase
        .from("availability")
        .select("id, guide_id, date, status")
        .gte("date", firstDay)
        .lte("date", lastDay)
        .order("date"),
    ]);

    if (guidesResult.error) {
      console.error("ERRO AO CARREGAR GUIAS:", guidesResult.error);
    } else {
      setGuides(guidesResult.data || []);
    }

    if (availabilityResult.error) {
      console.error(
        "ERRO AO CARREGAR DISPONIBILIDADES:",
        availabilityResult.error
      );
    } else {
      setAvailability(availabilityResult.data || []);
    }

    setLoading(false);
  }

  const filteredAvailability = useMemo(() => {
    if (selectedGuide === "all") {
      return availability;
    }

    return availability.filter(
      (item) => item.guide_id === selectedGuide
    );
  }, [availability, selectedGuide]);

  const guideMap = useMemo(() => {
    return new Map(guides.map((guide) => [guide.id, guide]));
  }, [guides]);

  const calendarStart = startOfWeek(startOfMonth(currentMonth), {
    weekStartsOn: 1,
  });

  const calendarEnd = endOfWeek(endOfMonth(currentMonth), {
    weekStartsOn: 1,
  });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const selectedDayData = selectedDate
    ? filteredAvailability.filter(
        (item) => item.date === selectedDate
      )
    : [];

  const selectedAvailable = selectedDayData.filter(
    (item) => item.status === "available"
  );

  const selectedUnavailable = selectedDayData.filter(
    (item) => item.status === "unavailable"
  );

  function getDayAvailability(date: string) {
    return filteredAvailability.filter(
      (item) => item.date === date
    );
  }

  function getGuideName(guideId: string) {
    return guideMap.get(guideId)?.name || "Guia";
  }

  const monthName = format(currentMonth, "MMMM yyyy", {
    locale: ptBR,
  });

  return (
    <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm sm:p-6">

      {/* CABEÇALHO */}

      <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

        <div>
          <h3 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
            Agenda dos Guias
          </h3>

          <p className="mt-1 text-sm font-medium text-gray-600">
            Visualize a disponibilidade dos guias.
          </p>
        </div>

        <select
          value={selectedGuide}
          onChange={(event) => setSelectedGuide(event.target.value)}
          className="rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-[#1687d9] focus:ring-4 focus:ring-blue-100"
        >
          <option value="all">Todos os guias</option>

          {guides.map((guide) => (
            <option key={guide.id} value={guide.id}>
              {guide.name}
              {!guide.active ? " (Inativo)" : ""}
            </option>
          ))}
        </select>

      </div>

      {/* NAVEGAÇÃO DO MÊS */}

      <div className="mb-6 flex items-center justify-between rounded-2xl bg-gray-50 p-3">

        <button
          type="button"
          onClick={() =>
            setCurrentMonth(subMonths(currentMonth, 1))
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
            setCurrentMonth(addMonths(currentMonth, 1))
          }
          className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-xl font-extrabold text-gray-900 shadow-sm transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
          aria-label="Próximo mês"
        >
          →
        </button>

      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c]" />

          <p className="mt-4 text-sm font-medium text-gray-600">
            Carregando agenda...
          </p>
        </div>
      ) : (
        <>
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

          <div className="grid grid-cols-7 gap-2">

            {days.map((day) => {
              const date = format(day, "yyyy-MM-dd");
              const sameMonth = isSameMonth(day, currentMonth);

              const dayItems = getDayAvailability(date);

              const available = dayItems.filter(
                (item) => item.status === "available"
              );

              const unavailable = dayItems.filter(
                (item) => item.status === "unavailable"
              );

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() =>
                    sameMonth && setSelectedDate(date)
                  }
                  disabled={!sameMonth}
                  className={[
                    "min-h-28 rounded-xl border p-2 text-left transition",
                    !sameMonth
                      ? "cursor-default border-transparent bg-gray-100 text-gray-400"
                      : "border-gray-200 bg-white hover:border-[#1687d9] hover:shadow-md",
                  ].join(" ")}
                >

                  {/* NÚMERO DO DIA */}

                  <div
                    className={[
                      "mb-2 text-right text-sm font-extrabold",
                      sameMonth
                        ? "text-gray-900"
                        : "text-gray-400",
                    ].join(" ")}
                  >
                    {format(day, "d")}
                  </div>

                  {/* GUIAS DISPONÍVEIS */}

                  <div className="space-y-1">

                    {available.slice(0, 3).map((item) => (
                      <div
                        key={`available-${item.id}`}
                        className="truncate rounded-lg bg-green-100 px-1.5 py-1 text-xs font-semibold text-green-800"
                      >
                        🟢 {getGuideName(item.guide_id)}
                      </div>
                    ))}

                    {available.length > 3 && (
                      <div className="px-1 text-xs font-semibold text-green-700">
                        + {available.length - 3} disponíveis
                      </div>
                    )}

                    {/* GUIAS INDISPONÍVEIS */}

                    {unavailable.slice(0, 2).map((item) => (
                      <div
                        key={`unavailable-${item.id}`}
                        className="truncate rounded-lg bg-red-100 px-1.5 py-1 text-xs font-semibold text-red-800"
                      >
                        🔴 {getGuideName(item.guide_id)}
                      </div>
                    ))}

                    {unavailable.length > 2 && (
                      <div className="px-1 text-xs font-semibold text-red-700">
                        + {unavailable.length - 2} indisponíveis
                      </div>
                    )}

                  </div>

                </button>
              );
            })}

          </div>

          {/* LEGENDA */}

          <div className="mt-6 flex flex-wrap gap-5 border-t border-gray-100 pt-5 text-sm font-semibold text-gray-700">

            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-md bg-green-100 ring-1 ring-green-200" />
              Disponível
            </div>

            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-md bg-red-100 ring-1 ring-red-200" />
              Indisponível
            </div>

          </div>
        </>
      )}

      {/* MODAL DO DIA */}

      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >

            <div className="flex items-start justify-between">

              <div>
                <h3 className="text-xl font-extrabold capitalize text-gray-900">
                  {format(
                    new Date(`${selectedDate}T12:00:00`),
                    "dd 'de' MMMM",
                    { locale: ptBR }
                  )}
                </h3>

                <p className="mt-1 text-sm font-medium text-gray-500">
                  Disponibilidade dos guias
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-700 transition hover:bg-gray-100"
                aria-label="Fechar"
              >
                ✕
              </button>

            </div>

            {/* DISPONÍVEIS */}

            <div className="mt-6">

              <h4 className="font-extrabold text-green-700">
                🟢 Disponíveis
              </h4>

              <div className="mt-2 space-y-2">

                {selectedAvailable.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                    Nenhum guia marcado como disponível.
                  </p>
                ) : (
                  selectedAvailable.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800"
                    >
                      {getGuideName(item.guide_id)}
                    </div>
                  ))
                )}

              </div>

            </div>

            {/* INDISPONÍVEIS */}

            <div className="mt-6">

              <h4 className="font-extrabold text-red-700">
                🔴 Indisponíveis
              </h4>

              <div className="mt-2 space-y-2">

                {selectedUnavailable.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                    Nenhum guia marcado como indisponível.
                  </p>
                ) : (
                  selectedUnavailable.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
                    >
                      {getGuideName(item.guide_id)}
                    </div>
                  ))
                )}

              </div>

            </div>

            {/* FECHAR */}

            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="mt-6 w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-[#0f75bd]"
            >
              Fechar
            </button>

          </div>
        </div>
      )}

    </div>
  );
}