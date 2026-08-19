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
  languages: string[];
  phone: string;
  email: string;
};

type Availability = {
  id: number;
  guide_id: string;
  date: string;
  status: "available" | "unavailable";
};

const LANGUAGE_FLAGS: Record<string, string> = {
  Português: "🇧🇷",
  Inglês: "🇺🇸",
  Espanhol: "🇪🇸",
  Francês: "🇫🇷",
  Italiano: "🇮🇹",
  Alemão: "🇩🇪",
  Mandarim: "🇨🇳",
  Japonês: "🇯🇵",
};

export default function AdminCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [guides, setGuides] = useState<Guide[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);

  const [selectedGuide, setSelectedGuide] = useState("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [selectedGuideDetails, setSelectedGuideDetails] =
    useState<Guide | null>(null);

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

  // ============================================
  // CARREGA DADOS
  // ============================================

  async function loadData() {
    setLoading(true);

    const firstDay = format(
      startOfMonth(currentMonth),
      "yyyy-MM-dd"
    );

    const lastDay = format(
      endOfMonth(currentMonth),
      "yyyy-MM-dd"
    );

    const [guidesResult, availabilityResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, name, active, languages, phone"
          )
          .eq("role", "guide")
          .order("name"),

        supabase
          .from("availability")
          .select(
            "id, guide_id, date, status"
          )
          .gte("date", firstDay)
          .lte("date", lastDay)
          .order("date"),
      ]);

    // ============================================
    // GUIAS
    // ============================================

    if (guidesResult.error) {
      console.error(
        "ERRO AO CARREGAR GUIAS:",
        guidesResult.error
      );
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const guidesWithDetails =
        await Promise.all(
          (guidesResult.data || []).map(
            async (guide) => {
              // Caso não tenha sessão
              if (!session) {
                return {
                  ...guide,
                  languages:
                    guide.languages || [],
                  phone:
                    guide.phone || "",
                  email: "",
                };
              }

              try {
                const response =
                  await fetch(
                    `/api/guides/${guide.id}`,
                    {
                      method: "GET",
                      headers: {
                        Authorization: `Bearer ${session.access_token}`,
                      },
                    }
                  );

                const result =
                  await response.json();

                return {
                  ...guide,
                  languages:
                    guide.languages || [],
                  phone:
                    guide.phone || "",
                  email:
                    result.email || "",
                };
              } catch (error) {
                console.error(
                  `Erro ao buscar detalhes do guia ${guide.id}:`,
                  error
                );

                return {
                  ...guide,
                  languages:
                    guide.languages || [],
                  phone:
                    guide.phone || "",
                  email: "",
                };
              }
            }
          )
        );

      setGuides(guidesWithDetails);
    }

    // ============================================
    // DISPONIBILIDADE
    // ============================================

    if (availabilityResult.error) {
      console.error(
        "ERRO AO CARREGAR DISPONIBILIDADES:",
        availabilityResult.error
      );
    } else {
      setAvailability(
        availabilityResult.data || []
      );
    }

    setLoading(false);
  }

  // ============================================
  // FILTRO
  // ============================================

  const filteredAvailability = useMemo(() => {
    if (selectedGuide === "all") {
      return availability;
    }

    return availability.filter(
      (item) =>
        item.guide_id === selectedGuide
    );
  }, [
    availability,
    selectedGuide,
  ]);

  // ============================================
  // MAPA DOS GUIAS
  // ============================================

  const guideMap = useMemo(() => {
    return new Map(
      guides.map((guide) => [
        guide.id,
        guide,
      ])
    );
  }, [guides]);

  // ============================================
  // CALENDÁRIO
  // ============================================

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

  // ============================================
  // DIA SELECIONADO
  // ============================================

  const selectedDayData = selectedDate
    ? filteredAvailability.filter(
        (item) =>
          item.date === selectedDate
      )
    : [];

  const selectedAvailable =
    selectedDayData.filter(
      (item) =>
        item.status === "available"
    );

  const selectedUnavailable =
    selectedDayData.filter(
      (item) =>
        item.status === "unavailable"
    );

  // ============================================
  // DISPONIBILIDADE DO DIA
  // ============================================

  function getDayAvailability(
    date: string
  ) {
    return filteredAvailability.filter(
      (item) =>
        item.date === date
    );
  }

  // ============================================
  // NOME DO GUIA
  // ============================================

  function getGuideName(
    guideId: string
  ) {
    return (
      guideMap.get(guideId)?.name ||
      "Guia"
    );
  }

  // ============================================
  // BANDEIRAS DO GUIA
  // ============================================

  function getGuideFlags(
    guideId: string
  ) {
    const guide =
      guideMap.get(guideId);

    if (
      !guide?.languages ||
      guide.languages.length === 0
    ) {
      return "🌐";
    }

    return guide.languages
      .map(
        (language) =>
          LANGUAGE_FLAGS[
            language
          ] || "🌐"
      )
      .join(" ");
  }

  // ============================================
  // FORMATA TELEFONE
  // ============================================

  function formatGuidePhone(
    value: string
  ) {
    const numbers =
      value.replace(/\D/g, "");

    if (numbers.length === 11) {
      return `(${numbers.slice(
        0,
        2
      )}) ${numbers.slice(
        2,
        7
      )}-${numbers.slice(7)}`;
    }

    if (numbers.length === 10) {
      return `(${numbers.slice(
        0,
        2
      )}) ${numbers.slice(
        2,
        6
      )}-${numbers.slice(6)}`;
    }

    return value;
  }

  // ============================================
  // MÊS
  // ============================================

  const monthName = format(
    currentMonth,
    "MMMM yyyy",
    {
      locale: ptBR,
    }
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm sm:mt-6 sm:rounded-3xl sm:p-6">

      {/* ======================================== */}
      {/* CABEÇALHO */}
      {/* ======================================== */}

      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-5 md:flex-row md:items-center md:justify-between">

        <div>
          <h3 className="text-lg font-extrabold text-gray-900 sm:text-2xl">
            Agenda dos Guias
          </h3>

          <p className="mt-1 text-xs font-medium text-gray-600 sm:text-sm">
            Visualize a disponibilidade dos guias.
          </p>
        </div>

        <select
          value={selectedGuide}
          onChange={(event) =>
            setSelectedGuide(
              event.target.value
            )
          }
          className="w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none transition focus:border-[#1687d9] focus:ring-4 focus:ring-blue-100 sm:w-auto sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
        >
          <option value="all">
            Todos os guias
          </option>

          {guides.map((guide) => (
            <option
              key={guide.id}
              value={guide.id}
            >
              {guide.name}
              {!guide.active
                ? " (Inativo)"
                : ""}
            </option>
          ))}
        </select>

      </div>

      {/* ======================================== */}
      {/* NAVEGAÇÃO DO MÊS */}
      {/* ======================================== */}

      <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-50 p-2 sm:mb-6 sm:rounded-2xl sm:p-3">

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

        <h4 className="px-2 text-base font-extrabold capitalize text-gray-900 sm:text-2xl">
          {monthName}
        </h4>

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

      {/* ======================================== */}
      {/* LOADING */}
      {/* ======================================== */}

      {loading ? (
        <div className="py-10 text-center sm:py-12">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c] sm:h-9 sm:w-9" />

          <p className="mt-3 text-xs font-medium text-gray-600 sm:mt-4 sm:text-sm">
            Carregando agenda...
          </p>

        </div>
      ) : (
        <>

          {/* ==================================== */}
          {/* DIAS DA SEMANA */}
          {/* ==================================== */}

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-gray-800 sm:mb-3 sm:gap-2 sm:text-xs md:text-sm">

            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
            <div>Dom</div>

          </div>

          {/* ==================================== */}
          {/* CALENDÁRIO */}
          {/* ==================================== */}

          <div className="grid grid-cols-7 gap-1 sm:gap-2">

            {days.map((day) => {

              const date =
                format(
                  day,
                  "yyyy-MM-dd"
                );

              const sameMonth =
                isSameMonth(
                  day,
                  currentMonth
                );

              const dayItems =
                getDayAvailability(
                  date
                );

              const available =
                dayItems.filter(
                  (item) =>
                    item.status ===
                    "available"
                );

              const unavailable =
                dayItems.filter(
                  (item) =>
                    item.status ===
                    "unavailable"
                );

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() =>
                    sameMonth &&
                    setSelectedDate(
                      date
                    )
                  }
                  disabled={
                    !sameMonth
                  }
                  className={[
                    "min-h-[72px] rounded-lg border p-1 text-left transition",
                    "sm:min-h-28 sm:rounded-xl sm:p-2",

                    !sameMonth
                      ? "cursor-default border-transparent bg-gray-100 text-gray-400"
                      : "border-gray-200 bg-white hover:border-[#1687d9] hover:shadow-md",
                  ].join(" ")}
                >

                  {/* NÚMERO DO DIA */}

                  <div
                    className={[
                      "mb-1 text-right text-[10px] font-extrabold sm:mb-2 sm:text-sm",

                      sameMonth
                        ? "text-gray-900"
                        : "text-gray-400",
                    ].join(" ")}
                  >
                    {format(
                      day,
                      "d"
                    )}
                  </div>

                  {/* GUIAS */}

                  <div className="space-y-0.5 sm:space-y-1">

                    {/* ================================= */}
                    {/* DISPONÍVEIS */}
                    {/* ================================= */}

                    {available
                      .slice(0, 2)
                      .map(
                        (item) => (
                          <div
                            key={`available-${item.id}`}
                            className="truncate rounded bg-green-100 px-0.5 py-0.5 text-[8px] font-semibold leading-tight text-green-800 sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs"
                            title={getGuideName(
                              item.guide_id
                            )}
                          >
                            {getGuideFlags(
                              item.guide_id
                            )}{" "}
                            {getGuideName(
                              item.guide_id
                            )}
                          </div>
                        )
                      )}

                    {/* TERCEIRO DISPONÍVEL DESKTOP */}

                    {available.length >
                      2 && (
                      <div className="hidden sm:block">

                        {available
                          .slice(
                            2,
                            3
                          )
                          .map(
                            (item) => (
                              <div
                                key={`available-${item.id}`}
                                className="truncate rounded-lg bg-green-100 px-1.5 py-1 text-xs font-semibold text-green-800"
                                title={getGuideName(
                                  item.guide_id
                                )}
                              >
                                {getGuideFlags(
                                  item.guide_id
                                )}{" "}
                                {getGuideName(
                                  item.guide_id
                                )}
                              </div>
                            )
                          )}

                      </div>
                    )}

                    {/* MAIS DISPONÍVEIS MOBILE */}

                    {available.length >
                      2 && (
                      <div className="px-0.5 text-[8px] font-semibold leading-tight text-green-700 sm:hidden">
                        +
                        {available.length -
                          2}
                      </div>
                    )}

                    {/* MAIS DISPONÍVEIS DESKTOP */}

                    {available.length >
                      3 && (
                      <div className="hidden px-1 text-xs font-semibold text-green-700 sm:block">
                        +
                        {" "}
                        {available.length -
                          3}{" "}
                        disponíveis
                      </div>
                    )}

                    {/* ================================= */}
                    {/* INDISPONÍVEIS */}
                    {/* ================================= */}

                    {unavailable
                      .slice(0, 1)
                      .map(
                        (item) => (
                          <div
                            key={`unavailable-${item.id}`}
                            className="truncate rounded bg-red-100 px-0.5 py-0.5 text-[8px] font-semibold leading-tight text-red-800 sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs"
                            title={getGuideName(
                              item.guide_id
                            )}
                          >
                            {getGuideFlags(
                              item.guide_id
                            )}{" "}
                            {getGuideName(
                              item.guide_id
                            )}
                          </div>
                        )
                      )}

                    {/* SEGUNDO INDISPONÍVEL DESKTOP */}

                    {unavailable.length >
                      1 && (
                      <div className="hidden sm:block">

                        {unavailable
                          .slice(
                            1,
                            2
                          )
                          .map(
                            (item) => (
                              <div
                                key={`unavailable-${item.id}`}
                                className="truncate rounded-lg bg-red-100 px-1.5 py-1 text-xs font-semibold text-red-800"
                                title={getGuideName(
                                  item.guide_id
                                )}
                              >
                                {getGuideFlags(
                                  item.guide_id
                                )}{" "}
                                {getGuideName(
                                  item.guide_id
                                )}
                              </div>
                            )
                          )}

                      </div>
                    )}

                    {/* MAIS INDISPONÍVEIS MOBILE */}

                    {unavailable.length >
                      1 && (
                      <div className="px-0.5 text-[8px] font-semibold leading-tight text-red-700 sm:hidden">
                        +
                        {unavailable.length -
                          1}
                      </div>
                    )}

                    {/* MAIS INDISPONÍVEIS DESKTOP */}

                    {unavailable.length >
                      2 && (
                      <div className="hidden px-1 text-xs font-semibold text-red-700 sm:block">
                        +
                        {" "}
                        {unavailable.length -
                          2}{" "}
                        indisponíveis
                      </div>
                    )}

                  </div>

                </button>
              );
            })}

          </div>

          {/* ==================================== */}
          {/* LEGENDA */}
          {/* ==================================== */}

          <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-700 sm:mt-6 sm:gap-5 sm:pt-5 sm:text-sm">

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="h-3 w-3 rounded bg-green-100 ring-1 ring-green-200 sm:h-4 sm:w-4 sm:rounded-md" />
              Disponível
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-200 sm:h-4 sm:w-4 sm:rounded-md" />
              Indisponível
            </div>

          </div>

        </>
      )}

      {/* ======================================== */}
      {/* MODAL DO DIA */}
      {/* ======================================== */}

      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4"
          onClick={() =>
            setSelectedDate(null)
          }
        >

          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* CABEÇALHO */}

            <div className="flex items-start justify-between">

              <div>

                <h3 className="text-lg font-extrabold capitalize text-gray-900 sm:text-xl">
                  {format(
                    new Date(
                      `${selectedDate}T12:00:00`
                    ),
                    "dd 'de' MMMM",
                    {
                      locale:
                        ptBR,
                    }
                  )}
                </h3>

                <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">
                  Disponibilidade dos guias
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDate(
                    null
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold text-gray-700 transition hover:bg-gray-100 sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg"
                aria-label="Fechar"
              >
                ✕
              </button>

            </div>

            {/* ================================= */}
            {/* DISPONÍVEIS */}
            {/* ================================= */}

            <div className="mt-5 sm:mt-6">

              <h4 className="text-sm font-extrabold text-green-700 sm:text-base">
                🟢 Disponíveis
              </h4>

              <div className="mt-2 space-y-2">

                {selectedAvailable.length ===
                0 ? (
                  <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs font-medium text-gray-600 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
                    Nenhum guia marcado como disponível.
                  </p>
                ) : (
                  selectedAvailable.map(
                    (item) => {

                      const guide =
                        guideMap.get(
                          item.guide_id
                        );

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {

                            if (guide) {
                              setSelectedGuideDetails(
                                guide
                              );
                            }

                          }}
                          className="flex w-full items-center justify-between rounded-xl bg-green-50 px-4 py-3 text-left text-sm font-bold text-green-800 transition hover:bg-green-100"
                        >

                          <span>
                            {getGuideFlags(
                              item.guide_id
                            )}{" "}
                            {getGuideName(
                              item.guide_id
                            )}
                          </span>

                          <span className="text-green-600">
                            →
                          </span>

                        </button>
                      );
                    }
                  )
                )}

              </div>

            </div>

            {/* ================================= */}
            {/* INDISPONÍVEIS */}
            {/* ================================= */}

            <div className="mt-5 sm:mt-6">

              <h4 className="text-sm font-extrabold text-red-700 sm:text-base">
                🔴 Indisponíveis
              </h4>

              <div className="mt-2 space-y-2">

                {selectedUnavailable.length ===
                0 ? (
                  <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs font-medium text-gray-600 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
                    Nenhum guia marcado como indisponível.
                  </p>
                ) : (
                  selectedUnavailable.map(
                    (item) => {

                      const guide =
                        guideMap.get(
                          item.guide_id
                        );

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {

                            if (guide) {
                              setSelectedGuideDetails(
                                guide
                              );
                            }

                          }}
                          className="flex w-full items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-800 transition hover:bg-red-100"
                        >

                          <span>
                            {getGuideFlags(
                              item.guide_id
                            )}{" "}
                            {getGuideName(
                              item.guide_id
                            )}
                          </span>

                          <span className="text-red-600">
                            →
                          </span>

                        </button>
                      );
                    }
                  )
                )}

              </div>

            </div>

            {/* FECHAR */}

            <button
              type="button"
              onClick={() =>
                setSelectedDate(null)
              }
              className="mt-5 w-full rounded-lg bg-[#1687d9] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 transition hover:bg-[#0f75bd] sm:mt-6 sm:rounded-xl sm:py-3 sm:text-sm"
            >
              Fechar
            </button>

          </div>

        </div>
      )}

      {/* ======================================== */}
      {/* MODAL SIMPLES DO GUIA */}
      {/* ======================================== */}

      {selectedGuideDetails && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() =>
            setSelectedGuideDetails(
              null
            )
          }
        >

          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* CABEÇALHO */}

            <div className="flex items-start justify-between border-b border-gray-100 p-6">

              <div>

                <h3 className="text-xl font-extrabold text-gray-900">
                  {selectedGuideDetails.name}
                </h3>

                <p className="mt-1 text-sm font-medium text-gray-500">
                  Guia
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedGuideDetails(
                    null
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                aria-label="Fechar"
              >
                ✕
              </button>

            </div>

            {/* INFORMAÇÕES */}

            <div className="space-y-4 p-6">

              {/* EMAIL */}

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  E-mail
                </p>

                <p className="mt-1 break-all text-sm font-bold text-gray-800">
                  {selectedGuideDetails.email ||
                    "Não informado"}
                </p>

              </div>

              {/* TELEFONE */}

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Telefone
                </p>

                <p className="mt-1 text-sm font-bold text-gray-800">
                  {selectedGuideDetails.phone
                    ? formatGuidePhone(
                        selectedGuideDetails.phone
                      )
                    : "Não informado"}
                </p>

              </div>

              {/* FECHAR */}

              <button
                type="button"
                onClick={() =>
                  setSelectedGuideDetails(
                    null
                  )
                }
                className="w-full rounded-xl bg-[#1687d9] px-4 py-3 font-extrabold text-white shadow-md shadow-blue-200 transition hover:bg-[#0f75bd]"
              >
                Fechar
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}