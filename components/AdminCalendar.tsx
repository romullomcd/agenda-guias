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

/* ============================================================
   TIPOS
   ============================================================ */

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

type TourEvent = {
  id: number;
  date: string;
  title: string;
  description: string | null;
  all_day: boolean;
  guide_id: string;
  guide_email: string;
  additional_email: string | null;
  calendar_event_id: string | null;
  status: "scheduled" | "cancelled";
  created_at: string;
  updated_at: string;
};

/* ============================================================
   BANDEIRAS
   ============================================================ */

const LANGUAGE_FLAGS: Record<string, string> = {
  Português: "/flags/br.png",
  Inglês: "/flags/us.png",
  Espanhol: "/flags/es.png",
  Francês: "/flags/fr.png",
  Italiano: "/flags/it.png",
  Alemão: "/flags/de.png",
  Mandarim: "/flags/cn.png",
  Japonês: "/flags/jp.png",
};

/* ============================================================
   COMPONENTE
   ============================================================ */

export default function AdminCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [guides, setGuides] = useState<Guide[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [tourEvents, setTourEvents] = useState<TourEvent[]>([]);

  const [guideSearch, setGuideSearch] = useState("");

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [selectedGuideDetails, setSelectedGuideDetails] =
    useState<Guide | null>(null);

  const [selectedGuideAvailability, setSelectedGuideAvailability] =
    useState<Availability | null>(null);

  const [selectedTourEvent, setSelectedTourEvent] =
    useState<TourEvent | null>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  /* ============================================================
     FORMULÁRIO DE TOUR
     ============================================================ */

  const [showTourForm, setShowTourForm] = useState(false);

  const [tourTitle, setTourTitle] = useState("");
  const [tourDescription, setTourDescription] = useState("");
  const [tourAllDay, setTourAllDay] = useState(true);
  const [tourGuideId, setTourGuideId] = useState("");
  const [tourAdditionalEmail, setTourAdditionalEmail] = useState("");

  /* ============================================================
     EDIÇÃO DE TOUR
     ============================================================ */

  const [showTourEdit, setShowTourEdit] = useState(false);

  const [editTourTitle, setEditTourTitle] = useState("");
  const [editTourDescription, setEditTourDescription] = useState("");
  const [editTourAllDay, setEditTourAllDay] = useState(true);
  const [editTourGuideId, setEditTourGuideId] = useState("");
  const [editTourAdditionalEmail, setEditTourAdditionalEmail] =
    useState("");

  /* ============================================================
     CARREGAMENTO
     ============================================================ */

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  /* ============================================================
     REALTIME - AVAILABILITY + TOUR EVENTS
     ============================================================ */

  useEffect(() => {
    const channel = supabase
      .channel("admin-calendar-realtime")

      /* ========================================================
         AVAILABILITY INSERT
         ======================================================== */

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "availability",
        },
        (payload) => {
          const newItem = payload.new as Availability;

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

      /* ========================================================
         AVAILABILITY UPDATE
         ======================================================== */

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "availability",
        },
        (payload) => {
          const updatedItem = payload.new as Availability;

          setAvailability((current) =>
            current.map((item) =>
              item.id === updatedItem.id
                ? updatedItem
                : item
            )
          );

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

      /* ========================================================
         AVAILABILITY DELETE
         ======================================================== */

      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "availability",
        },
        (payload) => {
          const deletedItem = payload.old as Availability;

          setAvailability((current) =>
            current.filter(
              (item) => item.id !== deletedItem.id
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

      /* ========================================================
         TOUR EVENT INSERT
         ======================================================== */

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tour_events",
        },
        (payload) => {
          const newEvent = payload.new as TourEvent;

          const firstDay = format(
            startOfMonth(currentMonth),
            "yyyy-MM-dd"
          );

          const lastDay = format(
            endOfMonth(currentMonth),
            "yyyy-MM-dd"
          );

          if (
            newEvent.date < firstDay ||
            newEvent.date > lastDay
          ) {
            return;
          }

          setTourEvents((current) => {
            const alreadyExists = current.some(
              (event) => event.id === newEvent.id
            );

            if (alreadyExists) {
              return current;
            }

            return [...current, newEvent].sort((a, b) =>
              a.date.localeCompare(b.date)
            );
          });
        }
      )

      /* ========================================================
         TOUR EVENT UPDATE
         ======================================================== */

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tour_events",
        },
        (payload) => {
          const updatedEvent = payload.new as TourEvent;

          setTourEvents((current) =>
            current.map((event) =>
              event.id === updatedEvent.id
                ? updatedEvent
                : event
            )
          );

          setSelectedTourEvent((current) => {
            if (
              current &&
              current.id === updatedEvent.id
            ) {
              return updatedEvent;
            }

            return current;
          });
        }
      )

      /* ========================================================
         TOUR EVENT DELETE
         ======================================================== */

      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "tour_events",
        },
        (payload) => {
          const deletedEvent = payload.old as TourEvent;

          setTourEvents((current) =>
            current.filter(
              (event) => event.id !== deletedEvent.id
            )
          );

          setSelectedTourEvent((current) => {
            if (
              current &&
              current.id === deletedEvent.id
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

  /* ============================================================
     CARREGAR DADOS
     ============================================================ */

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

    const [
      guidesResult,
      availabilityResult,
      tourEventsResult,
    ] = await Promise.all([
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

      supabase
        .from("tour_events")
        .select(
          "id, date, title, description, all_day, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
        )
        .gte("date", firstDay)
        .lte("date", lastDay)
        .order("date"),
    ]);

    /* ============================================================
       GUIAS
       ============================================================ */

    if (guidesResult.error) {
      console.error(
        "ERRO AO CARREGAR GUIAS:",
        guidesResult.error
      );
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const guidesWithDetails = await Promise.all(
        (guidesResult.data || []).map(
          async (guide) => {
            if (!session) {
              return {
                ...guide,
                languages: guide.languages || [],
                phone: guide.phone || "",
                email: "",
                pix_key: "",
              };
            }

            try {
              const response = await fetch(
                `/api/guides/${guide.id}`,
                {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                  },
                }
              );

              const result = await response.json();

              return {
                ...guide,
                languages: guide.languages || [],
                phone: guide.phone || "",
                email: result.email || "",
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
                languages: guide.languages || [],
                phone: guide.phone || "",
                email: "",
                pix_key: "",
              };
            }
          }
        )
      );

      setGuides(guidesWithDetails);
    }

    /* ============================================================
       AVAILABILITY
       ============================================================ */

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

    /* ============================================================
       TOUR EVENTS
       ============================================================ */

    if (tourEventsResult.error) {
      console.error(
        "ERRO AO CARREGAR TOURS:",
        tourEventsResult.error
      );
    } else {
      setTourEvents(
        tourEventsResult.data || []
      );
    }

    setLoading(false);
  }

  /* ============================================================
     BUSCA
     ============================================================ */

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

  /* ============================================================
     MAPA DE GUIAS
     ============================================================ */

  const guideMap = useMemo(() => {
    return new Map(
      guides.map((guide) => [
        guide.id,
        guide,
      ])
    );
  }, [guides]);

  /* ============================================================
     AVAILABILITY FILTRADA
     ============================================================ */

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

  /* ============================================================
     EVENTOS FILTRADOS
     ============================================================ */

  const filteredTourEvents = useMemo(() => {
    if (!normalizedSearch) {
      return tourEvents;
    }

    const matchingGuideIds = new Set(
      filteredGuides.map(
        (guide) => guide.id
      )
    );

    return tourEvents.filter((event) =>
      matchingGuideIds.has(
        event.guide_id
      )
    );
  }, [
    tourEvents,
    filteredGuides,
    normalizedSearch,
  ]);

  /* ============================================================
     CALENDÁRIO
     ============================================================ */

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

  /* ============================================================
     DIA SELECIONADO
     ============================================================ */

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

  const selectedDayEvents = selectedDate
    ? filteredTourEvents.filter(
        (event) =>
          event.date === selectedDate
      )
    : [];

  /* ============================================================
     DATA DO DIA
     ============================================================ */

  function getDayAvailability(date: string) {
    return filteredAvailability.filter(
      (item) =>
        item.date === date
    );
  }

  function getDayTourEvents(date: string) {
    return filteredTourEvents.filter(
      (event) =>
        event.date === date &&
        event.status === "scheduled"
    );
  }

  /* ============================================================
     NOME DO GUIA
     ============================================================ */

  function getGuideName(guideId: string) {
    return (
      guideMap.get(guideId)?.name ||
      "Guia"
    );
  }

  /* ============================================================
     BANDEIRAS
     ============================================================ */

  function getGuideFlags(guideId: string) {
    const guide = guideMap.get(guideId);

    if (
      !guide?.languages ||
      guide.languages.length === 0
    ) {
      return null;
    }

    return (
      <span className="inline-flex items-center gap-0.5 align-middle">
        {guide.languages.map((language) => {
          const flag = LANGUAGE_FLAGS[language];

          if (!flag) {
            return null;
          }

          return (
            <img
              key={`${guideId}-${language}`}
              src={flag}
              alt={language}
              title={language}
              className="inline-block h-3.5 w-5 rounded-sm object-cover sm:h-4 sm:w-6"
            />
          );
        })}
      </span>
    );
  }

  /* ============================================================
     TELEFONE
     ============================================================ */

  function formatGuidePhone(value: string) {
    const numbers = value.replace(/\D/g, "");

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

  /* ============================================================
     ESCALAR GUIA
     ============================================================ */

  function openEscalationForm() {
    if (!selectedGuideAvailability) {
      return;
    }

    const guide = guideMap.get(
      selectedGuideAvailability.guide_id
    );

    if (!guide) {
      alert("Guia não encontrado.");
      return;
    }

    setTourGuideId(guide.id);
    setTourTitle(
      `Tour - ${guide.name}`
    );
    setTourDescription("");
    setTourAllDay(true);
    setTourAdditionalEmail("");

    setSelectedGuideDetails(null);
    setShowTourForm(true);
  }

  /* ============================================================
     CRIAR TOUR + ESCALAR
     ============================================================ */

  async function createTourAndEscalate() {
    if (
      !selectedGuideAvailability ||
      !selectedDate
    ) {
      return;
    }

    const guide = guideMap.get(
      tourGuideId
    );

    if (!guide) {
      alert("Selecione um guia válido.");
      return;
    }

    if (!tourTitle.trim()) {
      alert("Informe o título do tour.");
      return;
    }

    if (!guide.email) {
      alert(
        "Este guia não possui e-mail cadastrado."
      );
      return;
    }

    setUpdating(true);

    try {
      /* ========================================================
         CRIA O EVENTO
         ======================================================== */

      const { data: newEvent, error: eventError } =
        await supabase
          .from("tour_events")
          .insert({
            date: selectedDate,
            title: tourTitle.trim(),
            description:
              tourDescription.trim() || null,
            all_day: tourAllDay,
            guide_id: guide.id,
            guide_email: guide.email,
            additional_email:
              tourAdditionalEmail.trim() || null,
            calendar_event_id: null,
            status: "scheduled",
          })
          .select(
            "id, date, title, description, all_day, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
          )
          .single();

      if (eventError) {
        console.error(
          "ERRO AO CRIAR TOUR:",
          eventError
        );

        alert(
          "Não foi possível criar o tour."
        );

        setUpdating(false);
        return;
      }

      /* ========================================================
         MARCA O GUIA COMO ESCALADO
         ======================================================== */

      const {
        error: availabilityError,
      } = await supabase
        .from("availability")
        .update({
          status: "escalated",
        })
        .eq(
          "id",
          selectedGuideAvailability.id
        );

      if (availabilityError) {
        console.error(
          "ERRO AO ESCALAR GUIA:",
          availabilityError
        );

        /*
         * Se o evento foi criado mas a escala falhou,
         * removemos o evento para evitar inconsistência.
         */

        await supabase
          .from("tour_events")
          .delete()
          .eq(
            "id",
            newEvent.id
          );

        alert(
          "O tour não pôde ser associado à escala do guia."
        );

        setUpdating(false);
        return;
      }

      /* ========================================================
         ATUALIZA ESTADO LOCAL
         ======================================================== */

      setTourEvents((current) => [
        ...current,
        newEvent,
      ]);

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

      setShowTourForm(false);
      setSelectedGuideAvailability(null);

      alert(
        "Tour criado e guia escalado com sucesso!"
      );
    } catch (error) {
      console.error(
        "ERRO AO CRIAR TOUR:",
        error
      );

      alert(
        "Ocorreu um erro ao criar o tour."
      );
    } finally {
      setUpdating(false);
    }
  }

  /* ============================================================
     REMOVER ESCALA SEM TOUR
     ============================================================ */

  async function unEscalateGuide() {
    if (!selectedGuideAvailability) {
      return;
    }

    setUpdating(true);

    const availabilityId =
      selectedGuideAvailability.id;

    const { error } = await supabase
      .from("availability")
      .update({
        status: "available",
      })
      .eq(
        "id",
        availabilityId
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

    setSelectedGuideDetails(null);
    setSelectedGuideAvailability(null);

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

  /* ============================================================
     ABRIR EDIÇÃO DO TOUR
     ============================================================ */

  function openTourEdit(event: TourEvent) {
    setEditTourTitle(event.title);
    setEditTourDescription(
      event.description || ""
    );
    setEditTourAllDay(event.all_day);
    setEditTourGuideId(event.guide_id);
    setEditTourAdditionalEmail(
      event.additional_email || ""
    );

    setShowTourEdit(true);
  }

  /* ============================================================
     SALVAR EDIÇÃO DO TOUR
     ============================================================ */

  async function saveTourEdit() {
    if (!selectedTourEvent) {
      return;
    }

    const guide = guideMap.get(
      editTourGuideId
    );

    if (!guide) {
      alert("Selecione um guia válido.");
      return;
    }

    if (!editTourTitle.trim()) {
      alert("Informe o título do tour.");
      return;
    }

    if (!guide.email) {
      alert(
        "O guia selecionado não possui e-mail cadastrado."
      );
      return;
    }

    setUpdating(true);

    const { data, error } = await supabase
      .from("tour_events")
      .update({
        title: editTourTitle.trim(),
        description:
          editTourDescription.trim() || null,
        all_day: editTourAllDay,
        guide_id: guide.id,
        guide_email: guide.email,
        additional_email:
          editTourAdditionalEmail.trim() || null,
      })
      .eq(
        "id",
        selectedTourEvent.id
      )
      .select(
        "id, date, title, description, all_day, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error(
        "ERRO AO EDITAR TOUR:",
        error
      );

      alert(
        "Não foi possível atualizar o tour."
      );

      setUpdating(false);
      return;
    }

    setTourEvents((current) =>
      current.map((event) =>
        event.id === data.id
          ? data
          : event
      )
    );

    setSelectedTourEvent(data);
    setShowTourEdit(false);

    setUpdating(false);
  }

  /* ============================================================
     CANCELAR TOUR
     ============================================================ */

  async function cancelTour(event: TourEvent) {
    const confirmed = window.confirm(
      `Deseja realmente cancelar o tour "${event.title}"?`
    );

    if (!confirmed) {
      return;
    }

    setUpdating(true);

    /* ========================================================
       CANCELA EVENTO
       ======================================================== */

    const { data, error } = await supabase
      .from("tour_events")
      .update({
        status: "cancelled",
      })
      .eq(
        "id",
        event.id
      )
      .select(
        "id, date, title, description, all_day, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error(
        "ERRO AO CANCELAR TOUR:",
        error
      );

      alert(
        "Não foi possível cancelar o tour."
      );

      setUpdating(false);
      return;
    }

    /* ========================================================
       PROCURA AVAILABILITY DO GUIA NO DIA
       ======================================================== */

    const { data: availabilityItem } =
      await supabase
        .from("availability")
        .select(
          "id, guide_id, date, status"
        )
        .eq(
          "guide_id",
          event.guide_id
        )
        .eq(
          "date",
          event.date
        )
        .maybeSingle();

    if (availabilityItem) {
      await supabase
        .from("availability")
        .update({
          status: "available",
        })
        .eq(
          "id",
          availabilityItem.id
        );

      setAvailability((current) =>
        current.map((item) =>
          item.id ===
          availabilityItem.id
            ? {
                ...item,
                status: "available",
              }
            : item
        )
      );
    }

    setTourEvents((current) =>
      current.map((item) =>
        item.id === data.id
          ? data
          : item
      )
    );

    setSelectedTourEvent(null);

    alert(
      "Tour cancelado e guia liberado."
    );

    setUpdating(false);
  }

  /* ============================================================
     MÊS
     ============================================================ */

  const monthName = format(
    currentMonth,
    "MMMM yyyy",
    {
      locale: ptBR,
    }
  );

  /* ============================================================
     RENDER
     ============================================================ */

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
            Visualize a disponibilidade, escalas e tours.
          </p>
        </div>

        {/* ================================================== */}
        {/* BUSCA */}
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
      {/* RESULTADO BUSCA */}
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

              const dayEvents =
                getDayTourEvents(
                  date
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
                    "min-h-[88px] rounded-lg border p-1 text-left transition",
                    "sm:min-h-32 sm:rounded-xl sm:p-2",
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

                    {/* ==================================================
                         TOURS
                       ================================================== */}

                    {dayEvents
                      .slice(0, 2)
                      .map(
                        (event) => (
                          <div
                            key={`event-${event.id}`}
                            className="truncate rounded bg-blue-100 px-0.5 py-0.5 text-[8px] font-extrabold leading-tight text-blue-800 sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs"
                            title={event.title}
                          >
                            📅{" "}
                            {event.title}
                          </div>
                        )
                      )}

                    {dayEvents.length >
                      2 && (
                      <div className="px-0.5 text-[8px] font-bold text-blue-700 sm:text-xs">
                        +
                        {dayEvents.length -
                          2}{" "}
                        tours
                      </div>
                    )}

                    {/* ==================================================
                         ESCALADOS
                       ================================================== */}

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

                    {/* ==================================================
                         DISPONÍVEIS
                       ================================================== */}

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

                    {/* ==================================================
                         INDISPONÍVEIS
                       ================================================== */}

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

            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-200 sm:h-4 sm:w-4" />
              Tour
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[#f3e5a5] ring-1 ring-[#d6c36a] sm:h-4 sm:w-4" />
              Escalado
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-green-100 ring-1 ring-green-200 sm:h-4 sm:w-4" />
              Disponível
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-200 sm:h-4 sm:w-4" />
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
                  Agenda do dia
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

            {/* ==================================================
                 TOURS
               ================================================== */}

            <div className="mt-5 sm:mt-6">

              <h4 className="text-sm font-extrabold text-blue-700 sm:text-base">
                📅 Tours
              </h4>

              <div className="mt-2 space-y-2">

                {selectedDayEvents.length ===
                0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                    Nenhum tour agendado para este dia.
                  </p>
                ) : (
                  selectedDayEvents.map(
                    (event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => {
                          setSelectedTourEvent(
                            event
                          );
                          setSelectedDate(
                            null
                          );
                        }}
                        className="flex w-full items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-left text-sm font-bold text-blue-800 transition hover:bg-blue-100"
                      >

                        <span className="min-w-0">

                          <span className="block truncate">
                            {event.title}
                          </span>

                          <span className="mt-0.5 block text-xs font-semibold text-blue-600">
                            {getGuideName(
                              event.guide_id
                            )}
                          </span>

                        </span>

                        <span className="ml-3">
                          →
                        </span>

                      </button>
                    )
                  )
                )}

              </div>

            </div>

            {/* ==================================================
                 ESCALADOS
               ================================================== */}

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

                          <span className="flex min-w-0 items-center gap-2">

                            {getGuideFlags(
                              item.guide_id
                            )}

                            <span className="truncate">
                              {getGuideName(
                                item.guide_id
                              )}
                            </span>

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

            {/* ==================================================
                 DISPONÍVEIS
               ================================================== */}

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

                          <span className="flex min-w-0 items-center gap-2">

                            {getGuideFlags(
                              item.guide_id
                            )}

                            <span className="truncate">
                              {getGuideName(
                                item.guide_id
                              )}
                            </span>

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

            {/* ==================================================
                 INDISPONÍVEIS
               ================================================== */}

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

                          <span className="flex min-w-0 items-center gap-2">

                            {getGuideFlags(
                              item.guide_id
                            )}

                            <span className="truncate">
                              {getGuideName(
                                item.guide_id
                              )}
                            </span>

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

            <div className="flex items-start justify-between border-b border-gray-100 p-6">

              <div>

                <h3 className="flex flex-wrap items-center gap-2 text-xl font-extrabold text-gray-900">

                  {getGuideFlags(
                    selectedGuideDetails.id
                  )}

                  <span>
                    {selectedGuideDetails.name}
                  </span>

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

              {/* PIX */}

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

              {/* ==================================================
                   ESCALAR
                 ================================================== */}

              {selectedGuideAvailability?.status ===
                "available" && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={openEscalationForm}
                  className="w-full rounded-xl bg-[#c9aa00] px-4 py-3 font-extrabold text-white shadow-md transition hover:bg-[#b59600] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  🟡 Escalar para este dia
                </button>
              )}

              {/* ==================================================
                   REMOVER ESCALA
                 ================================================== */}

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

      {/* ====================================================== */}
      {/* MODAL CRIAR TOUR */}
      {/* ====================================================== */}

      {showTourForm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!updating) {
              setShowTourForm(false);
            }
          }}
        >

          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="border-b border-gray-100 p-6">

              <div className="flex items-start justify-between">

                <div>

                  <h3 className="text-xl font-extrabold text-gray-900">
                    🟡 Escalar guia
                  </h3>

                  <p className="mt-1 text-sm font-medium text-gray-500">
                    Crie o tour que ficará na agenda.
                  </p>

                </div>

                <button
                  type="button"
                  disabled={updating}
                  onClick={() =>
                    setShowTourForm(false)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 transition hover:bg-gray-100"
                >
                  ✕
                </button>

              </div>

            </div>

            <div className="space-y-5 p-6">

              {/* DATA */}

              <div className="rounded-2xl bg-blue-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                  Data
                </p>

                <p className="mt-1 text-sm font-extrabold capitalize text-blue-900">
                  {selectedDate &&
                    format(
                      new Date(
                        `${selectedDate}T12:00:00`
                      ),
                      "dd 'de' MMMM 'de' yyyy",
                      {
                        locale:
                          ptBR,
                      }
                    )}
                </p>

              </div>

              {/* GUIA */}

              <div>

                <label className="text-sm font-extrabold text-gray-800">
                  Guia
                </label>

                <select
                  value={tourGuideId}
                  onChange={(event) =>
                    setTourGuideId(
                      event.target.value
                    )
                  }
                  disabled={updating}
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#1687d9]"
                >

                  <option value="">
                    Selecione o guia
                  </option>

                  {guides.map(
                    (guide) => (
                      <option
                        key={guide.id}
                        value={guide.id}
                      >
                        {guide.name}
                        {guide.email
                          ? ` — ${guide.email}`
                          : ""}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* TÍTULO */}

              <div>

                <label className="text-sm font-extrabold text-gray-800">
                  Título do tour
                </label>

                <input
                  type="text"
                  value={tourTitle}
                  onChange={(event) =>
                    setTourTitle(
                      event.target.value
                    )
                  }
                  disabled={updating}
                  placeholder="Ex.: City Tour Rio"
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#1687d9]"
                />

              </div>

              {/* DESCRIÇÃO */}

              <div>

                <label className="text-sm font-extrabold text-gray-800">
                  Descrição
                </label>

                <textarea
                  value={tourDescription}
                  onChange={(event) =>
                    setTourDescription(
                      event.target.value
                    )
                  }
                  disabled={updating}
                  rows={4}
                  placeholder="Informações adicionais do tour..."
                  className="mt-2 w-full resize-none rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:border-[#1687d9]"
                />

              </div>

              {/* DIA TODO */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-4">

                <input
                  type="checkbox"
                  checked={tourAllDay}
                  onChange={(event) =>
                    setTourAllDay(
                      event.target.checked
                    )
                  }
                  disabled={updating}
                  className="h-5 w-5 rounded"
                />

                <span>

                  <span className="block text-sm font-extrabold text-gray-800">
                    Dia inteiro
                  </span>

                  <span className="block text-xs font-medium text-gray-500">
                    O evento ocupará o dia inteiro na agenda.
                  </span>

                </span>

              </label>

              {/* EMAIL ADICIONAL */}

              <div>

                <label className="text-sm font-extrabold text-gray-800">
                  E-mail adicional
                  <span className="ml-1 font-medium text-gray-400">
                    (opcional)
                  </span>
                </label>

                <input
                  type="email"
                  value={tourAdditionalEmail}
                  onChange={(event) =>
                    setTourAdditionalEmail(
                      event.target.value
                    )
                  }
                  disabled={updating}
                  placeholder="cliente@email.com"
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#1687d9]"
                />

              </div>

              {/* EMAIL DO GUIA */}

              {tourGuideId && (
                <div className="rounded-xl bg-green-50 p-4">

                  <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                    E-mail cadastrado do guia
                  </p>

                  <p className="mt-1 break-all text-sm font-bold text-green-900">
                    {guideMap.get(
                      tourGuideId
                    )?.email ||
                      "Não informado"}
                  </p>

                </div>
              )}

              {/* BOTÕES */}

              <div className="flex flex-col gap-3 sm:flex-row">

                <button
                  type="button"
                  disabled={updating}
                  onClick={() =>
                    setShowTourForm(false)
                  }
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={updating}
                  onClick={
                    createTourAndEscalate
                  }
                  className="w-full rounded-xl bg-[#c9aa00] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#b59600] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updating
                    ? "Criando..."
                    : "Criar tour e escalar"}
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* ====================================================== */}
      {/* MODAL DO TOUR */}
      {/* ====================================================== */}

      {selectedTourEvent && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!updating) {
              setSelectedTourEvent(null);
            }
          }}
        >

          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* ==================================================
                 CABEÇALHO
               ================================================== */}

            <div className="border-b border-gray-100 p-6">

              <div className="flex items-start justify-between gap-4">

                <div className="min-w-0">

                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-700">
                    {selectedTourEvent.status ===
                    "scheduled"
                      ? "Tour agendado"
                      : "Tour cancelado"}
                  </span>

                  <h3 className="mt-2 break-words text-xl font-extrabold text-gray-900">
                    {selectedTourEvent.title}
                  </h3>

                </div>

                <button
                  type="button"
                  disabled={updating}
                  onClick={() =>
                    setSelectedTourEvent(null)
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-gray-500 transition hover:bg-gray-100"
                >
                  ✕
                </button>

              </div>

            </div>

            <div className="space-y-4 p-6">

              {/* DATA */}

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Data
                </p>

                <p className="mt-1 text-sm font-extrabold capitalize text-gray-800">
                  {format(
                    new Date(
                      `${selectedTourEvent.date}T12:00:00`
                    ),
                    "dd 'de' MMMM 'de' yyyy",
                    {
                      locale:
                        ptBR,
                    }
                  )}
                </p>

              </div>

              {/* GUIA */}

              <div className="rounded-2xl bg-yellow-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-yellow-600">
                  Guia
                </p>

                <p className="mt-1 flex items-center gap-2 text-sm font-extrabold text-gray-800">

                  {getGuideFlags(
                    selectedTourEvent.guide_id
                  )}

                  {getGuideName(
                    selectedTourEvent.guide_id
                  )}

                </p>

                <p className="mt-1 break-all text-xs font-semibold text-gray-500">
                  {selectedTourEvent.guide_email}
                </p>

              </div>

              {/* DESCRIÇÃO */}

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Descrição
                </p>

                <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-800">
                  {selectedTourEvent.description ||
                    "Nenhuma descrição informada."}
                </p>

              </div>

              {/* EMAIL ADICIONAL */}

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  E-mail adicional
                </p>

                <p className="mt-1 break-all text-sm font-bold text-gray-800">
                  {selectedTourEvent.additional_email ||
                    "Nenhum e-mail adicional."}
                </p>

              </div>

              {/* ==================================================
                   AÇÕES
                 ================================================== */}

              {selectedTourEvent.status ===
                "scheduled" && (
                <>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      openTourEdit(
                        selectedTourEvent
                      )
                    }
                    className="w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#0f75bd]"
                  >
                    ✏️ Editar tour
                  </button>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      cancelTour(
                        selectedTourEvent
                      )
                    }
                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-red-700"
                  >
                    {updating
                      ? "Cancelando..."
                      : "❌ Cancelar tour"}
                  </button>

                </>
              )}

              <button
                type="button"
                disabled={updating}
                onClick={() =>
                  setSelectedTourEvent(null)
                }
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50"
              >
                Fechar
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ====================================================== */}
      {/* MODAL EDITAR TOUR */}
      {/* ====================================================== */}

      {showTourEdit &&
        selectedTourEvent && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!updating) {
                setShowTourEdit(false);
              }
            }}
          >

            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <div className="border-b border-gray-100 p-6">

                <div className="flex items-start justify-between">

                  <div>

                    <h3 className="text-xl font-extrabold text-gray-900">
                      ✏️ Editar tour
                    </h3>

                    <p className="mt-1 text-sm font-medium text-gray-500">
                      Altere as informações do evento.
                    </p>

                  </div>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      setShowTourEdit(
                        false
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 hover:bg-gray-100"
                  >
                    ✕
                  </button>

                </div>

              </div>

              <div className="space-y-5 p-6">

                {/* GUIA */}

                <div>

                  <label className="text-sm font-extrabold text-gray-800">
                    Guia
                  </label>

                  <select
                    value={editTourGuideId}
                    onChange={(event) =>
                      setEditTourGuideId(
                        event.target.value
                      )
                    }
                    disabled={updating}
                    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#1687d9]"
                  >

                    {guides.map(
                      (guide) => (
                        <option
                          key={guide.id}
                          value={guide.id}
                        >
                          {guide.name}
                        </option>
                      )
                    )}

                  </select>

                </div>

                {/* TÍTULO */}

                <div>

                  <label className="text-sm font-extrabold text-gray-800">
                    Título
                  </label>

                  <input
                    type="text"
                    value={editTourTitle}
                    onChange={(event) =>
                      setEditTourTitle(
                        event.target.value
                      )
                    }
                    disabled={updating}
                    className="mt-2 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#1687d9]"
                  />

                </div>

                {/* DESCRIÇÃO */}

                <div>

                  <label className="text-sm font-extrabold text-gray-800">
                    Descrição
                  </label>

                  <textarea
                    value={editTourDescription}
                    onChange={(event) =>
                      setEditTourDescription(
                        event.target.value
                      )
                    }
                    disabled={updating}
                    rows={4}
                    className="mt-2 w-full resize-none rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:border-[#1687d9]"
                  />

                </div>

                {/* DIA TODO */}

                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-4">

                  <input
                    type="checkbox"
                    checked={editTourAllDay}
                    onChange={(event) =>
                      setEditTourAllDay(
                        event.target.checked
                      )
                    }
                    disabled={updating}
                    className="h-5 w-5 rounded"
                  />

                  <span>

                    <span className="block text-sm font-extrabold text-gray-800">
                      Dia inteiro
                    </span>

                  </span>

                </label>

                {/* EMAIL */}

                <div>

                  <label className="text-sm font-extrabold text-gray-800">
                    E-mail adicional
                  </label>

                  <input
                    type="email"
                    value={
                      editTourAdditionalEmail
                    }
                    onChange={(event) =>
                      setEditTourAdditionalEmail(
                        event.target.value
                      )
                    }
                    disabled={updating}
                    placeholder="cliente@email.com"
                    className="mt-2 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#1687d9]"
                  />

                </div>

                {/* BOTÕES */}

                <div className="flex flex-col gap-3 sm:flex-row">

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      setShowTourEdit(
                        false
                      )
                    }
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-extrabold text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={saveTourEdit}
                    className="w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-extrabold text-white shadow-md hover:bg-[#0f75bd] disabled:opacity-60"
                  >
                    {updating
                      ? "Salvando..."
                      : "Salvar alterações"}
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}