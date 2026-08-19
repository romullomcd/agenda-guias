
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
  pix_key: string;
};

type Availability = {
  id: number;
  guide_id: string;
  date: string;
  status: "available" | "unavailable" | "escalated";
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
  const [currentMonth, setCurrentMonth] = useState(
    new Date()
  );

  const [guides, setGuides] = useState<Guide[]>([]);
  const [availability, setAvailability] = useState<
    Availability[]
  >([]);

  const [guideSearch, setGuideSearch] = useState("");

  const [selectedDate, setSelectedDate] = useState<
    string | null
  >(null);

  const [selectedGuideDetails, setSelectedGuideDetails] =
    useState<Guide | null>(null);

  const [
    selectedGuideAvailability,
    setSelectedGuideAvailability,
  ] = useState<Availability | null>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // ============================================================
  // CARREGAMENTO INICIAL / TROCA DE MÊS
  // ============================================================

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  // ============================================================
  // REALTIME
  // ============================================================

  useEffect(() => {
    const channel = supabase
      .channel("admin-availability-realtime")

      // ========================================================
      // NOVO REGISTRO
      // ========================================================

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "availability",
        },
        (payload) => {
          const newItem =
            payload.new as Availability;

          setAvailability((current) => {
            const alreadyExists = current.some(
              (item) => item.id === newItem.id
            );

            if (alreadyExists) {
              return current;
            }

            const firstDay = format(
              startOfMonth(currentMonth),
              "yyyy-MM-dd"
            );

            const lastDay = format(
              endOfMonth(currentMonth),
              "yyyy-MM-dd"
            );

            if (
              newItem.date < firstDay ||
              newItem.date > lastDay
            ) {
              return current;
            }

            return [...current, newItem].sort((a, b) =>
              a.date.localeCompare(b.date)
            );
          });
        }
      )

      // ========================================================
      // REGISTRO ATUALIZADO
      // ========================================================

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "availability",
        },
        (payload) => {
          const updatedItem =
            payload.new as Availability;

          setAvailability((current) =>
            current.map((item) =>
              item.id === updatedItem.id
                ? updatedItem
                : item
            )
          );

          // Se o guia que está aberto no modal foi alterado,
          // atualiza também o status mostrado no modal.
          setSelectedGuideAvailability((current) => {
            if (
              current &&
              current.id === updatedItem.id
            ) {
              return updatedItem;
            }

            return current;
          });
        }
      )

      // ========================================================
      // REGISTRO REMOVIDO
      // ========================================================

      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "availability",
        },
        (payload) => {
          const deletedItem =
            payload.old as Availability;

          setAvailability((current) =>
            current.filter(
              (item) =>
                item.id !== deletedItem.id
            )
          );

          setSelectedGuideAvailability((current) => {
            if (
              current &&
              current.id === deletedItem.id
            ) {
              return null;
            }

            return current;
          });
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMonth]);

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

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

    // ============================================================
    // GUIAS
    // ============================================================

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
              if (!session) {
                return {
                  ...guide,
                  languages:
                    guide.languages || [],
                  phone:
                    guide.phone || "",
                  email: "",
                  pix_key: "",
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
                  pix_key:
                    result.pix_key ||
                    result.pix ||
                    result.pixKey ||
                    "",
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
                  pix_key: "",
                };
              }
            }
          )
        );

      setGuides(guidesWithDetails);
    }

    // ============================================================
    // DISPONIBILIDADE
    // ============================================================

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

  // ============================================================
  // GUIAS FILTRADOS PELO NOME
  // ============================================================

  const normalizedSearch =
    guideSearch.trim().toLowerCase();

  const filteredGuides = useMemo(() => {
    if (!normalizedSearch) {
      return guides;
    }

    return guides.filter((guide) =>
      guide.name
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [guides, normalizedSearch]);

  // ============================================================
  // MAPA DOS GUIAS
  // ============================================================

  const guideMap = useMemo(() => {
    return new Map(
      guides.map((guide) => [
        guide.id,
        guide,
      ])
    );
  }, [guides]);

  // ============================================================
  // DISPONIBILIDADE FILTRADA
  // ============================================================

  const filteredAvailability = useMemo(() => {
    if (!normalizedSearch) {
      return availability;
    }

    const matchingGuideIds = new Set(
      filteredGuides.map(
        (guide) => guide.id
      )
    );

    return availability.filter((item) =>
      matchingGuideIds.has(
        item.guide_id
      )
    );
  }, [
    availability,
    filteredGuides,
    normalizedSearch,
  ]);

  // ============================================================
  // CALENDÁRIO
  // ============================================================

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

  // ============================================================
  // DIA SELECIONADO
  // ============================================================

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

  const selectedEscalated =
    selectedDayData.filter(
      (item) =>
        item.status === "escalated"
    );

  // ============================================================
  // DISPONIBILIDADE DO DIA
  // ============================================================

  function getDayAvailability(
    date: string
  ) {
    return filteredAvailability.filter(
      (item) =>
        item.date === date
    );
  }

  // ============================================================
  // NOME DO GUIA
  // ============================================================

  function getGuideName(
    guideId: string
  ) {
    return (
      guideMap.get(guideId)?.name ||
      "Guia"
    );
  }

  // ============================================================
  // BANDEIRAS
  // ============================================================

  function getGuideFlags(
    guideId: string
  ) {
    const guide =
      guideMap.get(guideId);

    if (
      !guide?.languages ||
      guide.languages.length === 0
    ) {
      return "";
    }

    return guide.languages
      .map(
        (language) =>
          LANGUAGE_FLAGS[
            language
          ] || ""
      )
      .filter(Boolean)
      .join(" ");
  }

  // ============================================================
  // TELEFONE
  // ============================================================

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

  // ============================================================
  // ESCALAR GUIA
  // ============================================================

  async function escalateGuide() {
    if (!selectedGuideAvailability) {
      return;
    }

    setUpdating(true);

    const { error } = await supabase
      .from("availability")
      .update({
        status: "escalated",
      })
      .eq(
        "id",
        selectedGuideAvailability.id
      );

    if (error) {
      console.error(
        "ERRO AO ESCALAR GUIA:",
        error
      );

      alert(
        "Não foi possível escalar o guia."
      );

      setUpdating(false);
      return;
    }

    setSelectedGuideDetails(null);
    setSelectedGuideAvailability(null);

    // Atualiza localmente sem precisar de loading.
    setAvailability((current) =>
      current.map((item) =>
        item.id ===
        selectedGuideAvailability.id
          ? {
              ...item,
              status: "escalated",
            }
          : item
      )
    );

    setUpdating(false);
  }

  // ============================================================
  // REMOVER ESCALA
  // ============================================================

  async function unEscalateGuide() {
    if (!selectedGuideAvailability) {
      return;
    }

    setUpdating(true);

    const { error } = await supabase
      .from("availability")
      .update({
        status: "available",
      })
      .eq(
        "id",
        selectedGuideAvailability.id
      );

    if (error) {
      console.error(
        "ERRO AO REMOVER ESCALA:",
        error
      );

      alert(
        "Não foi possível remover a escala."
      );

      setUpdating(false);
      return;
    }

    const availabilityId =
      selectedGuideAvailability.id;

    setSelectedGuideDetails(null);
    setSelectedGuideAvailability(null);

    // Atualiza localmente sem loading.
    setAvailability((current) =>
      current.map((item) =>
        item.id === availabilityId
          ? {
              ...item,
              status: "available",
            }
          : item
      )
    );

    setUpdating(false);
  }

  // ============================================================
  // MÊS
  // ============================================================

  const monthName = format(
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

      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-5 md:flex-row md:items-center md:justify-between">

        <div>
          <h3 className="text-lg font-extrabold text-gray-900 sm:text-2xl">
            Agenda dos Guias
          </h3>

          <p className="mt-1 text-xs font-medium text-gray-600 sm:text-sm">
            Visualize a disponibilidade e as escalas dos guias.
          </p>
        </div>

        {/* ================================================== */}
        {/* BUSCA DE GUIA */}
        {/* ================================================== */}

        <div className="relative w-full md:w-80">

          <input
            type="text"
            value={guideSearch}
            onChange={(event) =>
              setGuideSearch(
                event.target.value
              )
            }
            placeholder="Buscar guia pelo nome..."
            className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-100 sm:rounded-xl"
          />

          {guideSearch && (
            <button
              type="button"
              onClick={() =>
                setGuideSearch("")
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          )}

        </div>

      </div>

      {/* ====================================================== */}
      {/* RESULTADO DA BUSCA */}
      {/* ====================================================== */}

      {guideSearch.trim() && (
        <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800 sm:mb-6 sm:text-sm">
          {filteredGuides.length === 0 ? (
            <>
              Nenhum guia encontrado para "
              {guideSearch}".
            </>
          ) : (
            <>
              Mostrando a agenda de{" "}
              <strong>
                {filteredGuides.length}
              </strong>{" "}
              guia
              {filteredGuides.length !== 1
                ? "s"
                : ""}{" "}
              encontrado
              {filteredGuides.length !== 1
                ? "s"
                : ""}.
            </>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* NAVEGAÇÃO */}
      {/* ====================================================== */}

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
        >
          →
        </button>

      </div>

      {/* ====================================================== */}
      {/* LOADING */}
      {/* ====================================================== */}

      {loading ? (
        <div className="py-10 text-center sm:py-12">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c] sm:h-9 sm:w-9" />

          <p className="mt-3 text-xs font-medium text-gray-600 sm:mt-4 sm:text-sm">
            Carregando agenda...
          </p>

        </div>
      ) : (
        <>

          {/* ================================================== */}
          {/* DIAS DA SEMANA */}
          {/* ================================================== */}

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-gray-800 sm:mb-3 sm:gap-2 sm:text-xs md:text-sm">

            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
            <div>Dom</div>

          </div>

          {/* ================================================== */}
          {/* CALENDÁRIO */}
          {/* ================================================== */}

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

              const escalated =
                dayItems.filter(
                  (item) =>
                    item.status ===
                    "escalated"
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
                  disabled={!sameMonth}
                  className={[
                    "min-h-[72px] rounded-lg border p-1 text-left transition",
                    "sm:min-h-28 sm:rounded-xl sm:p-2",
                    !sameMonth
                      ? "cursor-default border-transparent bg-gray-100 text-gray-400"
                      : "border-gray-200 bg-white hover:border-[#1687d9] hover:shadow-md",
                  ].join(" ")}
                >

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

                  <div className="space-y-0.5 sm:space-y-1">

                    {/* ================================================== */}
                    {/* ESCALADOS */}
                    {/* ================================================== */}

                    {escalated
                      .slice(0, 2)
                      .map(
                        (item) => (
                          <div
                            key={`escalated-${item.id}`}
                            className="truncate rounded bg-[#f3e5a5] px-0.5 py-0.5 text-[8px] font-bold leading-tight text-[#806600] sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs"
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

                    {escalated.length >
                      2 && (
                      <div className="px-0.5 text-[8px] font-bold text-[#806600] sm:text-xs">
                        +
                        {escalated.length -
                          2}{" "}
                        escalados
                      </div>
                    )}

                    {/* ================================================== */}
                    {/* DISPONÍVEIS */}
                    {/* ================================================== */}

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

                    {available.length >
                      2 && (
                      <div className="px-0.5 text-[8px] font-semibold text-green-700">
                        +
                        {available.length -
                          2}
                      </div>
                    )}

                    {/* ================================================== */}
                    {/* INDISPONÍVEIS */}
                    {/* ================================================== */}

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

                    {unavailable.length >
                      1 && (
                      <div className="px-0.5 text-[8px] font-semibold text-red-700">
                        +
                        {unavailable.length -
                          1}
                      </div>
                    )}

                  </div>

                </button>
              );
            })}

          </div>

          {/* ================================================== */}
          {/* LEGENDA */}
          {/* ================================================== */}

          <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-700 sm:mt-6 sm:gap-5 sm:pt-5 sm:text-sm">

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="h-3 w-3 rounded bg-[#f3e5a5] ring-1 ring-[#d6c36a] sm:h-4 sm:w-4 sm:rounded-md" />
              Escalado
            </div>

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

      {/* ====================================================== */}
      {/* MODAL DO DIA */}
      {/* ====================================================== */}

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
                  setSelectedDate(null)
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold text-gray-700 transition hover:bg-gray-100 sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg"
              >
                ✕
              </button>

            </div>

            {/* ================================================== */}
            {/* ESCALADOS */}
            {/* ================================================== */}

            <div className="mt-5 sm:mt-6">

              <h4 className="text-sm font-extrabold text-[#806600] sm:text-base">
                🟡 Escalados
              </h4>

              <div className="mt-2 space-y-2">

                {selectedEscalated.length ===
                0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                    Nenhum guia escalado para este dia.
                  </p>
                ) : (
                  selectedEscalated.map(
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

                              setSelectedGuideAvailability(
                                item
                              );
                            }
                          }}
                          className="flex w-full items-center justify-between rounded-xl bg-[#f3e5a5] px-4 py-3 text-left text-sm font-bold text-[#806600] transition hover:bg-[#ead98c]"
                        >

                          <span>
                            {getGuideFlags(
                              item.guide_id
                            )}{" "}
                            {getGuideName(
                              item.guide_id
                            )}
                          </span>

                          <span>
                            →
                          </span>

                        </button>
                      );
                    }
                  )
                )}

              </div>

            </div>

            {/* ================================================== */}
            {/* DISPONÍVEIS */}
            {/* ================================================== */}

            <div className="mt-5 sm:mt-6">

              <h4 className="text-sm font-extrabold text-green-700 sm:text-base">
                🟢 Disponíveis
              </h4>

              <div className="mt-2 space-y-2">

                {selectedAvailable.length ===
                0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
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

                              setSelectedGuideAvailability(
                                item
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

            {/* ================================================== */}
            {/* INDISPONÍVEIS */}
            {/* ================================================== */}

            <div className="mt-5 sm:mt-6">

              <h4 className="text-sm font-extrabold text-red-700 sm:text-base">
                🔴 Indisponíveis
              </h4>

              <div className="mt-2 space-y-2">

                {selectedUnavailable.length ===
                0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
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

                              setSelectedGuideAvailability(
                                item
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

            <button
              type="button"
              onClick={() =>
                setSelectedDate(null)
              }
              className="mt-5 w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f75bd] sm:mt-6"
            >
              Fechar
            </button>

          </div>

        </div>
      )}

      {/* ====================================================== */}
      {/* MODAL DO GUIA */}
      {/* ====================================================== */}

      {selectedGuideDetails && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!updating) {
              setSelectedGuideDetails(null);
              setSelectedGuideAvailability(null);
            }
          }}
        >

          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* ================================================== */}
            {/* CABEÇALHO */}
            {/* ================================================== */}

            <div className="flex items-start justify-between border-b border-gray-100 p-6">

              <div>

                <h3 className="text-xl font-extrabold text-gray-900">
                  {getGuideFlags(
                    selectedGuideDetails.id
                  )}{" "}
                  {selectedGuideDetails.name}
                </h3>

                <p className="mt-1 text-sm font-medium text-gray-500">
                  Guia
                </p>

              </div>

              <button
                type="button"
                disabled={updating}
                onClick={() => {
                  setSelectedGuideDetails(null);
                  setSelectedGuideAvailability(null);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
              >
                ✕
              </button>

            </div>

            {/* ================================================== */}
            {/* INFORMAÇÕES */}
            {/* ================================================== */}

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

              {/* ================================================== */}
              {/* PIX */}
              {/* ================================================== */}

              <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-100">

                <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                  Chave PIX
                </p>

                <div className="mt-1 flex items-center justify-between gap-3">

                  <p className="break-all text-sm font-bold text-gray-800">
                    {selectedGuideDetails.pix_key ||
                      "Não informado"}
                  </p>

                  {selectedGuideDetails.pix_key && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          selectedGuideDetails.pix_key
                        );

                        alert(
                          "Chave PIX copiada!"
                        );
                      }}
                      className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-green-700 shadow-sm ring-1 ring-green-200 transition hover:bg-green-100"
                    >
                      Copiar
                    </button>
                  )}

                </div>

              </div>

              {/* ================================================== */}
              {/* BOTÃO DE ESCALA */}
              {/* ================================================== */}

              {selectedGuideAvailability?.status ===
                "available" && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={escalateGuide}
                  className="w-full rounded-xl bg-[#c9aa00] px-4 py-3 font-extrabold text-white shadow-md transition hover:bg-[#b59600] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updating
                    ? "Escalando..."
                    : "🟡 Escalar para este dia"}
                </button>
              )}

              {/* ================================================== */}
              {/* REMOVER ESCALA */}
              {/* ================================================== */}

              {selectedGuideAvailability?.status ===
                "escalated" && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={unEscalateGuide}
                  className="w-full rounded-xl bg-[#f3e5a5] px-4 py-3 font-extrabold text-[#806600] transition hover:bg-[#ead98c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updating
                    ? "Atualizando..."
                    : "↩️ Remover escala"}
                </button>
              )}

              {/* ================================================== */}
              {/* FECHAR */}
              {/* ================================================== */}

              <button
                type="button"
                disabled={updating}
                onClick={() => {
                  setSelectedGuideDetails(null);
                  setSelectedGuideAvailability(null);
                }}
                className="w-full rounded-xl bg-[#1687d9] px-4 py-3 font-extrabold text-white shadow-md shadow-blue-200 transition hover:bg-[#0f75bd] disabled:opacity-60"
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

