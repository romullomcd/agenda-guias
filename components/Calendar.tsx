"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

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

/* ============================================================
TIPOS
============================================================ */

type Availability = {
  id: number;
  date: string;
  status:
    | "available"
    | "unavailable"
    | "escalated";
};

type TourEvent = {
  id: number;
  date: string;
  title: string;
  description: string | null;
  address: string | null;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  guide_id: string | null;
  guide_email: string | null;
  additional_email: string | null;
  calendar_event_id: string | null;
  status:
    | "scheduled"
    | "cancelled";
  created_at: string;
  updated_at: string;
};

/* ============================================================
COMPONENTE
============================================================ */

export default function Calendar() {
  const [
    currentMonth,
    setCurrentMonth,
  ] = useState(
    new Date()
  );

  const currentMonthRef =
    useRef<Date>(
      currentMonth
    );

  currentMonthRef.current =
    currentMonth;

  const firstLoadRef =
    useRef(true);

  /* ============================================================
  SCROLL DESKTOP
  ============================================================ */

  const wheelLockRef =
    useRef(false);

  function handleCalendarWheel(
    event: React.WheelEvent<HTMLDivElement>
  ) {
    // Não interfere no mobile/tablet
    if (
      window.innerWidth < 1024
    ) {
      return;
    }

    if (
      wheelLockRef.current
    ) {
      return;
    }

    const deltaY =
      event.deltaY;

    if (
      Math.abs(deltaY) < 20
    ) {
      return;
    }

    event.preventDefault();

    wheelLockRef.current =
      true;

    if (deltaY > 0) {
      // Scroll para baixo = próximo mês
      setCurrentMonth(
        (current) =>
          addMonths(
            current,
            1
          )
      );
    } else {
      // Scroll para cima = mês anterior
      setCurrentMonth(
        (current) =>
          subMonths(
            current,
            1
          )
      );
    }

    setTimeout(() => {
      wheelLockRef.current =
        false;
    }, 350);
  }

  const [
    availability,
    setAvailability,
  ] = useState<
    Availability[]
  >([]);

  const [
    tourEvents,
    setTourEvents,
  ] = useState<
    TourEvent[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(
    true
  );

  /* ============================================================
  SWIPE MOBILE
  ============================================================ */

  const touchStartX =
    useRef<number | null>(null);

  const touchStartY =
    useRef<number | null>(null);

  function handleCalendarTouchStart(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    const touch =
      event.touches[0];

    if (!touch) {
      return;
    }

    touchStartX.current =
      touch.clientX;

    touchStartY.current =
      touch.clientY;
  }

  function handleCalendarTouchEnd(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    if (
      touchStartX.current ===
        null ||
      touchStartY.current ===
        null
    ) {
      return;
    }

    const touch =
      event.changedTouches[0];

    if (!touch) {
      return;
    }

    const deltaX =
      touch.clientX -
      touchStartX.current;

    const deltaY =
      touch.clientY -
      touchStartY.current;

    touchStartX.current =
      null;

    touchStartY.current =
      null;

    const minimumSwipeDistance =
      60;

    if (
      Math.abs(deltaX) <=
        Math.abs(deltaY)
    ) {
      return;
    }

    if (
      Math.abs(deltaX) <
      minimumSwipeDistance
    ) {
      return;
    }

    // Esquerda = próximo mês
    if (deltaX < 0) {
      setCurrentMonth(
        (current) =>
          addMonths(
            current,
            1
          )
      );

      return;
    }

    // Direita = mês anterior
    setCurrentMonth(
      (current) =>
        subMonths(
          current,
          1
        )
    );
  }

  /* ============================================================
  MODAL DO TOUR
  ============================================================ */

  const [
    selectedTour,
    setSelectedTour,
  ] = useState<
    TourEvent | null
  >(null);

  const [
    showTourModal,
    setShowTourModal,
  ] = useState(
    false
  );

  /* ============================================================
  CARREGAR DADOS DO MÊS
  ============================================================ */

  async function loadAvailability(
    showLoading = false,
    month =
      currentMonthRef.current
  ) {
    if (
      showLoading
    ) {
      setLoading(
        true
      );
    }

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase.auth.getUser();

    if (
      userError
    ) {
      console.error(
        "ERRO AO PEGAR USUÁRIO:",
        userError
      );
    }

    if (!user) {
      window.location.href =
        "/";

      return;
    }

    const firstDay =
      format(
        startOfMonth(
          month
        ),
        "yyyy-MM-dd"
      );

    const lastDay =
      format(
        endOfMonth(
          month
        ),
        "yyyy-MM-dd"
      );

    const [
      availabilityResult,
      tourEventsResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "availability"
          )
          .select(
            "id, date, status"
          )
          .eq(
            "guide_id",
            user.id
          )
          .gte(
            "date",
            firstDay
          )
          .lte(
            "date",
            lastDay
          )
          .order(
            "date"
          ),

        supabase
          .from(
            "tour_events"
          )
          .select(
            "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
          )
          .eq(
            "guide_id",
            user.id
          )
          .eq(
            "status",
            "scheduled"
          )
          .gte(
            "date",
            firstDay
          )
          .lte(
            "date",
            lastDay
          )
          .order(
            "date"
          ),
      ]);

    /* ==========================================================
       AVAILABILITY
    ========================================================== */

    if (
      availabilityResult.error
    ) {
      console.error(
        "ERRO AO CARREGAR DISPONIBILIDADE:",
        String(
          availabilityResult
            .error.message
        ),
        "CODE:",
        String(
          availabilityResult
            .error.code
        ),
        "DETAILS:",
        String(
          availabilityResult
            .error.details
        ),
        "HINT:",
        String(
          availabilityResult
            .error.hint
        )
      );
    } else {
      setAvailability(
        availabilityResult.data ||
          []
      );
    }

    /* ==========================================================
       TOURS
    ========================================================== */

    if (
      tourEventsResult.error
    ) {
      console.error(
        "ERRO AO CARREGAR TOURS:",
        String(
          tourEventsResult
            .error.message
        ),
        "CODE:",
        String(
          tourEventsResult
            .error.code
        ),
        "DETAILS:",
        String(
          tourEventsResult
            .error.details
        ),
        "HINT:",
        String(
          tourEventsResult
            .error.hint
        )
      );
    } else {
      setTourEvents(
        tourEventsResult.data ||
          []
      );
    }

    if (
      showLoading
    ) {
      setLoading(
        false
      );
    }
  }

  /* ============================================================
  CARREGAMENTO DO MÊS
  ============================================================ */

  useEffect(() => {
    const showInitialLoading =
      firstLoadRef.current;

    firstLoadRef.current =
      false;

    loadAvailability(
      showInitialLoading,
      currentMonth
    );
  }, [
    currentMonth,
  ]);

  /* ============================================================
  REALTIME
  ============================================================ */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          "guide-availability-calendar"
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "availability",
          },
          async () => {
            await loadAvailability(
              false,
              currentMonthRef.current
            );
          }
        )

        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tour_events",
          },
          async () => {
            await loadAvailability(
              false,
              currentMonthRef.current
            );
          }
        )

        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tour_events",
          },
          async () => {
            await loadAvailability(
              false,
              currentMonthRef.current
            );
          }
        )

        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "tour_events",
          },
          async () => {
            await loadAvailability(
              false,
              currentMonthRef.current
            );
          }
        )

        .subscribe(
          (status) => {
            console.log(
              "📡 GUIDE CALENDAR REALTIME:",
              status
            );
          }
        );

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  /* ============================================================
  ALTERAR DIA
  ============================================================ */

  async function toggleDay(
    day: Date
  ) {
    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      window.location.href =
        "/";

      return;
    }

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

    if (
      existing?.status ===
      "escalated"
    ) {
      return;
    }

    /* ==========================================================
       NÃO MARCADO → DISPONÍVEL
    ========================================================== */

    if (!existing) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "availability"
          )
          .insert({
            guide_id:
              user.id,

            date,

            status:
              "available",
          })
          .select(
            "id, date, status"
          )
          .single();

      if (error) {
        console.error(
          "ERRO AO CRIAR DISPONIBILIDADE:",
          String(
            error.message
          ),
          "CODE:",
          String(
            error.code
          ),
          "DETAILS:",
          String(
            error.details
          ),
          "HINT:",
          String(
            error.hint
          )
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

    /* ==========================================================
       DISPONÍVEL → INDISPONÍVEL
    ========================================================== */

    if (
      existing.status ===
      "available"
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "availability"
          )
          .update({
            status:
              "unavailable",
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
          String(
            error.message
          ),
          "CODE:",
          String(
            error.code
          ),
          "DETAILS:",
          String(
            error.details
          ),
          "HINT:",
          String(
            error.hint
          )
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

    /* ==========================================================
       INDISPONÍVEL → REMOVE
    ========================================================== */

    if (
      existing.status ===
      "unavailable"
    ) {
      const {
        error,
      } =
        await supabase
          .from(
            "availability"
          )
          .delete()
          .eq(
            "id",
            existing.id
          );

      if (error) {
        console.error(
          "ERRO AO REMOVER DISPONIBILIDADE:",
          String(
            error.message
          ),
          "CODE:",
          String(
            error.code
          ),
          "DETAILS:",
          String(
            error.details
          ),
          "HINT:",
          String(
            error.hint
          )
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

  /* ============================================================
  ABRIR TOUR ESCALADO
  ============================================================ */

  function openEscalatedTour(
    date: string
  ) {
    const tour =
      tourEvents.find(
        (event) =>
          event.date ===
            date &&
          event.status ===
            "scheduled"
      );

    if (!tour) {
      alert(
        "Este dia está escalado, mas ainda não foi encontrado um tour vinculado."
      );

      return;
    }

    setSelectedTour(
      tour
    );

    setShowTourModal(
      true
    );
  }

  /* ============================================================
  FECHAR MODAL
  ============================================================ */

  function closeTourModal() {
    setShowTourModal(
      false
    );

    setSelectedTour(
      null
    );
  }

  /* ============================================================
  CALENDÁRIO
  ============================================================ */

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
      start:
        calendarStart,
      end:
        calendarEnd,
    });

  /* ============================================================
  MÊS
  ============================================================ */

  const monthName =
    format(
      currentMonth,
      "MMMM yyyy",
      {
        locale:
          ptBR,
      }
    );

  /* ============================================================
  MODAL VIA PORTAL
  ============================================================ */

  const tourModal =
    showTourModal &&
    selectedTour
      ? createPortal(
          <div
            className="fixed inset-0 z-[999999] flex min-h-[100dvh] w-full items-start justify-center overflow-y-auto bg-black/55 px-4 pb-4 pt-4 backdrop-blur-sm"
            style={{
              paddingTop:
                "max(16px, env(safe-area-inset-top))",

              paddingBottom:
                "max(16px, env(safe-area-inset-bottom))",
            }}
            onClick={
              closeTourModal
            }
          >
            <div
              className="relative my-0 flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-black"
              style={{
                maxHeight:
                  "calc(100dvh - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom)) - 16px)",
              }}
              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
            >

              {/* CABEÇALHO */}

              <div className="shrink-0 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-black px-5 py-5 sm:px-6 sm:py-6">

                <div className="flex w-full items-start gap-3">

                  <div className="min-w-0 flex-1">

                    <span className="inline-flex max-w-full items-center rounded-full bg-[#f3e5a5] px-3 py-1 text-xs font-extrabold text-[#806600]">
                      Tour escalado
                    </span>

                    <h3 className="mt-3 break-words text-xl font-extrabold leading-tight text-gray-900 dark:text-white sm:text-2xl">
                      {
                        selectedTour.title
                      }
                    </h3>

                  </div>

                  <button
                    type="button"
                    onClick={
                      closeTourModal
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-gray-500 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white"
                    aria-label="Fechar"
                  >
                    ✕
                  </button>

                </div>

              </div>

              {/* CONTEÚDO */}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">

                <div className="space-y-4">

                  <div className="rounded-2xl bg-blue-50 p-4">

                    <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                      Data
                    </p>

                    <p className="mt-1 text-sm font-extrabold capitalize text-blue-900">
                      {
                        format(
                          new Date(
                            `${selectedTour.date}T12:00:00`
                          ),
                          "dd 'de' MMMM 'de' yyyy",
                          {
                            locale:
                              ptBR,
                          }
                        )
                      }
                    </p>

                    <p className="mt-2 text-sm font-bold text-blue-800">
                      {
                        selectedTour.all_day
                          ? "📅 Dia inteiro"
                          : `🕐 ${
                              selectedTour.start_time ||
                              "09:00"
                            } às ${
                              selectedTour.end_time ||
                              "10:00"
                            }`
                      }
                    </p>

                  </div>

                  <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Descrição
                    </p>

                    {
                      selectedTour.description ? (
                        <div
                          className="mt-2 break-words text-sm font-medium leading-7 text-gray-800 dark:text-gray-100 [&_b]:font-black [&_strong]:font-black [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                          dangerouslySetInnerHTML={{
                            __html:
                              selectedTour.description,
                          }}
                        />
                      ) : (
                        <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-300">
                          Nenhuma descrição informada.
                        </p>
                      )
                    }

                  </div>

                  <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Endereço
                    </p>

                    <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold text-gray-800 dark:text-gray-100">
                      {
                        selectedTour.address ||
                        "Nenhum endereço informado."
                      }
                    </p>

                  </div>

                  {
                    selectedTour.additional_email && (
                      <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          E-mail adicional
                        </p>

                        <p className="mt-1 break-all text-sm font-bold text-gray-800 dark:text-gray-100">
                          {
                            selectedTour.additional_email
                          }
                        </p>

                      </div>
                    )
                  }

                  <div className="rounded-2xl bg-yellow-50 p-4">

                    <p className="text-xs font-bold uppercase tracking-wide text-yellow-600">
                      Status
                    </p>

                    <p className="mt-1 text-sm font-extrabold text-[#806600]">
                      🟡 Você está escalado para este tour.
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={
                      closeTourModal
                    }
                    className="w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#0f75bd]"
                  >
                    Fechar
                  </button>

                </div>

              </div>

            </div>
          </div>,
          document.body
        )
      : null;

  /* ============================================================
  RENDER
  ============================================================ */

  return (
    <>
      <div
        onWheel={
          handleCalendarWheel
        }
        className="
          mt-4
          rounded-2xl
          border
          border-gray-200
          bg-white
          p-3
          shadow-sm
          dark:border-gray-700
          dark:bg-black

          sm:mt-6
          sm:rounded-3xl
          sm:p-6

          lg:mt-0
          lg:flex
          lg:h-[calc(100dvh-140px)]
          lg:min-h-0
          lg:flex-col
          lg:rounded-2xl
          lg:p-4
        "
      >

        {/* ====================================================== */}
        {/* CABEÇALHO */}
        {/* ====================================================== */}

        <div
          className="
            mb-4
            flex
            items-center
            justify-between
            rounded-xl
            bg-gray-50
            p-2

            dark:bg-gray-900

            sm:mb-6
            sm:rounded-2xl
            sm:p-3

            lg:mb-3
            lg:shrink-0
          "
        >

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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-extrabold text-gray-900 shadow-sm transition dark:border-gray-700 dark:bg-black dark:text-white hover:border-[#e91e8c] hover:bg-pink-50 hover:text-[#e91e8c] sm:h-11 sm:w-11 sm:rounded-xl sm:border-2 sm:text-xl"
            aria-label="Mês anterior"
          >
            ←
          </button>

          <h4 className="text-base font-extrabold capitalize text-gray-900 dark:text-white sm:text-xl md:text-2xl lg:text-xl">
            {
              monthName
            }
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-extrabold text-gray-900 shadow-sm transition dark:border-gray-700 dark:bg-black dark:text-white hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] sm:h-11 sm:w-11 sm:rounded-xl sm:border-2 sm:text-xl"
            aria-label="Próximo mês"
          >
            →
          </button>

        </div>

        {/* ====================================================== */}
        {/* DIAS DA SEMANA */}
        {/* ====================================================== */}

        <div
          className="
            mb-2
            grid
            grid-cols-7
            gap-1
            text-center
            text-[10px]
            font-extrabold
            uppercase
            tracking-wide
            text-gray-700
            dark:text-gray-200

            sm:mb-3
            sm:gap-2
            sm:text-xs

            md:text-sm

            lg:mb-2
            lg:shrink-0
            lg:gap-2
            lg:text-xs
          "
        >

          <div>
            Seg
          </div>

          <div>
            Ter
          </div>

          <div>
            Qua
          </div>

          <div>
            Qui
          </div>

          <div>
            Sex
          </div>

          <div>
            Sáb
          </div>

          <div>
            Dom
          </div>

        </div>

        {/* ====================================================== */}
        {/* CALENDÁRIO */}
        {/* ====================================================== */}

        {
          loading ? (
            <div className="py-10 text-center sm:py-12 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:items-center lg:justify-center">

              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-[#e91e8c] sm:h-9 sm:w-9" />

              <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300 sm:mt-4">
                Carregando calendário...
              </p>

            </div>
          ) : (
            <>
              <div
                onTouchStart={
                  handleCalendarTouchStart
                }
                onTouchEnd={
                  handleCalendarTouchEnd
                }
                className="
                  touch-pan-y

                  lg:min-h-0
                  lg:flex-1
                  lg:overflow-hidden
                "
              >

                <div
                  className="
                    grid
                    grid-cols-7
                    gap-1

                    sm:gap-2

                    lg:h-full
                    lg:min-h-0
                    lg:gap-2
                    lg:auto-rows-fr
                  "
                >

                  {
                    days.map(
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
                          sameMonth
                            ? "border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-black dark:text-white hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                            : "border-transparent bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-500";

                        /* ==================================================
                           DISPONÍVEL
                        ================================================== */

                        if (
                          sameMonth &&
                          existing?.status ===
                            "available"
                        ) {
                          dayClass =
                            "border-green-500 bg-green-500 text-white hover:bg-green-600";
                        }

                        /* ==================================================
                           INDISPONÍVEL
                        ================================================== */

                        if (
                          sameMonth &&
                          existing?.status ===
                            "unavailable"
                        ) {
                          dayClass =
                            "border-red-500 bg-red-500 text-white hover:bg-red-600";
                        }

                        /* ==================================================
                           ESCALADO
                        ================================================== */

                        if (
                          sameMonth &&
                          isEscalated
                        ) {
                          dayClass =
                            "border-[#b59600] bg-[#c9aa00] text-white shadow-inner hover:bg-[#b59600]";
                        }

                        return (
                          <button
                            key={
                              date
                            }
                            type="button"
                            onClick={() => {

                              if (
                                !sameMonth
                              ) {
                                return;
                              }

                              if (
                                isEscalated
                              ) {
                                openEscalatedTour(
                                  date
                                );

                                return;
                              }

                              toggleDay(
                                day
                              );

                            }}
                            disabled={
                              loading ||
                              !sameMonth
                            }
                            title={
                              isEscalated
                                ? "Clique para ver as informações do tour"
                                : undefined
                            }
                            className={[
                              "aspect-square rounded-lg border text-xs font-extrabold transition sm:rounded-xl sm:text-sm md:text-base",

                              /*
                               * MOBILE/TABLET:
                               * continua exatamente como antes.
                               *
                               * DESKTOP:
                               * deixa de forçar quadrado e
                               * ocupa a altura disponível.
                               */
                              "lg:aspect-auto lg:h-full lg:min-h-0 lg:rounded-lg lg:text-sm",

                              dayClass,

                              isEscalated &&
                              sameMonth
                                ? "cursor-pointer"
                                : "",
                            ].join(
                              " "
                            )}
                          >
                            {
                              format(
                                day,
                                "d"
                              )
                            }
                          </button>
                        );
                      }
                    )
                  }

                </div>

              </div>

              {/* ==================================================== */}
              {/* LEGENDA */}
              {/* ==================================================== */}

              <div
                className="
                  mt-4
                  flex
                  flex-wrap
                  items-center
                  gap-x-4
                  gap-y-2
                  border-t
                  border-gray-100
                  pt-4
                  text-xs
                  font-semibold
                  text-gray-700
                  dark:border-gray-800
                  dark:text-gray-200

                  sm:mt-6
                  sm:gap-5
                  sm:pt-5
                  sm:text-sm

                  lg:mt-3
                  lg:shrink-0
                  lg:pt-3
                  lg:text-xs
                "
              >

                <div className="flex items-center gap-1.5 sm:gap-2">

                  <span className="h-3 w-3 rounded-md bg-[#c9aa00] ring-1 ring-black dark:ring-white sm:h-4 sm:w-4" />

                  <span>
                    Escalado
                  </span>

                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">

                  <span className="h-3 w-3 rounded-md bg-green-500 ring-1 ring-black dark:ring-white sm:h-4 sm:w-4" />

                  <span>
                    Disponível
                  </span>

                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">

                  <span className="h-3 w-3 rounded-md bg-red-500 ring-1 ring-black dark:ring-white sm:h-4 sm:w-4" />

                  <span>
                    Indisponível
                  </span>

                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">

                  <span className="h-3 w-3 rounded-md bg-white ring-1 ring-black dark:bg-black dark:ring-white sm:h-4 sm:w-4" />

                  <span>
                    Não marcado
                  </span>

                </div>

              </div>

              {/* ==================================================== */}
              {/* AVISO */}
              {/* ==================================================== */}

              {
                availability.some(
                  (item) =>
                    item.status ===
                    "escalated"
                ) && (
                  <div
                    className="
                      mt-4
                      rounded-xl
                      border
                      border-[#d6c36a]
                      bg-[#fff9d9]
                      px-4
                      py-3
                      text-xs
                      font-semibold
                      text-[#806600]

                      sm:mt-5
                      sm:rounded-2xl
                      sm:text-sm

                      lg:mt-3
                      lg:shrink-0
                      lg:py-2.5
                      lg:text-xs
                    "
                  >

                    🟡 Os dias em mostarda foram escalados pelo
                    administrador. Clique em um dia escalado para
                    visualizar as informações do tour.

                  </div>
                )
              }

            </>
          )
        }

      </div>

      {
        tourModal
      }

    </>
  );
}