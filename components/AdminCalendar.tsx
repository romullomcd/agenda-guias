"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  MouseEvent as ReactMouseEvent,
} from "react";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
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

type CalendarView =
  | "month"
  | "day";

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
NORMALIZAR HTML
============================================================ */

function normalizeDescriptionHtml(
  html: string
) {
  return html
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /\u00a0/g,
      " "
    );
}

/* ============================================================
SANITIZAÇÃO
============================================================ */

function sanitizeDescriptionHtml(
  html: string
) {
  if (!html) {
    return "";
  }

  if (
    typeof window ===
    "undefined"
  ) {
    return normalizeDescriptionHtml(
      html
    );
  }

  const parser =
    new DOMParser();

  const documentNode =
    parser.parseFromString(
      html,
      "text/html"
    );

  const allowedTags =
    new Set([
      "B",
      "STRONG",
      "I",
      "EM",
      "U",
      "BR",
      "P",
      "DIV",
      "UL",
      "OL",
      "LI",
    ]);

  documentNode.body
    .querySelectorAll("*")
    .forEach(
      (element) => {
        if (
          !allowedTags.has(
            element.tagName
          )
        ) {
          const text =
            documentNode.createTextNode(
              element.textContent ||
                ""
            );

          element.replaceWith(
            text
          );

          return;
        }

        Array.from(
          element.attributes
        ).forEach(
          (attribute) => {
            element.removeAttribute(
              attribute.name
            );
          }
        );
      }
    );

  return normalizeDescriptionHtml(
    documentNode.body.innerHTML
  );
}

/* ============================================================
DESCRIÇÃO → HTML
============================================================ */

function descriptionToHtml(
  value: string
) {
  if (!value) {
    return "";
  }

  const original =
    value;

  if (
    /<\s*(b|strong|i|em|u|br|p|div|ul|ol|li)\b/i.test(
      original
    )
  ) {
    return original;
  }

  return original
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /\r\n/g,
      "<br />"
    )
    .replace(
      /\n/g,
      "<br />"
    );
}

/* ============================================================
HTML → TEXTO
============================================================ */

function htmlToPlainText(
  html: string
) {
  if (!html) {
    return "";
  }

  if (
    typeof window ===
    "undefined"
  ) {
    return normalizeDescriptionHtml(
      html
    )
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<\/p>/gi,
        "\n"
      )
      .replace(
        /<\/div>/gi,
        "\n"
      )
      .replace(
        /<\/li>/gi,
        "\n"
      )
      .replace(
        /<[^>]*>/g,
        ""
      )
      .replace(
        /\n{3,}/g,
        "\n\n"
      )
      .trim();
  }

  const parser =
    new DOMParser();

  const documentNode =
    parser.parseFromString(
      html,
      "text/html"
    );

  documentNode
    .querySelectorAll("br")
    .forEach(
      (br) => {
        br.replaceWith(
          documentNode.createTextNode(
            "\n"
          )
        );
      }
    );

  documentNode
    .querySelectorAll(
      "p, div, li"
    )
    .forEach(
      (element) => {
        element.appendChild(
          documentNode.createTextNode(
            "\n"
          )
        );
      }
    );

  return normalizeDescriptionHtml(
    documentNode.body.textContent ||
      ""
  )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

/* ============================================================
EDITOR
============================================================ */

type RichTextEditorProps = {
  value: string;
  onChange: (
    value: string
  ) => void;
  disabled?: boolean;
  minHeight?: string;
};

function RichTextEditor({
  value,
  onChange,
  disabled = false,
  minHeight = "300px",
}: RichTextEditorProps) {
  const editorRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const savedRangeRef =
    useRef<Range | null>(
      null
    );

  const initializedRef =
    useRef(false);

  const internalChangeRef =
    useRef(false);

  const [
    isFocused,
    setIsFocused,
  ] = useState(false);

  function saveSelection() {
    const editor =
      editorRef.current;

    if (!editor) {
      return;
    }

    const selection =
      window.getSelection();

    if (
      !selection ||
      selection.rangeCount ===
        0
    ) {
      return;
    }

    const range =
      selection.getRangeAt(0);

    if (
      !editor.contains(
        range.commonAncestorContainer
      )
    ) {
      return;
    }

    savedRangeRef.current =
      range.cloneRange();
  }

  function restoreSelection() {
    const editor =
      editorRef.current;

    const range =
      savedRangeRef.current;

    if (
      !editor ||
      !range
    ) {
      return false;
    }

    if (
      !editor.contains(
        range.startContainer
      ) ||
      !editor.contains(
        range.endContainer
      )
    ) {
      return false;
    }

    const selection =
      window.getSelection();

    if (!selection) {
      return false;
    }

    try {
      selection.removeAllRanges();

      selection.addRange(
        range
      );

      return true;
    } catch (
      error
    ) {
      console.error(
        "Erro ao restaurar seleção:",
        error
      );

      return false;
    }
  }

  function syncValue() {
    const editor =
      editorRef.current;

    if (!editor) {
      return;
    }

    internalChangeRef.current =
      true;

    onChange(
      editor.innerHTML
    );
  }

  useEffect(() => {
    const editor =
      editorRef.current;

    if (!editor) {
      return;
    }

    if (
      !initializedRef.current
    ) {
      editor.innerHTML =
        descriptionToHtml(
          value
        );

      initializedRef.current =
        true;

      return;
    }

    if (
      internalChangeRef.current
    ) {
      internalChangeRef.current =
        false;

      return;
    }

    if (
      document.activeElement ===
      editor
    ) {
      return;
    }

    const html =
      descriptionToHtml(
        value
      );

    if (
      editor.innerHTML !==
      html
    ) {
      editor.innerHTML =
        html;
    }
  }, [value]);

  function fragmentIsCompletelyBold(
    fragment: DocumentFragment
  ) {
    const walker =
      document.createTreeWalker(
        fragment,
        NodeFilter.SHOW_TEXT
      );

    let foundText =
      false;

    let currentNode =
      walker.nextNode();

    while (
      currentNode
    ) {
      const textNode =
        currentNode as Text;

      if (
        textNode.nodeValue
          ?.length
      ) {
        foundText =
          true;

        let parent =
          textNode.parentElement;

        let isBold =
          false;

        while (
          parent
        ) {
          if (
            parent.tagName ===
              "STRONG" ||
            parent.tagName ===
              "B"
          ) {
            isBold =
              true;

            break;
          }

          parent =
            parent.parentElement;
        }

        if (
          !isBold
        ) {
          return false;
        }
      }

      currentNode =
        walker.nextNode();
    }

    return foundText;
  }

  function unwrapBoldFromFragment(
    fragment: DocumentFragment
  ) {
    const elements =
      Array.from(
        fragment.querySelectorAll(
          "strong, b"
        )
      );

    elements.forEach(
      (element) => {
        const parent =
          element.parentNode;

        if (!parent) {
          return;
        }

        while (
          element.firstChild
        ) {
          parent.insertBefore(
            element.firstChild,
            element
          );
        }

        parent.removeChild(
          element
        );
      }
    );
  }

  function toggleBold() {
    if (disabled) {
      return;
    }

    const editor =
      editorRef.current;

    if (!editor) {
      return;
    }

    restoreSelection();

    const selection =
      window.getSelection();

    if (
      !selection ||
      selection.rangeCount ===
        0
    ) {
      return;
    }

    const range =
      selection.getRangeAt(0);

    if (
      range.collapsed
    ) {
      return;
    }

    if (
      !editor.contains(
        range.commonAncestorContainer
      )
    ) {
      return;
    }

    try {
      const preview =
        range.cloneContents();

      const completelyBold =
        fragmentIsCompletelyBold(
          preview
        );

      const fragment =
        range.extractContents();

      if (
        completelyBold
      ) {
        unwrapBoldFromFragment(
          fragment
        );

        range.insertNode(
          fragment
        );
      } else {
        const strong =
          document.createElement(
            "strong"
          );

        strong.appendChild(
          fragment
        );

        range.insertNode(
          strong
        );

        const newRange =
          document.createRange();

        newRange.selectNodeContents(
          strong
        );

        selection.removeAllRanges();

        selection.addRange(
          newRange
        );
      }

      saveSelection();

      syncValue();
    } catch (
      error
    ) {
      console.error(
        "❌ ERRO NO BOLD:",
        error
      );
    }
  }

  function executeCommand(
    command: string
  ) {
    if (disabled) {
      return;
    }

    if (
      command ===
      "bold"
    ) {
      toggleBold();

      return;
    }

    const editor =
      editorRef.current;

    if (!editor) {
      return;
    }

    try {
      restoreSelection();

      document.execCommand(
        command,
        false
      );

      syncValue();

      saveSelection();
    } catch (
      error
    ) {
      console.error(
        `Erro ao executar ${command}:`,
        error
      );
    }
  }

  function handleToolbarMouseDown(
    event: ReactMouseEvent<HTMLButtonElement>,
    command: string
  ) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    saveSelection();

    executeCommand(
      command
    );
  }

  function clearFormatting() {
    if (disabled) {
      return;
    }

    try {
      restoreSelection();

      document.execCommand(
        "removeFormat",
        false
      );

      document.execCommand(
        "unlink",
        false
      );

      syncValue();

      saveSelection();
    } catch (
      error
    ) {
      console.error(
        "Erro ao limpar formatação:",
        error
      );
    }
  }

  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border-2 bg-white transition",
        isFocused
          ? "border-[#1687d9] ring-4 ring-blue-100"
          : "border-gray-200",
        disabled
          ? "opacity-60"
          : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-2">

        <button
          type="button"
          disabled={
            disabled
          }
          onMouseDown={(event) =>
            handleToolbarMouseDown(
              event,
              "bold"
            )
          }
          title="Negrito"
          className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-sm font-black text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <strong>
            B
          </strong>
        </button>

        <button
          type="button"
          disabled={
            disabled
          }
          onMouseDown={(event) =>
            handleToolbarMouseDown(
              event,
              "italic"
            )
          }
          title="Itálico"
          className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-sm font-bold italic text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <em>
            I
          </em>
        </button>

        <button
          type="button"
          disabled={
            disabled
          }
          onMouseDown={(event) =>
            handleToolbarMouseDown(
              event,
              "underline"
            )
          }
          title="Sublinhado"
          className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-sm font-bold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="underline">
            U
          </span>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <button
          type="button"
          disabled={
            disabled
          }
          onMouseDown={(event) =>
            handleToolbarMouseDown(
              event,
              "insertUnorderedList"
            )
          }
          title="Lista com marcadores"
          className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-sm font-bold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ☷
        </button>

        <button
          type="button"
          disabled={
            disabled
          }
          onMouseDown={(event) =>
            handleToolbarMouseDown(
              event,
              "insertOrderedList"
            )
          }
          title="Lista numerada"
          className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-sm font-bold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          1.
        </button>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <button
          type="button"
          disabled={
            disabled
          }
          onMouseDown={(event) => {
            event.preventDefault();

            saveSelection();

            clearFormatting();
          }}
          title="Limpar formatação"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Limpar
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={
          !disabled
        }
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        spellCheck
        onInput={() => {
          syncValue();

          saveSelection();
        }}
        onKeyUp={() => {
          saveSelection();
        }}
        onMouseUp={() => {
          saveSelection();
        }}
        onFocus={() => {
          setIsFocused(
            true
          );

          saveSelection();
        }}
        onBlur={() => {
          setIsFocused(
            false
          );

          saveSelection();
        }}
        data-placeholder="Digite aqui as informações detalhadas do tour..."
        className="min-h-[300px] w-full overflow-y-auto px-4 py-4 text-sm font-medium leading-7 text-gray-900 outline-none"
        style={{
          minHeight,
        }}
      />

      <style jsx>{`
        [contenteditable="true"]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }

        [contenteditable="true"] ul {
          list-style: disc;
          padding-left: 1.5rem;
        }

        [contenteditable="true"] ol {
          list-style: decimal;
          padding-left: 1.5rem;
        }

        [contenteditable="true"] li {
          margin: 0.25rem 0;
        }

        [contenteditable="true"] p {
          margin: 0.35rem 0;
        }

        [contenteditable="true"] div {
          min-height: 1.5rem;
        }

        [contenteditable="true"] br {
          line-height: 1.7;
        }

        [contenteditable="true"] strong,
        [contenteditable="true"] b {
          font-weight: 800;
        }
      `}</style>
    </div>
  );
}

/* ============================================================
COMPONENTE PRINCIPAL
============================================================ */

export default function AdminCalendar() {
  const [
    currentMonth,
    setCurrentMonth,
  ] = useState(
    new Date()
  );

  const [
    currentDay,
    setCurrentDay,
  ] = useState(
    new Date()
  );

  const [
    calendarView,
    setCalendarView,
  ] = useState<CalendarView>(
    "month"
  );

  const [
    guides,
    setGuides,
  ] = useState<Guide[]>(
    []
  );

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
    guideSearch,
    setGuideSearch,
  ] = useState("");

  const [
    selectedDate,
    setSelectedDate,
  ] = useState<
    string | null
  >(null);

  const [
    tourFormDate,
    setTourFormDate,
  ] = useState<
    string | null
  >(null);

  const [
    tourFormAvailabilityId,
    setTourFormAvailabilityId,
  ] = useState<
    number | null
  >(null);

  const [
    selectedGuideDetails,
    setSelectedGuideDetails,
  ] = useState<
    Guide | null
  >(null);

  const [
    selectedGuideAvailability,
    setSelectedGuideAvailability,
  ] = useState<
    Availability | null
  >(null);

  const [
    selectedTourEvent,
    setSelectedTourEvent,
  ] = useState<
    TourEvent | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(
    true
  );

  const [
    updating,
    setUpdating,
  ] = useState(
    false
  );

  /* ============================================================
  FORMULÁRIO CRIAÇÃO
  ============================================================ */

  const [
    showTourForm,
    setShowTourForm,
  ] = useState(
    false
  );

  const [
    tourTitle,
    setTourTitle,
  ] = useState("");

  const [
    tourDescription,
    setTourDescription,
  ] = useState("");

  const [
    tourAddress,
    setTourAddress,
  ] = useState("");

  const [
    tourAllDay,
    setTourAllDay,
  ] = useState(
    true
  );

  const [
    tourStartTime,
    setTourStartTime,
  ] = useState("09:00");

  const [
    tourEndTime,
    setTourEndTime,
  ] = useState("10:00");

  const [
    tourGuideId,
    setTourGuideId,
  ] = useState("");

  const [
    tourAdditionalEmail,
    setTourAdditionalEmail,
  ] = useState("");

  /* ============================================================
  EDIÇÃO
  ============================================================ */

  const [
    showTourEdit,
    setShowTourEdit,
  ] = useState(
    false
  );

  const [
    editTourTitle,
    setEditTourTitle,
  ] = useState("");

  const [
    editTourDescription,
    setEditTourDescription,
  ] = useState("");

  const [
    editTourAddress,
    setEditTourAddress,
  ] = useState("");

  const [
    editTourAllDay,
    setEditTourAllDay,
  ] = useState(
    true
  );

  const [
    editTourStartTime,
    setEditTourStartTime,
  ] = useState("09:00");

  const [
    editTourEndTime,
    setEditTourEndTime,
  ] = useState("10:00");

  const [
    editTourGuideId,
    setEditTourGuideId,
  ] = useState("");

  const [
    editTourAdditionalEmail,
    setEditTourAdditionalEmail,
  ] = useState("");

  /* ============================================================
  CARREGAMENTO
  ============================================================ */

  useEffect(() => {
    loadData();
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
          "admin-calendar-realtime"
        )

        .on(
          "postgres_changes",
          {
            event:
              "INSERT",
            schema:
              "public",
            table:
              "availability",
          },
          (payload) => {
            const newItem =
              payload.new as Availability;

            setAvailability(
              (current) => {
                const alreadyExists =
                  current.some(
                    (item) =>
                      item.id ===
                      newItem.id
                  );

                if (
                  alreadyExists
                ) {
                  return current;
                }

                return [
                  ...current,
                  newItem,
                ].sort(
                  (a, b) =>
                    a.date.localeCompare(
                      b.date
                    )
                );
              }
            );
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "UPDATE",
            schema:
              "public",
            table:
              "availability",
          },
          (payload) => {
            const updatedItem =
              payload.new as Availability;

            setAvailability(
              (current) =>
                current.map(
                  (item) =>
                    item.id ===
                    updatedItem.id
                      ? updatedItem
                      : item
                )
            );

            setSelectedGuideAvailability(
              (current) =>
                current &&
                current.id ===
                  updatedItem.id
                  ? updatedItem
                  : current
            );
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "DELETE",
            schema:
              "public",
            table:
              "availability",
          },
          (payload) => {
            const deletedItem =
              payload.old as Availability;

            setAvailability(
              (current) =>
                current.filter(
                  (item) =>
                    item.id !==
                    deletedItem.id
                )
            );

            setSelectedGuideAvailability(
              (current) =>
                current &&
                current.id ===
                  deletedItem.id
                  ? null
                  : current
            );
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "INSERT",
            schema:
              "public",
            table:
              "tour_events",
          },
          (payload) => {
            const newEvent =
              payload.new as TourEvent;

            setTourEvents(
              (current) => {
                const exists =
                  current.some(
                    (event) =>
                      event.id ===
                      newEvent.id
                  );

                if (
                  exists
                ) {
                  return current;
                }

                return [
                  ...current,
                  newEvent,
                ].sort(
                  (a, b) =>
                    a.date.localeCompare(
                      b.date
                    )
                );
              }
            );
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "UPDATE",
            schema:
              "public",
            table:
              "tour_events",
          },
          (payload) => {
            const updatedEvent =
              payload.new as TourEvent;

            setTourEvents(
              (current) =>
                current.map(
                  (event) =>
                    event.id ===
                      updatedEvent.id
                      ? updatedEvent
                      : event
                )
            );

            setSelectedTourEvent(
              (current) =>
                current &&
                current.id ===
                  updatedEvent.id
                  ? updatedEvent
                  : current
            );
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "DELETE",
            schema:
              "public",
            table:
              "tour_events",
          },
          (payload) => {
            const deletedEvent =
              payload.old as TourEvent;

            setTourEvents(
              (current) =>
                current.filter(
                  (event) =>
                    event.id !==
                    deletedEvent.id
                )
            );

            setSelectedTourEvent(
              (current) =>
                current &&
                current.id ===
                  deletedEvent.id
                  ? null
                  : current
            );
          }
        )

        .subscribe(
          (status) => {
            console.log(
              "📡 ADMIN CALENDAR REALTIME:",
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
  CARREGAR DADOS
  ============================================================ */

  async function loadData() {
    setLoading(
      true
    );

    const firstDay =
      format(
        startOfMonth(
          currentMonth
        ),
        "yyyy-MM-dd"
      );

    const lastDay =
      format(
        endOfMonth(
          currentMonth
        ),
        "yyyy-MM-dd"
      );

    const [
      guidesResult,
      availabilityResult,
      tourEventsResult,
    ] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, name, active, languages, phone"
          )
          .eq(
            "role",
            "guide"
          )
          .order(
            "name"
          ),

        supabase
          .from(
            "availability"
          )
          .select(
            "id, guide_id, date, status"
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

    if (
      guidesResult.error
    ) {
      console.error(
        "ERRO AO CARREGAR GUIAS:",
        guidesResult.error
      );
    } else {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      const guidesWithDetails =
        await Promise.all(
          (
            guidesResult.data ||
            []
          ).map(
            async (
              guide
            ) => {
              if (
                !session
              ) {
                return {
                  ...guide,
                  languages:
                    guide.languages ||
                    [],
                  phone:
                    guide.phone ||
                    "",
                  email:
                    "",
                  pix_key:
                    "",
                };
              }

              try {
                const response =
                  await fetch(
                    `/api/guides/${guide.id}`,
                    {
                      method:
                        "GET",

                      headers: {
                        Authorization:
                          `Bearer ${session.access_token}`,
                      },
                    }
                  );

                const result =
                  await response.json();

                return {
                  ...guide,

                  languages:
                    guide.languages ||
                    [],

                  phone:
                    guide.phone ||
                    "",

                  email:
                    result.email ||
                    "",

                  pix_key:
                    result.pix_key ||
                    result.pix ||
                    result.pixKey ||
                    "",
                };
              } catch (
                error
              ) {
                console.error(
                  `Erro ao buscar detalhes do guia ${guide.id}:`,
                  error
                );

                return {
                  ...guide,

                  languages:
                    guide.languages ||
                    [],

                  phone:
                    guide.phone ||
                    "",

                  email:
                    "",

                  pix_key:
                    "",
                };
              }
            }
          )
        );

      setGuides(
        guidesWithDetails
      );
    }

    if (
      availabilityResult.error
    ) {
      console.error(
        "ERRO AO CARREGAR DISPONIBILIDADES:",
        availabilityResult.error
      );
    } else {
      setAvailability(
        availabilityResult.data ||
          []
      );
    }

    if (
      tourEventsResult.error
    ) {
      console.error(
        "ERRO AO CARREGAR TOURS:",
        tourEventsResult.error
      );
    } else {
      setTourEvents(
        tourEventsResult.data ||
          []
      );
    }

    setLoading(
      false
    );
  }

  /* ============================================================
  BUSCA
  ============================================================ */

  const normalizedSearch =
    guideSearch
      .trim()
      .toLowerCase();

  const filteredGuides =
    useMemo(() => {
      if (
        !normalizedSearch
      ) {
        return guides;
      }

      return guides.filter(
        (guide) =>
          guide.name
            .toLowerCase()
            .includes(
              normalizedSearch
            )
      );
    }, [
      guides,
      normalizedSearch,
    ]);

  /* ============================================================
  MAPA GUIAS
  ============================================================ */

  const guideMap =
    useMemo(
      () =>
        new Map(
          guides.map(
            (guide) => [
              guide.id,
              guide,
            ]
          )
        ),
      [guides]
    );

  /* ============================================================
  GUIAS DISPONÍVEIS PARA TROCA
  ============================================================ */

  const availableGuidesForTourEdit =
    useMemo(() => {
      if (
        !selectedTourEvent
      ) {
        return [];
      }

      const availableGuideIds =
        new Set(
          availability
            .filter(
              (item) =>
                item.date ===
                  selectedTourEvent.date &&
                item.status ===
                  "available"
            )
            .map(
              (item) =>
                item.guide_id
            )
        );

      return guides.filter(
        (guide) =>
          guide.active &&
          availableGuideIds.has(
            guide.id
          )
      );
    }, [
      availability,
      guides,
      selectedTourEvent,
    ]);

  /* ============================================================
  FILTRADOS
  ============================================================ */

  const filteredAvailability =
    useMemo(() => {
      if (
        !normalizedSearch
      ) {
        return availability;
      }

      const ids =
        new Set(
          filteredGuides.map(
            (guide) =>
              guide.id
          )
        );

      return availability.filter(
        (item) =>
          ids.has(
            item.guide_id
          )
      );
    }, [
      availability,
      filteredGuides,
      normalizedSearch,
    ]);

  const filteredTourEvents =
    useMemo(() => {
      if (
        !normalizedSearch
      ) {
        return tourEvents;
      }

      const ids =
        new Set(
          filteredGuides.map(
            (guide) =>
              guide.id
          )
        );

      return tourEvents.filter(
        (event) =>
          event.guide_id ===
            null ||
          ids.has(
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
  DADOS DIA
  ============================================================ */

  const selectedDayData =
    selectedDate
      ? filteredAvailability.filter(
          (item) =>
            item.date ===
            selectedDate
        )
      : [];

  const selectedAvailable =
    selectedDayData.filter(
      (item) =>
        item.status ===
        "available"
    );

  const selectedUnavailable =
    selectedDayData.filter(
      (item) =>
        item.status ===
        "unavailable"
    );

  const selectedEscalated =
    selectedDayData.filter(
      (item) =>
        item.status ===
        "escalated"
    );

  const selectedDayEvents =
    selectedDate
      ? filteredTourEvents.filter(
          (event) =>
            event.date ===
              selectedDate &&
            event.status ===
              "scheduled"
        )
      : [];

  function getDayAvailability(
    date: string
  ) {
    return filteredAvailability.filter(
      (item) =>
        item.date ===
        date
    );
  }

  function getDayTourEvents(
    date: string
  ) {
    return filteredTourEvents.filter(
      (event) =>
        event.date ===
          date &&
        event.status ===
          "scheduled"
    );
  }

  function getGuideName(
    guideId:
      | string
      | null
  ) {
    if (!guideId) {
      return "Sem guia";
    }

    return (
      guideMap.get(
        guideId
      )?.name ||
      "Guia"
    );
  }

  function getGuideFlags(
    guideId:
      | string
      | null
  ) {
    if (!guideId) {
      return null;
    }

    const guide =
      guideMap.get(
        guideId
      );

    if (
      !guide?.languages ||
      guide.languages.length ===
        0
    ) {
      return null;
    }

    return (
      <span className="inline-flex items-center gap-0.5 align-middle">

        {guide.languages.map(
          (language) => {
            const flag =
              LANGUAGE_FLAGS[
                language
              ];

            if (!flag) {
              return null;
            }

            return (
              <img
                key={`${guideId}-${language}`}
                src={
                  flag
                }
                alt={
                  language
                }
                title={
                  language
                }
                className="inline-block h-3.5 w-5 rounded-sm object-cover sm:h-4 sm:w-6"
              />
            );
          }
        )}

      </span>
    );
  }

  function formatGuidePhone(
    value: string
  ) {
    const numbers =
      value.replace(
        /\D/g,
        ""
      );

    if (
      numbers.length ===
      11
    ) {
      return `(${numbers.slice(
        0,
        2
      )}) ${numbers.slice(
        2,
        7
      )}-${numbers.slice(
        7
      )}`;
    }

    if (
      numbers.length ===
      10
    ) {
      return `(${numbers.slice(
        0,
        2
      )}) ${numbers.slice(
        2,
        6
      )}-${numbers.slice(
        6
      )}`;
    }

    return value;
  }

  /* ============================================================
  GOOGLE
  ============================================================ */

  async function callGoogleCalendar(
    payload: {
      action:
        | "create"
        | "update"
        | "delete";

      eventId?: string | null;

      date?: string;

      title?: string;

      description?: string | null;

      address?: string | null;

      allDay?: boolean;

      startTime?: string | null;

      endTime?: string | null;

      guideEmail?: string | null;

      additionalEmail?: string | null;
    }
  ) {
    const {
      data: {
        session,
      },
      error:
        sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !session?.access_token
    ) {
      throw new Error(
        "Sua sessão expirou. Faça login novamente."
      );
    }

    const response =
      await fetch(
        "/api/google/calendar",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    const result =
      await response
        .json()
        .catch(
          () => null
        );

    if (
      !response.ok ||
      result?.success !==
        true
    ) {
      throw new Error(
        result?.error ||
          "Não foi possível sincronizar com o Google Calendar."
      );
    }

    return result;
  }

  /* ============================================================
  ABRIR FORMULÁRIO PARA ESCALA
  ============================================================ */

  function openEscalationForm() {
    if (
      !selectedGuideAvailability
    ) {
      return;
    }

    const guide =
      guideMap.get(
        selectedGuideAvailability.guide_id
      );

    if (!guide) {
      alert(
        "Guia não encontrado."
      );

      return;
    }

    setTourFormDate(
      selectedGuideAvailability.date
    );

    setTourFormAvailabilityId(
      selectedGuideAvailability.id
    );

    setTourGuideId(
      guide.id
    );

    setTourTitle(
      ""
    );

    setTourDescription(
      ""
    );

    setTourAddress(
      ""
    );

    setTourAllDay(
      true
    );

    setTourStartTime(
      "09:00"
    );

    setTourEndTime(
      "10:00"
    );

    setTourAdditionalEmail(
      ""
    );

    setSelectedGuideDetails(
      null
    );

    setSelectedGuideAvailability(
      null
    );

    setShowTourForm(
      true
    );
  }

  /* ============================================================
  NOVA FUNÇÃO:
  LANÇAR TOUR PELO DIA SEM GUIA
  ============================================================ */

  function openTourFormFromDay() {
    if (!selectedDate) {
      alert(
        "Selecione um dia antes de lançar o tour."
      );

      return;
    }

    setTourFormDate(
      selectedDate
    );

    setTourFormAvailabilityId(
      null
    );

    setTourGuideId(
      ""
    );

    setTourTitle(
      ""
    );

    setTourDescription(
      ""
    );

    setTourAddress(
      ""
    );

    setTourAllDay(
      true
    );

    setTourStartTime(
      "09:00"
    );

    setTourEndTime(
      "10:00"
    );

    setTourAdditionalEmail(
      ""
    );

    setSelectedGuideDetails(
      null
    );

    setSelectedGuideAvailability(
      null
    );

    setShowTourForm(
      true
    );
  }

  /* ============================================================
  CRIAR TOUR
  ============================================================ */

  async function createTourAndEscalate() {
    const eventDate =
      tourFormDate ||
      selectedDate ||
      null;

    if (!eventDate) {
      alert(
        "Não foi possível identificar a data do tour."
      );

      return;
    }

    if (
      !tourTitle.trim()
    ) {
      alert(
        "Informe o título do tour."
      );

      return;
    }

    const guide =
      tourGuideId
        ? guideMap.get(
            tourGuideId
          )
        : null;

    if (
      tourGuideId &&
      !guide
    ) {
      alert(
        "O guia selecionado não foi encontrado."
      );

      return;
    }

    if (
      tourGuideId &&
      !guide?.email
    ) {
      alert(
        "Este guia não possui e-mail cadastrado."
      );

      return;
    }

    if (
      !tourAllDay &&
      tourStartTime >=
        tourEndTime
    ) {
      alert(
        "O horário de término deve ser maior que o horário de início."
      );

      return;
    }

    if (
      tourFormAvailabilityId &&
      !guide
    ) {
      alert(
        "Para escalar um guia, selecione um guia válido."
      );

      return;
    }

    setUpdating(
      true
    );

    let createdDatabaseEvent:
      | TourEvent
      | null =
      null;

    let googleEventId:
      | string
      | null =
      null;

    try {
      const normalizedDescription =
        sanitizeDescriptionHtml(
          tourDescription
        );

      const plainDescription =
        htmlToPlainText(
          normalizedDescription
        );

      /* ========================================================
         SUPABASE
      ======================================================== */

      const {
        data:
          newEvent,
        error:
          eventError,
      } =
        await supabase
          .from(
            "tour_events"
          )
          .insert({
            date:
              eventDate,

            title:
              tourTitle.trim(),

            description:
              plainDescription
                ? normalizedDescription
                : null,

            address:
              tourAddress.trim() ||
              null,

            all_day:
              tourAllDay,

            start_time:
              tourAllDay
                ? null
                : tourStartTime,

            end_time:
              tourAllDay
                ? null
                : tourEndTime,

            guide_id:
              guide?.id ||
              null,

            guide_email:
              guide?.email ||
              null,

            additional_email:
              tourAdditionalEmail.trim() ||
              null,

            calendar_event_id:
              null,

            status:
              "scheduled",
          })
          .select(
            "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
          )
          .single();

      if (
        eventError ||
        !newEvent
      ) {
        console.error(
          "❌ ERRO AO CRIAR TOUR:",
          eventError
        );

        throw new Error(
          "Não foi possível criar o tour no banco de dados."
        );
      }

      createdDatabaseEvent =
        newEvent as TourEvent;

      /* ========================================================
         GOOGLE
      ======================================================== */

      const googleResult =
        await callGoogleCalendar({
          action:
            "create",

          date:
            eventDate,

          title:
            tourTitle.trim(),

          description:
            normalizedDescription
              ? normalizedDescription
              : null,

          address:
            tourAddress.trim() ||
            null,

          allDay:
            tourAllDay,

          startTime:
            tourAllDay
              ? null
              : tourStartTime,

          endTime:
            tourAllDay
              ? null
              : tourEndTime,

          guideEmail:
            guide?.email ||
            null,

          additionalEmail:
            tourAdditionalEmail.trim() ||
            null,
        });

      googleEventId =
        googleResult.eventId ||
        null;

      if (
        !googleEventId
      ) {
        throw new Error(
          "O Google criou o evento, mas não retornou o ID."
        );
      }

      /* ========================================================
         SALVAR ID GOOGLE
      ======================================================== */

      const {
        data:
          eventWithGoogleId,
        error:
          calendarIdError,
      } =
        await supabase
          .from(
            "tour_events"
          )
          .update({
            calendar_event_id:
              googleEventId,
          })
          .eq(
            "id",
            newEvent.id
          )
          .select(
            "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
          )
          .single();

      if (
        calendarIdError ||
        !eventWithGoogleId
      ) {
        try {
          await callGoogleCalendar({
            action:
              "delete",

            eventId:
              googleEventId,
          });
        } catch (
          cleanupError
        ) {
          console.error(
            "ERRO AO LIMPAR GOOGLE:",
            cleanupError
          );
        }

        await supabase
          .from(
            "tour_events"
          )
          .delete()
          .eq(
            "id",
            newEvent.id
          );

        throw new Error(
          "O evento foi criado no Google, mas não foi possível salvar o vínculo no sistema."
        );
      }

      createdDatabaseEvent =
        eventWithGoogleId as TourEvent;

      /* ========================================================
         ESCALAR GUIA SOMENTE SE HOUVER GUIA
      ======================================================== */

      if (
        tourFormAvailabilityId &&
        guide
      ) {
        const {
          data:
            escalatedAvailability,
          error:
            availabilityError,
        } =
          await supabase
            .from(
              "availability"
            )
            .update({
              status:
                "escalated",
            })
            .eq(
              "id",
              tourFormAvailabilityId
            )
            .select(
              "id, guide_id, date, status"
            )
            .single();

        if (
          availabilityError ||
          !escalatedAvailability
        ) {
          console.error(
            "❌ ERRO AO ESCALAR DISPONIBILIDADE:",
            availabilityError
          );

          try {
            await callGoogleCalendar({
              action:
                "delete",

              eventId:
                googleEventId,
            });
          } catch (
            cleanupError
          ) {
            console.error(
              "ERRO AO DESFAZER GOOGLE:",
              cleanupError
            );
          }

          await supabase
            .from(
              "tour_events"
            )
            .delete()
            .eq(
              "id",
              newEvent.id
            );

          throw new Error(
            "O tour foi criado, mas não foi possível escalar o guia."
          );
        }

        setAvailability(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                  tourFormAvailabilityId
                  ? {
                      ...item,
                      status:
                        "escalated",
                    }
                  : item
            )
        );
      }

      /* ========================================================
         ESTADO LOCAL
      ======================================================== */

      setTourEvents(
        (current) => {
          const exists =
            current.some(
              (event) =>
                event.id ===
                createdDatabaseEvent!.id
            );

          if (
            exists
          ) {
            return current.map(
              (event) =>
                event.id ===
                  createdDatabaseEvent!.id
                  ? createdDatabaseEvent!
                  : event
            );
          }

          return [
            ...current,
            createdDatabaseEvent!,
          ];
        }
      );

      setShowTourForm(
        false
      );

      setTourFormDate(
        null
      );

      setTourFormAvailabilityId(
        null
      );

      setSelectedGuideDetails(
        null
      );

      setSelectedGuideAvailability(
        null
      );

      alert(
        guide
          ? "✅ Tour criado e guia escalado com sucesso."
          : "✅ Tour lançado com sucesso e deixado sem guia."
      );
    } catch (
      error: any
    ) {
      console.error(
        "❌ ERRO AO CRIAR TOUR:",
        error
      );

      alert(
        error?.message ||
          "Ocorreu um erro ao criar o tour."
      );
    } finally {
      setUpdating(
        false
      );
    }
  }

  /* ============================================================
  REMOVER ESCALA
  ============================================================ */

  async function unEscalateGuide() {
    if (
      !selectedGuideAvailability
    ) {
      return;
    }

    setUpdating(
      true
    );

    const availabilityId =
      selectedGuideAvailability.id;

    const guideId =
      selectedGuideAvailability.guide_id;

    const date =
      selectedGuideAvailability.date;

    try {
      const {
        data:
          tourEvent,
        error:
          tourSearchError,
      } =
        await supabase
          .from(
            "tour_events"
          )
          .select(
            "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
          )
          .eq(
            "guide_id",
            guideId
          )
          .eq(
            "date",
            date
          )
          .eq(
            "status",
            "scheduled"
          )
          .maybeSingle();

      if (
        tourSearchError
      ) {
        throw new Error(
          "Não foi possível localizar o tour dessa escala."
        );
      }

      if (
        tourEvent?.calendar_event_id
      ) {
        await callGoogleCalendar({
          action:
            "update",

          eventId:
            tourEvent.calendar_event_id,

          date:
            tourEvent.date,

          title:
            tourEvent.title,

          description:
            tourEvent.description ||
            null,

          address:
            tourEvent.address ||
            null,

          allDay:
            tourEvent.all_day,

          startTime:
            tourEvent.start_time,

          endTime:
            tourEvent.end_time,

          guideEmail:
            null,

          additionalEmail:
            tourEvent.additional_email ||
            null,
        });
      }

      if (
        tourEvent
      ) {
        const {
          data:
            updatedTour,
          error:
            updateTourError,
        } =
          await supabase
            .from(
              "tour_events"
            )
            .update({
              guide_id:
                null,

              guide_email:
                null,
            })
            .eq(
              "id",
              tourEvent.id
            )
            .select(
              "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
            )
            .single();

        if (
          updateTourError ||
          !updatedTour
        ) {
          throw new Error(
            "O Google foi atualizado, mas não foi possível deixar o tour sem guia no sistema."
          );
        }

        setTourEvents(
          (current) =>
            current.map(
              (event) =>
                event.id ===
                  updatedTour.id
                  ? updatedTour as TourEvent
                  : event
            )
        );

        setSelectedTourEvent(
          (current) =>
            current &&
            current.id ===
              updatedTour.id
              ? updatedTour as TourEvent
              : current
        );
      }

      const {
        data:
          updatedAvailability,
        error:
          availabilityError,
      } =
        await supabase
          .from(
            "availability"
          )
          .update({
            status:
              "available",
          })
          .eq(
            "id",
            availabilityId
          )
          .select(
            "id, guide_id, date, status"
          )
          .single();

      if (
        availabilityError ||
        !updatedAvailability
      ) {
        throw new Error(
          "Não foi possível liberar o guia."
        );
      }

      setAvailability(
        (current) =>
          current.map(
            (item) =>
              item.id ===
                availabilityId
                ? updatedAvailability
                : item
          )
      );

      setSelectedGuideDetails(
        null
      );

      setSelectedGuideAvailability(
        null
      );

      alert(
        tourEvent
          ? "✅ Guia removido da escala. O tour continua no sistema e no Google Calendar sem guia."
          : "✅ Escala removida e guia liberado."
      );
    } catch (
      error: any
    ) {
      console.error(
        "❌ ERRO AO REMOVER ESCALA:",
        error
      );

      alert(
        error?.message ||
          "Não foi possível remover a escala."
      );
    } finally {
      setUpdating(
        false
      );
    }
  }

  /* ============================================================
  EDITAR TOUR
  ============================================================ */

  function openTourEdit(
    event: TourEvent
  ) {
    setEditTourTitle(
      event.title
    );

    setEditTourDescription(
      event.description ||
        ""
    );

    setEditTourAddress(
      event.address ||
        ""
    );

    setEditTourAllDay(
      event.all_day
    );

    setEditTourStartTime(
      event.start_time ||
        "09:00"
    );

    setEditTourEndTime(
      event.end_time ||
        "10:00"
    );

    setEditTourGuideId(
      event.guide_id ||
        ""
    );

    setEditTourAdditionalEmail(
      event.additional_email ||
        ""
    );

    setShowTourEdit(
      true
    );
  }

  /* ============================================================
  SALVAR EDIÇÃO
  ============================================================ */

  async function saveTourEdit() {
    if (
      !selectedTourEvent
    ) {
      return;
    }

    const newGuide =
      editTourGuideId
        ? guideMap.get(
            editTourGuideId
          )
        : null;

    if (
      editTourGuideId &&
      !newGuide
    ) {
      alert(
        "Selecione um guia válido."
      );

      return;
    }

    if (
      !editTourTitle.trim()
    ) {
      alert(
        "Informe o título do tour."
      );

      return;
    }

    if (
      editTourGuideId &&
      !newGuide?.email
    ) {
      alert(
        "O guia selecionado não possui e-mail cadastrado."
      );

      return;
    }

    if (
      !editTourAllDay &&
      editTourStartTime >=
        editTourEndTime
    ) {
      alert(
        "O horário de término deve ser maior que o horário de início."
      );

      return;
    }

    const guideChanged =
      selectedTourEvent.guide_id !==
      (
        newGuide?.id ||
        null
      );

    setUpdating(
      true
    );

    try {
      let oldAvailability:
        | Availability
        | null =
        null;

      let newAvailability:
        | Availability
        | null =
        null;

      if (
        guideChanged &&
        newGuide
      ) {
        const {
          data:
            newGuideAvailability,
          error:
            newGuideAvailabilityError,
        } =
          await supabase
            .from(
              "availability"
            )
            .select(
              "id, guide_id, date, status"
            )
            .eq(
              "guide_id",
              newGuide.id
            )
            .eq(
              "date",
              selectedTourEvent.date
            )
            .maybeSingle();

        if (
          newGuideAvailabilityError
        ) {
          throw new Error(
            "Não foi possível verificar a disponibilidade do novo guia."
          );
        }

        if (
          !newGuideAvailability
        ) {
          throw new Error(
            "O novo guia não possui disponibilidade registrada para este dia."
          );
        }

        if (
          newGuideAvailability.status !==
          "available"
        ) {
          throw new Error(
            "O novo guia não está disponível para este dia."
          );
        }

        newAvailability =
          newGuideAvailability as Availability;
      }

      if (
        guideChanged &&
        selectedTourEvent.guide_id
      ) {
        const {
          data:
            oldGuideAvailability,
          error:
            oldAvailabilityError,
        } =
          await supabase
            .from(
              "availability"
            )
            .select(
              "id, guide_id, date, status"
            )
            .eq(
              "guide_id",
              selectedTourEvent.guide_id
            )
            .eq(
              "date",
              selectedTourEvent.date
            )
            .maybeSingle();

        if (
          oldAvailabilityError
        ) {
          throw new Error(
            "Não foi possível localizar a disponibilidade do guia anterior."
          );
        }

        oldAvailability =
          oldGuideAvailability as
            | Availability
            | null;
      }

      const normalizedDescription =
        sanitizeDescriptionHtml(
          editTourDescription
        );

      const plainDescription =
        htmlToPlainText(
          normalizedDescription
        );

      if (
        selectedTourEvent.calendar_event_id
      ) {
        await callGoogleCalendar({
          action:
            "update",

          eventId:
            selectedTourEvent.calendar_event_id,

          date:
            selectedTourEvent.date,

          title:
            editTourTitle.trim(),

          description:
            normalizedDescription
              ? normalizedDescription
              : null,

          address:
            editTourAddress.trim() ||
            null,

          allDay:
            editTourAllDay,

          startTime:
            editTourAllDay
              ? null
              : editTourStartTime,

          endTime:
            editTourAllDay
              ? null
              : editTourEndTime,

          guideEmail:
            newGuide?.email ||
            null,

          additionalEmail:
            editTourAdditionalEmail.trim() ||
            null,
        });
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "tour_events"
          )
          .update({
            title:
              editTourTitle.trim(),

            description:
              plainDescription
                ? normalizedDescription
                : null,

            address:
              editTourAddress.trim() ||
              null,

            all_day:
              editTourAllDay,

            start_time:
              editTourAllDay
                ? null
                : editTourStartTime,

            end_time:
              editTourAllDay
                ? null
                : editTourEndTime,

            guide_id:
              newGuide?.id ||
              null,

            guide_email:
              newGuide?.email ||
              null,

            additional_email:
              editTourAdditionalEmail.trim() ||
              null,
          })
          .eq(
            "id",
            selectedTourEvent.id
          )
          .select(
            "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, calendar_event_id, status, created_at, updated_at"
          )
          .single();

      if (
        error ||
        !data
      ) {
        throw new Error(
          "Não foi possível atualizar o tour no sistema."
        );
      }

      if (
        guideChanged
      ) {
        if (
          oldAvailability
        ) {
          const {
            error:
              oldAvailabilityUpdateError,
          } =
            await supabase
              .from(
                "availability"
              )
              .update({
                status:
                  "available",
              })
              .eq(
                "id",
                oldAvailability.id
              );

          if (
            oldAvailabilityUpdateError
          ) {
            throw new Error(
              "O tour foi atualizado, mas não foi possível liberar o guia anterior."
            );
          }

          setAvailability(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                    oldAvailability!.id
                    ? {
                        ...item,
                        status:
                          "available",
                      }
                    : item
              )
          );
        }

        if (
          newAvailability
        ) {
          const {
            error:
              newAvailabilityUpdateError,
          } =
            await supabase
              .from(
                "availability"
              )
              .update({
                status:
                  "escalated",
              })
              .eq(
                "id",
                newAvailability.id
              );

          if (
            newAvailabilityUpdateError
          ) {
            throw new Error(
              "O tour foi atualizado, mas não foi possível escalar o novo guia."
            );
          }

          setAvailability(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                    newAvailability!.id
                    ? {
                        ...item,
                        status:
                          "escalated",
                      }
                    : item
              )
          );
        }
      }

      setTourEvents(
        (current) =>
          current.map(
            (event) =>
              event.id ===
                data.id
                ? data as TourEvent
                : event
          )
      );

      setSelectedTourEvent(
        data as TourEvent
      );

      setShowTourEdit(
        false
      );

      alert(
        newGuide
          ? guideChanged
            ? "✅ Tour atualizado e guia trocado com sucesso."
            : "✅ Tour atualizado e sincronizado com o Google Calendar."
          : "✅ Tour atualizado e deixado sem guia."
      );
    } catch (
      error: any
    ) {
      console.error(
        "❌ ERRO AO EDITAR TOUR:",
        error
      );

      alert(
        error?.message ||
          "Não foi possível atualizar o tour."
      );
    } finally {
      setUpdating(
        false
      );
    }
  }

  /* ============================================================
  CANCELAR TOUR
  ============================================================ */

  async function cancelTour(
    event: TourEvent
  ) {
    const confirmed =
      window.confirm(
        `Deseja realmente cancelar o tour "${event.title}"? Ele será removido da agenda do Google e do sistema.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setUpdating(
      true
    );

    try {
      if (
        event.calendar_event_id
      ) {
        await callGoogleCalendar({
          action:
            "delete",

          eventId:
            event.calendar_event_id,
        });
      }

      if (
        event.guide_id
      ) {
        const {
          data:
            availabilityItem,
        } =
          await supabase
            .from(
              "availability"
            )
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

        if (
          availabilityItem
        ) {
          const {
            error:
              availabilityError,
          } =
            await supabase
              .from(
                "availability"
              )
              .update({
                status:
                  "available",
              })
              .eq(
                "id",
                availabilityItem.id
              );

          if (
            availabilityError
          ) {
            throw new Error(
              "O evento foi removido do Google, mas não foi possível liberar o guia."
            );
          }

          setAvailability(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                    availabilityItem.id
                    ? {
                        ...item,
                        status:
                          "available",
                      }
                    : item
              )
          );
        }
      }

      const {
        error:
          deleteError,
      } =
        await supabase
          .from(
            "tour_events"
          )
          .delete()
          .eq(
            "id",
            event.id
          );

      if (
        deleteError
      ) {
        throw new Error(
          "O evento foi removido do Google, mas não foi possível removê-lo do sistema."
        );
      }

      setTourEvents(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              event.id
          )
      );

      setSelectedTourEvent(
        null
      );

      alert(
        "✅ Tour cancelado, removido do Google Calendar e guia liberado."
      );
    } catch (
      error: any
    ) {
      console.error(
        "❌ ERRO AO CANCELAR TOUR:",
        error
      );

      alert(
        error?.message ||
          "Não foi possível cancelar o tour."
      );
    } finally {
      setUpdating(
        false
      );
    }
  }

  /* ============================================================
  VIEWS
  ============================================================ */

  function switchToMonthView() {
    setSelectedDate(
      null
    );

    setSelectedGuideDetails(
      null
    );

    setSelectedGuideAvailability(
      null
    );

    setSelectedTourEvent(
      null
    );

    setShowTourForm(
      false
    );

    setShowTourEdit(
      false
    );

    setTourFormDate(
      null
    );

    setTourFormAvailabilityId(
      null
    );

    setCalendarView(
      "month"
    );
  }

  function enterDayView() {
    if (
      selectedDate
    ) {
      setCurrentDay(
        new Date(
          `${selectedDate}T12:00:00`
        )
      );
    }

    setSelectedDate(
      null
    );

    setSelectedGuideDetails(
      null
    );

    setSelectedGuideAvailability(
      null
    );

    setSelectedTourEvent(
      null
    );

    setShowTourForm(
      false
    );

    setShowTourEdit(
      false
    );

    setTourFormDate(
      null
    );

    setTourFormAvailabilityId(
      null
    );

    setCalendarView(
      "day"
    );
  }

  function goPreviousMonth() {
    setCurrentMonth(
      subMonths(
        currentMonth,
        1
      )
    );
  }

  function goNextMonth() {
    setCurrentMonth(
      addMonths(
        currentMonth,
        1
      )
    );
  }

  function goPreviousDay() {
    const newDay =
      subDays(
        currentDay,
        1
      );

    setCurrentDay(
      newDay
    );

    setCurrentMonth(
      newDay
    );

    setSelectedDate(
      null
    );
  }

  function goNextDay() {
    const newDay =
      addDays(
        currentDay,
        1
      );

    setCurrentDay(
      newDay
    );

    setCurrentMonth(
      newDay
    );

    setSelectedDate(
      null
    );
  }

  function goToday() {
    const today =
      new Date();

    setCurrentDay(
      today
    );

    setCurrentMonth(
      today
    );

    setSelectedDate(
      null
    );

    setSelectedGuideDetails(
      null
    );

    setSelectedGuideAvailability(
      null
    );

    setSelectedTourEvent(
      null
    );

    setShowTourForm(
      false
    );

    setShowTourEdit(
      false
    );

    setTourFormDate(
      null
    );

    setTourFormAvailabilityId(
      null
    );
  }

  /* ============================================================
  DIA
  ============================================================ */

  const currentDayString =
    format(
      currentDay,
      "yyyy-MM-dd"
    );

  const currentDayAvailability =
    getDayAvailability(
      currentDayString
    );

  const currentDayEvents =
    getDayTourEvents(
      currentDayString
    );

  const currentDayAvailable =
    currentDayAvailability.filter(
      (item) =>
        item.status ===
        "available"
    );

  const currentDayUnavailable =
    currentDayAvailability.filter(
      (item) =>
        item.status ===
        "unavailable"
    );

  const currentDayEscalated =
    currentDayAvailability.filter(
      (item) =>
        item.status ===
        "escalated"
    );

  const monthName =
    format(
      currentMonth,
      "MMMM yyyy",
      {
        locale:
          ptBR,
      }
    );

  const dayName =
    format(
      currentDay,
      "EEEE, dd 'de' MMMM 'de' yyyy",
      {
        locale:
          ptBR,
      }
    );

  /* ============================================================
  RENDER
  ============================================================ */

  return (
    <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm sm:mt-6 sm:rounded-3xl sm:p-6">

      {/* ======================================================
         CABEÇALHO
      ====================================================== */}

      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-5 md:flex-row md:items-center md:justify-between">

        <div>
          <h3 className="text-lg font-extrabold text-gray-900 sm:text-2xl">
            Agenda dos Guias
          </h3>

          <p className="mt-1 text-xs font-medium text-gray-600 sm:text-sm">
            Visualize a disponibilidade, escalas e tours.
          </p>
        </div>

        <div className="relative w-full md:w-80">

          <input
            type="text"
            value={
              guideSearch
            }
            onChange={(
              event
            ) =>
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
                setGuideSearch(
                  ""
                )
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          )}

        </div>
      </div>

      {guideSearch.trim() && (
        <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800 sm:mb-6 sm:text-sm">

          {filteredGuides.length ===
          0 ? (
            <>
              Nenhum guia encontrado para "
              {guideSearch}".
            </>
          ) : (
            <>
              Mostrando a agenda de{" "}
              <strong>
                {
                  filteredGuides.length
                }
              </strong>{" "}
              guia
              {filteredGuides.length !==
              1
                ? "s"
                : ""}{" "}
              encontrado
              {filteredGuides.length !==
              1
                ? "s"
                : ""}.
            </>
          )}

        </div>
      )}

      {/* ======================================================
         MÊS / DIA
      ====================================================== */}

      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-gray-50 p-2 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:p-3">

        <div className="flex rounded-xl border border-gray-200 bg-white p-1">

          <button
            type="button"
            onClick={
              switchToMonthView
            }
            className={[
              "flex-1 rounded-lg px-4 py-2 text-sm font-extrabold transition sm:flex-none",
              calendarView ===
              "month"
                ? "bg-[#1687d9] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100",
            ].join(" ")}
          >
            📅 Mês
          </button>

          <button
            type="button"
            onClick={
              enterDayView
            }
            className={[
              "flex-1 rounded-lg px-4 py-2 text-sm font-extrabold transition sm:flex-none",
              calendarView ===
              "day"
                ? "bg-[#1687d9] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100",
            ].join(" ")}
          >
            📌 Dia
          </button>

        </div>

        {calendarView ===
          "day" && (
          <button
            type="button"
            onClick={
              goToday
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-700 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
          >
            Hoje
          </button>
        )}

      </div>

      {/* ======================================================
         NAVEGAÇÃO
      ====================================================== */}

      <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-50 p-2 sm:mb-6 sm:rounded-2xl sm:p-3">

        <button
          type="button"
          onClick={
            calendarView ===
            "month"
              ? goPreviousMonth
              : goPreviousDay
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-extrabold text-gray-900 shadow-sm transition hover:border-[#e91e8c] hover:bg-pink-50 hover:text-[#e91e8c] sm:h-11 sm:w-11 sm:rounded-xl sm:border-2 sm:text-xl"
        >
          ←
        </button>

        <div className="min-w-0 px-2 text-center">

          {calendarView ===
          "month" ? (
            <h4 className="px-2 text-base font-extrabold capitalize text-gray-900 sm:text-2xl">
              {
                monthName
              }
            </h4>
          ) : (
            <h4 className="break-words px-2 text-sm font-extrabold capitalize text-gray-900 sm:text-xl">
              {
                dayName
              }
            </h4>
          )}

        </div>

        <button
          type="button"
          onClick={
            calendarView ===
            "month"
              ? goNextMonth
              : goNextDay
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-extrabold text-gray-900 shadow-sm transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] sm:h-11 sm:w-11 sm:rounded-xl sm:border-2 sm:text-xl"
        >
          →
        </button>

      </div>

      {/* ======================================================
         LOADING
      ====================================================== */}

      {loading ? (
        <div className="py-10 text-center sm:py-12">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#e91e8c] sm:h-9 sm:w-9" />

          <p className="mt-3 text-xs font-medium text-gray-600 sm:mt-4 sm:text-sm">
            Carregando agenda...
          </p>

        </div>
      ) : (
        <>

          {/* ====================================================
             MODO MÊS
          ==================================================== */}

          {calendarView ===
            "month" && (
            <>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[8px] font-extrabold uppercase tracking-wide text-gray-800 sm:mb-3 sm:gap-2 sm:text-xs md:text-sm">

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

              <div className="grid grid-cols-7 gap-1 sm:gap-2">

                {days.map(
                  (day) => {

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
                        key={
                          date
                        }
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
                          "min-h-[58px] overflow-hidden rounded-lg border p-1 text-left transition",
                          "sm:min-h-32 sm:rounded-xl sm:p-2",

                          !sameMonth
                            ? "cursor-default border-transparent bg-gray-100 text-gray-400"
                            : "border-gray-200 bg-white hover:border-[#1687d9] hover:shadow-md",
                        ].join(" ")}
                      >

                        <div
                          className={[
                            "mb-1 text-right text-[9px] font-extrabold sm:mb-2 sm:text-sm",

                            sameMonth
                              ? "text-gray-900"
                              : "text-gray-400",
                          ].join(" ")}
                        >
                          {
                            format(
                              day,
                              "d"
                            )
                          }
                        </div>

                        <div className="space-y-0.5 overflow-hidden sm:space-y-1">

                          {dayEvents
                            .slice(
                              0,
                              2
                            )
                            .map(
                              (
                                event
                              ) => (
                                <div
                                  key={`event-${event.id}`}
                                  className="truncate rounded bg-blue-100 px-0.5 py-0.5 text-[7px] font-extrabold leading-tight text-blue-800 sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs"
                                  title={
                                    event.title
                                  }
                                >
                                  📅{" "}
                                  {
                                    event.title
                                  }
                                </div>
                              )
                            )}

                          {dayEvents.length >
                            2 && (
                            <div className="px-0.5 text-[7px] font-bold text-blue-700 sm:text-xs">
                              +
                              {
                                dayEvents.length -
                                  2
                              }{" "}
                              tours
                            </div>
                          )}

                          {escalated
                            .slice(
                              0,
                              2
                            )
                            .map(
                              (
                                item
                              ) => (
                                <div
                                  key={`escalated-${item.id}`}
                                  className="truncate rounded bg-[#f3e5a5] px-0.5 py-0.5 text-[7px] font-bold leading-tight text-[#806600] sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs"
                                  title={getGuideName(
                                    item.guide_id
                                  )}
                                >
                                  {
                                    getGuideFlags(
                                      item.guide_id
                                    )
                                  }{" "}
                                  {
                                    getGuideName(
                                      item.guide_id
                                    )
                                  }
                                </div>
                              )
                            )}

                          {escalated.length >
                            2 && (
                            <div className="px-0.5 text-[7px] font-bold text-[#806600] sm:text-xs">
                              +
                              {
                                escalated.length -
                                  2
                              }{" "}
                              escalados
                            </div>
                          )}

                          {available
                            .slice(
                              0,
                              2
                            )
                            .map(
                              (
                                item
                              ) => (
                                <div
                                  key={`available-${item.id}`}
                                  className="truncate rounded bg-green-100 px-0.5 py-0.5 text-[7px] font-semibold leading-tight text-green-800 sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs"
                                >
                                  {
                                    getGuideFlags(
                                      item.guide_id
                                    )
                                  }{" "}
                                  {
                                    getGuideName(
                                      item.guide_id
                                    )
                                  }
                                </div>
                              )
                            )}

                          {available.length >
                            2 && (
                            <div className="px-0.5 text-[7px] font-semibold text-green-700">
                              +
                              {
                                available.length -
                                  2
                              }
                            </div>
                          )}

                          {unavailable
                            .slice(
                              0,
                              1
                            )
                            .map(
                              (
                                item
                              ) => (
                                <div
                                  key={`unavailable-${item.id}`}
                                  className="truncate rounded bg-red-100 px-0.5 py-0.5 text-[7px] font-semibold leading-tight text-red-800 sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs"
                                >
                                  {
                                    getGuideFlags(
                                      item.guide_id
                                    )
                                  }{" "}
                                  {
                                    getGuideName(
                                      item.guide_id
                                    )
                                  }
                                </div>
                              )
                            )}

                          {unavailable.length >
                            1 && (
                            <div className="px-0.5 text-[7px] font-semibold text-red-700">
                              +
                              {
                                unavailable.length -
                                  1
                              }
                            </div>
                          )}

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-700 sm:mt-6 sm:gap-5 sm:pt-5 sm:text-sm">

                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-200 sm:h-4 sm:w-4" />
                  Tour
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-[#f3e5a5] ring-1 ring-[#d6c36c] sm:h-4 sm:w-4" />
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

          {/* ====================================================
             MODO DIA
          ==================================================== */}

          {calendarView ===
            "day" && (
            <div className="space-y-4">

              <div className="rounded-2xl bg-blue-50 p-4 sm:p-5">

                <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                  Data selecionada
                </p>

                <p className="mt-1 text-base font-extrabold capitalize text-blue-900 sm:text-xl">
                  {
                    dayName
                  }
                </p>

              </div>

              {/* TOURS */}

              <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">

                <div className="flex items-center justify-between gap-3">

                  <h4 className="text-sm font-extrabold text-blue-700 sm:text-base">
                    📅 Tours
                  </h4>

                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-extrabold text-blue-700">
                    {
                      currentDayEvents.length
                    }
                  </span>

                </div>

                <div className="mt-3 space-y-2">

                  {currentDayEvents.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">
                      Nenhum tour agendado para este dia.
                    </p>
                  ) : (
                    currentDayEvents.map(
                      (
                        event
                      ) => (
                        <button
                          key={
                            event.id
                          }
                          type="button"
                          onClick={() =>
                            setSelectedTourEvent(
                              event
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3 text-left transition hover:bg-blue-100"
                        >

                          <div className="min-w-0">

                            <p className="truncate text-sm font-extrabold text-blue-900">
                              {
                                event.title
                              }
                            </p>

                            <p className="mt-1 truncate text-xs font-semibold text-blue-600">

                              {
                                event.all_day
                                  ? "Dia inteiro"
                                  : `${event.start_time || "09:00"} - ${event.end_time || "10:00"}`
                              }

                              {" • "}

                              {
                                getGuideName(
                                  event.guide_id
                                )
                              }

                            </p>

                          </div>

                          <span className="shrink-0 text-blue-600">
                            →
                          </span>

                        </button>
                      )
                    )
                  )}

                </div>

              </div>

              {/* ESCALADOS */}

              <div className="rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm sm:p-5">

                <div className="flex items-center justify-between gap-3">

                  <h4 className="text-sm font-extrabold text-[#806600] sm:text-base">
                    🟡 Escalados
                  </h4>

                  <span className="rounded-full bg-[#f3e5a5] px-2.5 py-1 text-xs font-extrabold text-[#806600]">
                    {
                      currentDayEscalated.length
                    }
                  </span>

                </div>

                <div className="mt-3 space-y-2">

                  {currentDayEscalated.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">
                      Nenhum guia escalado.
                    </p>
                  ) : (
                    currentDayEscalated.map(
                      (
                        item
                      ) => {

                        const guide =
                          guideMap.get(
                            item.guide_id
                          );

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() => {

                              if (
                                guide
                              ) {
                                setSelectedGuideDetails(
                                  guide
                                );

                                setSelectedGuideAvailability(
                                  item
                                );
                              }

                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#f3e5a5] px-4 py-3 text-left transition hover:bg-[#ead98c]"
                          >

                            <span className="flex min-w-0 items-center gap-2">

                              {
                                getGuideFlags(
                                  item.guide_id
                                )
                              }

                              <span className="truncate text-sm font-extrabold text-[#806600]">
                                {
                                  getGuideName(
                                    item.guide_id
                                  )
                                }
                              </span>

                            </span>

                            <span className="shrink-0 text-[#806600]">
                              →
                            </span>

                          </button>
                        );
                      }
                    )
                  )}

                </div>

              </div>

              {/* DISPONÍVEIS */}

              <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">

                <div className="flex items-center justify-between gap-3">

                  <h4 className="text-sm font-extrabold text-green-700 sm:text-base">
                    🟢 Disponíveis
                  </h4>

                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-extrabold text-green-700">
                    {
                      currentDayAvailable.length
                    }
                  </span>

                </div>

                <div className="mt-3 space-y-2">

                  {currentDayAvailable.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">
                      Nenhum guia disponível.
                    </p>
                  ) : (
                    currentDayAvailable.map(
                      (
                        item
                      ) => {

                        const guide =
                          guideMap.get(
                            item.guide_id
                          );

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() => {

                              if (
                                guide
                              ) {
                                setSelectedGuideDetails(
                                  guide
                                );

                                setSelectedGuideAvailability(
                                  item
                                );
                              }

                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-xl bg-green-50 px-4 py-3 text-left transition hover:bg-green-100"
                          >

                            <span className="flex min-w-0 items-center gap-2">

                              {
                                getGuideFlags(
                                  item.guide_id
                                )
                              }

                              <span className="truncate text-sm font-extrabold text-green-800">
                                {
                                  getGuideName(
                                    item.guide_id
                                  )
                                }
                              </span>

                            </span>

                            <span className="shrink-0 text-green-600">
                              →
                            </span>

                          </button>
                        );
                      }
                    )
                  )}

                </div>

              </div>

              {/* INDISPONÍVEIS */}

              <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm sm:p-5">

                <div className="flex items-center justify-between gap-3">

                  <h4 className="text-sm font-extrabold text-red-700 sm:text-base">
                    🔴 Indisponíveis
                  </h4>

                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-extrabold text-red-700">
                    {
                      currentDayUnavailable.length
                    }
                  </span>

                </div>

                <div className="mt-3 space-y-2">

                  {currentDayUnavailable.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">
                      Nenhum guia indisponível.
                    </p>
                  ) : (
                    currentDayUnavailable.map(
                      (
                        item
                      ) => {

                        const guide =
                          guideMap.get(
                            item.guide_id
                          );

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() => {

                              if (
                                guide
                              ) {
                                setSelectedGuideDetails(
                                  guide
                                );

                                setSelectedGuideAvailability(
                                  item
                                );
                              }

                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-left transition hover:bg-red-100"
                          >

                            <span className="flex min-w-0 items-center gap-2">

                              {
                                getGuideFlags(
                                  item.guide_id
                                )
                              }

                              <span className="truncate text-sm font-extrabold text-red-800">
                                {
                                  getGuideName(
                                    item.guide_id
                                  )
                                }
                              </span>

                            </span>

                            <span className="shrink-0 text-red-600">
                              →
                            </span>

                          </button>
                        );
                      }
                    )
                  )}

                </div>

              </div>

            </div>
          )}

        </>
      )}

      {/* ======================================================
         MODAL DO DIA
      ====================================================== */}

      {selectedDate &&
        calendarView ===
          "month" && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4"
            onClick={() =>
              setSelectedDate(
                null
              )
            }
          >

            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6"
              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
            >

              <div className="flex items-start justify-between">

                <div>

                  <h3 className="text-lg font-extrabold capitalize text-gray-900 sm:text-xl">
                    {
                      format(
                        new Date(
                          `${selectedDate}T12:00:00`
                        ),
                        "dd 'de' MMMM",
                        {
                          locale:
                            ptBR,
                        }
                      )
                    }
                  </h3>

                  <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">
                    Agenda do dia
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
                >
                  ✕
                </button>

              </div>

              {/* ==================================================
                 TOURS
              ================================================== */}

              <div className="mt-5 sm:mt-6">

                <div className="flex items-center justify-between gap-3">

                  <h4 className="text-sm font-extrabold text-blue-700 sm:text-base">
                    📅 Tours
                  </h4>

                  <button
                    type="button"
                    disabled={
                      updating
                    }
                    onClick={
                      openTourFormFromDay
                    }
                    className="rounded-xl bg-[#1687d9] px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
                  >
                    ➕ Lançar tour
                  </button>

                </div>

                <div className="mt-2 space-y-2">

                  {selectedDayEvents.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                      Nenhum tour agendado para este dia.
                    </p>
                  ) : (
                    selectedDayEvents.map(
                      (
                        event
                      ) => (
                        <button
                          key={
                            event.id
                          }
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
                              {
                                event.title
                              }
                            </span>

                            <span className="mt-0.5 block text-xs font-semibold text-blue-600">

                              {
                                event.all_day
                                  ? "Dia inteiro"
                                  : `${event.start_time || "09:00"} - ${event.end_time || "10:00"}`
                              }

                              {" • "}

                              {
                                getGuideName(
                                  event.guide_id
                                )
                              }

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
                      (
                        item
                      ) => {

                        const guide =
                          guideMap.get(
                            item.guide_id
                          );

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() => {

                              if (
                                guide
                              ) {
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

                              {
                                getGuideFlags(
                                  item.guide_id
                                )
                              }

                              <span className="truncate">
                                {
                                  getGuideName(
                                    item.guide_id
                                  )
                                }
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
                      (
                        item
                      ) => {

                        const guide =
                          guideMap.get(
                            item.guide_id
                          );

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() => {

                              if (
                                guide
                              ) {
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

                              {
                                getGuideFlags(
                                  item.guide_id
                                )
                              }

                              <span className="truncate">
                                {
                                  getGuideName(
                                    item.guide_id
                                  )
                                }
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
                      (
                        item
                      ) => {

                        const guide =
                          guideMap.get(
                            item.guide_id
                          );

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() => {

                              if (
                                guide
                              ) {
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

                              {
                                getGuideFlags(
                                  item.guide_id
                                )
                              }

                              <span className="truncate">
                                {
                                  getGuideName(
                                    item.guide_id
                                  )
                                }
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
                onClick={() => {

                  setSelectedDate(
                    null
                  );

                  setSelectedGuideDetails(
                    null
                  );

                  setSelectedGuideAvailability(
                    null
                  );

                }}
                className="mt-5 w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f75bd] sm:mt-6"
              >
                Fechar
              </button>

            </div>

          </div>
        )}

      {/* ======================================================
         MODAL GUIA
      ====================================================== */}

      {selectedGuideDetails && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {

            if (
              !updating
            ) {
              setSelectedGuideDetails(
                null
              );

              setSelectedGuideAvailability(
                null
              );
            }

          }}
        >

          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="flex items-start justify-between border-b border-gray-100 p-6">

              <div>

                <h3 className="flex flex-wrap items-center gap-2 text-xl font-extrabold text-gray-900">

                  {
                    getGuideFlags(
                      selectedGuideDetails.id
                    )
                  }

                  <span>
                    {
                      selectedGuideDetails.name
                    }
                  </span>

                </h3>

                <p className="mt-1 text-sm font-medium text-gray-500">
                  Guia
                </p>

              </div>

              <button
                type="button"
                disabled={
                  updating
                }
                onClick={() => {

                  setSelectedGuideDetails(
                    null
                  );

                  setSelectedGuideAvailability(
                    null
                  );

                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
              >
                ✕
              </button>

            </div>

            <div className="space-y-4 p-6">

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  E-mail
                </p>

                <p className="mt-1 break-all text-sm font-bold text-gray-800">
                  {
                    selectedGuideDetails.email ||
                    "Não informado"
                  }
                </p>

              </div>

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Telefone
                </p>

                <p className="mt-1 text-sm font-bold text-gray-800">
                  {
                    selectedGuideDetails.phone
                      ? formatGuidePhone(
                          selectedGuideDetails.phone
                        )
                      : "Não informado"
                  }
                </p>

              </div>

              <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-100">

                <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                  Chave PIX
                </p>

                <div className="mt-1 flex items-center justify-between gap-3">

                  <p className="break-all text-sm font-bold text-gray-800">
                    {
                      selectedGuideDetails.pix_key ||
                      "Não informado"
                    }
                  </p>

                  {
                    selectedGuideDetails.pix_key && (
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
                    )
                  }

                </div>

              </div>

              {
                selectedGuideAvailability?.status ===
                  "available" && (
                  <button
                    type="button"
                    disabled={
                      updating
                    }
                    onClick={
                      openEscalationForm
                    }
                    className="w-full rounded-xl bg-[#c9aa00] px-4 py-3 font-extrabold text-white shadow-md transition hover:bg-[#b59600] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    🟡 Escalar para este dia
                  </button>
                )
              }

              {
                selectedGuideAvailability?.status ===
                  "escalated" && (
                  <button
                    type="button"
                    disabled={
                      updating
                    }
                    onClick={
                      unEscalateGuide
                    }
                    className="w-full rounded-xl bg-[#f3e5a5] px-4 py-3 font-extrabold text-[#806600] transition hover:bg-[#ead98c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {
                      updating
                        ? "Removendo..."
                        : "↩️ Remover escala"
                    }
                  </button>
                )
              }

              <button
                type="button"
                disabled={
                  updating
                }
                onClick={() => {

                  setSelectedGuideDetails(
                    null
                  );

                  setSelectedGuideAvailability(
                    null
                  );

                }}
                className="w-full rounded-xl bg-[#1687d9] px-4 py-3 font-extrabold text-white shadow-md transition hover:bg-[#0f75bd] disabled:opacity-60"
              >
                Fechar
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
         MODAL CRIAR TOUR
      ====================================================== */}

      {showTourForm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {

            if (
              !updating
            ) {
              setShowTourForm(
                false
              );

              setTourFormDate(
                null
              );

              setTourFormAvailabilityId(
                null
              );
            }

          }}
        >

          <div
            className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="border-b border-gray-100 p-6">

              <div className="flex items-start justify-between">

                <div>

                  <h3 className="text-xl font-extrabold text-gray-900">
                    📅 Lançar tour
                  </h3>

                  <p className="mt-1 text-sm font-medium text-gray-500">
                    Crie o tour na agenda. O guia é opcional.
                  </p>

                </div>

                <button
                  type="button"
                  disabled={
                    updating
                  }
                  onClick={() => {

                    setShowTourForm(
                      false
                    );

                    setTourFormDate(
                      null
                    );

                    setTourFormAvailabilityId(
                      null
                    );

                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 transition hover:bg-gray-100"
                >
                  ✕
                </button>

              </div>

            </div>

            <div className="space-y-5 p-6">

              {/* ==================================================
                 DATA
              ================================================== */}

              <div className="rounded-2xl bg-blue-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                  Data
                </p>

                <p className="mt-1 text-sm font-extrabold capitalize text-blue-900">

                  {
                    tourFormDate &&
                    format(
                      new Date(
                        `${tourFormDate}T12:00:00`
                      ),
                      "dd 'de' MMMM 'de' yyyy",
                      {
                        locale:
                          ptBR,
                      }
                    )
                  }

                </p>

              </div>

              {/* ==================================================
                 GUIA OPCIONAL
              ================================================== */}

              <div>

                <label className="text-sm font-extrabold text-gray-800">

                  Guia

                  <span className="ml-1 font-medium text-gray-400">
                    (opcional)
                  </span>

                </label>

                <select
                  value={
                    tourGuideId
                  }
                  onChange={(
                    event
                  ) =>
                    setTourGuideId(
                      event.target.value
                    )
                  }
                  disabled={
                    updating
                  }
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9]"
                >

                  <option value="">
                    Sem guia
                  </option>

                  {
                    guides
                      .filter(
                        (guide) =>
                          guide.active
                      )
                      .map(
                        (
                          guide
                        ) => (
                          <option
                            key={
                              guide.id
                            }
                            value={
                              guide.id
                            }
                          >
                            {
                              guide.name
                            }
                            {
                              guide.email
                                ? ` — ${guide.email}`
                                : ""
                            }
                          </option>
                        )
                      )
                  }

                </select>

                <p className="mt-2 text-xs font-medium text-gray-500">
                  Você pode deixar sem guia e adicionar um depois.
                </p>

              </div>

              {/* ==================================================
                 TÍTULO
              ================================================== */}

              <div>

                <label className="text-sm font-extrabold text-gray-800">
                  Título do tour
                </label>

                <input
                  type="text"
                  value={
                    tourTitle
                  }
                  onChange={(
                    event
                  ) =>
                    setTourTitle(
                      event.target.value
                    )
                  }
                  disabled={
                    updating
                  }
                  placeholder="Ex.: City Tour Rio"
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] placeholder:text-gray-400"
                />

              </div>

              {/* ==================================================
                 DESCRIÇÃO
              ================================================== */}

              <div>

                <div className="mb-2 flex items-center justify-between gap-3">

                  <label className="text-sm font-extrabold text-gray-800">
                    Descrição
                  </label>

                  <span className="text-xs font-medium text-gray-400">
                    Negrito, itálico, sublinhado e listas
                  </span>

                </div>

                <RichTextEditor
                  value={
                    tourDescription
                  }
                  onChange={
                    setTourDescription
                  }
                  disabled={
                    updating
                  }
                  minHeight="320px"
                />

              </div>

              {/* ==================================================
                 ENDEREÇO
              ================================================== */}

              <div>

                <label className="text-sm font-extrabold text-gray-800">
                  Endereço

                  <span className="ml-1 font-medium text-gray-400">
                    (opcional)
                  </span>

                </label>

                <input
                  type="text"
                  value={
                    tourAddress
                  }
                  onChange={(
                    event
                  ) =>
                    setTourAddress(
                      event.target.value
                    )
                  }
                  disabled={
                    updating
                  }
                  placeholder="Ex.: Av. Atlântica, 1702 - Copacabana"
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] placeholder:text-gray-400"
                />

              </div>

              {/* ==================================================
                 DIA INTEIRO
              ================================================== */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-4">

                <input
                  type="checkbox"
                  checked={
                    tourAllDay
                  }
                  onChange={(
                    event
                  ) =>
                    setTourAllDay(
                      event.target.checked
                    )
                  }
                  disabled={
                    updating
                  }
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

              {/* ==================================================
                 HORÁRIOS
              ================================================== */}

              {!tourAllDay && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <div>

                    <label className="text-sm font-extrabold text-gray-800">
                      Horário de início
                    </label>

                    <input
                      type="time"
                      value={
                        tourStartTime
                      }
                      onChange={(
                        event
                      ) =>
                        setTourStartTime(
                          event.target.value
                        )
                      }
                      disabled={
                        updating
                      }
                      className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9]"
                    />

                  </div>

                  <div>

                    <label className="text-sm font-extrabold text-gray-800">
                      Horário de término
                    </label>

                    <input
                      type="time"
                      value={
                        tourEndTime
                      }
                      onChange={(
                        event
                      ) =>
                        setTourEndTime(
                          event.target.value
                        )
                      }
                      disabled={
                        updating
                      }
                      className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9]"
                    />

                  </div>

                </div>
              )}

              {/* ==================================================
                 E-MAIL ADICIONAL
              ================================================== */}

              <div>

                <label className="text-sm font-extrabold text-gray-800">

                  E-mail adicional

                  <span className="ml-1 font-medium text-gray-400">
                    (opcional)
                  </span>

                </label>

                <input
                  type="email"
                  value={
                    tourAdditionalEmail
                  }
                  onChange={(
                    event
                  ) =>
                    setTourAdditionalEmail(
                      event.target.value
                    )
                  }
                  disabled={
                    updating
                  }
                  placeholder="cliente@email.com"
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] placeholder:text-gray-400"
                />

              </div>

              {/* ==================================================
                 DESTINATÁRIO GUIA
              ================================================== */}

              {
                tourGuideId && (
                  <div className="rounded-xl bg-green-50 p-4">

                    <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                      E-mail que receberá o convite
                    </p>

                    <p className="mt-1 break-all text-sm font-bold text-green-900">
                      {
                        guideMap.get(
                          tourGuideId
                        )?.email ||
                        "Não informado"
                      }
                    </p>

                    {
                      tourAdditionalEmail.trim() && (
                        <p className="mt-1 break-all text-xs font-semibold text-green-700">
                          +{" "}
                          {
                            tourAdditionalEmail
                          }
                        </p>
                      )
                    }

                  </div>
                )
              }

              {/* ==================================================
                 BOTÕES
              ================================================== */}

              <div className="flex flex-col gap-3 sm:flex-row">

                <button
                  type="button"
                  disabled={
                    updating
                  }
                  onClick={() => {

                    setShowTourForm(
                      false
                    );

                    setTourFormDate(
                      null
                    );

                    setTourFormAvailabilityId(
                      null
                    );

                  }}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={
                    updating
                  }
                  onClick={
                    createTourAndEscalate
                  }
                  className="w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {
                    updating
                      ? "Sincronizando..."
                      : tourGuideId
                      ? "Criar tour e escalar"
                      : "Lançar tour"
                  }
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
         MODAL TOUR
      ====================================================== */}

      {selectedTourEvent && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {

            if (
              !updating
            ) {
              setSelectedTourEvent(
                null
              );
            }

          }}
        >

          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="border-b border-gray-100 p-6">

              <div className="flex items-start justify-between gap-4">

                <div className="min-w-0">

                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-700">
                    Tour agendado
                  </span>

                  <h3 className="mt-2 break-words text-xl font-extrabold text-gray-900">
                    {
                      selectedTourEvent.title
                    }
                  </h3>

                </div>

                <button
                  type="button"
                  disabled={
                    updating
                  }
                  onClick={() =>
                    setSelectedTourEvent(
                      null
                    )
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
                  {
                    format(
                      new Date(
                        `${selectedTourEvent.date}T12:00:00`
                      ),
                      "dd 'de' MMMM 'de' yyyy",
                      {
                        locale:
                          ptBR,
                      }
                    )
                  }
                </p>

                <p className="mt-1 text-xs font-semibold text-gray-500">
                  {
                    selectedTourEvent.all_day
                      ? "Dia inteiro"
                      : `${selectedTourEvent.start_time || "09:00"} às ${selectedTourEvent.end_time || "10:00"}`
                  }
                </p>

              </div>

              {/* GUIA */}

              <div className="rounded-2xl bg-yellow-50 p-4">

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <p className="text-xs font-bold uppercase tracking-wide text-yellow-600">
                      Guia escalado
                    </p>

                    <p className="mt-1 flex items-center gap-2 text-sm font-extrabold text-gray-800">

                      {
                        getGuideFlags(
                          selectedTourEvent.guide_id
                        )
                      }

                      {
                        getGuideName(
                          selectedTourEvent.guide_id
                        )
                      }

                    </p>

                    <p className="mt-1 break-all text-xs font-semibold text-gray-500">
                      {
                        selectedTourEvent.guide_email ||
                        "Nenhum guia selecionado"
                      }
                    </p>

                  </div>

                  <button
                    type="button"
                    disabled={
                      updating
                    }
                    onClick={() =>
                      openTourEdit(
                        selectedTourEvent
                      )
                    }
                    className="shrink-0 rounded-xl border-2 border-yellow-200 bg-white px-3 py-2 text-xs font-extrabold text-yellow-800 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    🔄 Trocar guia
                  </button>

                </div>

              </div>

              {/* DESCRIÇÃO */}

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Descrição
                </p>

                <div
                  className="mt-2 break-words text-sm font-medium leading-7 text-gray-800 [&_b]:font-black [&_strong]:font-black [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedTourEvent.description
                        ? sanitizeDescriptionHtml(
                            selectedTourEvent.description
                          )
                        : "<span class='text-gray-500'>Nenhuma descrição informada.</span>",
                  }}
                />

              </div>

              {/* ENDEREÇO */}

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Endereço
                </p>

                <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold text-gray-800">
                  {
                    selectedTourEvent.address ||
                    "Nenhum endereço informado."
                  }
                </p>

              </div>

              {/* EMAIL */}

              <div className="rounded-2xl bg-gray-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  E-mail adicional
                </p>

                <p className="mt-1 break-all text-sm font-bold text-gray-800">
                  {
                    selectedTourEvent.additional_email ||
                    "Nenhum e-mail adicional."
                  }
                </p>

              </div>

              {/* GOOGLE */}

              <div className="rounded-2xl bg-green-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                  Google Calendar
                </p>

                <p className="mt-1 break-all text-xs font-bold text-green-800">
                  {
                    selectedTourEvent.calendar_event_id
                      ? "Evento sincronizado com o Google Calendar."
                      : "Evento ainda não sincronizado."
                  }
                </p>

              </div>

              {/* EDITAR */}

              <button
                type="button"
                disabled={
                  updating
                }
                onClick={() =>
                  openTourEdit(
                    selectedTourEvent
                  )
                }
                className="w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#0f75bd]"
              >
                ✏️ Editar tour
              </button>

              {/* CANCELAR */}

              <button
                type="button"
                disabled={
                  updating
                }
                onClick={() =>
                  cancelTour(
                    selectedTourEvent
                  )
                }
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-red-700"
              >
                {
                  updating
                    ? "Cancelando..."
                    : "❌ Cancelar tour"
                }
              </button>

              {/* FECHAR */}

              <button
                type="button"
                disabled={
                  updating
                }
                onClick={() =>
                  setSelectedTourEvent(
                    null
                  )
                }
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-extrabold text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
         MODAL EDITAR
      ====================================================== */}

      {
        showTourEdit &&
        selectedTourEvent && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
            onClick={() => {

              if (
                !updating
              ) {
                setShowTourEdit(
                  false
                );
              }

            }}
          >

            <div
              className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
              onClick={(
                event
              ) =>
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
                      Altere as informações e, se necessário, coloque outro guia.
                    </p>

                  </div>

                  <button
                    type="button"
                    disabled={
                      updating
                    }
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

                <div className="rounded-2xl border-2 border-yellow-100 bg-yellow-50 p-4">

                  <label className="text-sm font-extrabold text-yellow-900">
                    Guia escalado
                  </label>

                  <select
                    value={
                      editTourGuideId
                    }
                    onChange={(
                      event
                    ) =>
                      setEditTourGuideId(
                        event.target.value
                      )
                    }
                    disabled={
                      updating
                    }
                    className="mt-2 w-full rounded-xl border-2 border-yellow-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#c9aa00]"
                  >

                    <option value="">
                      Sem guia
                    </option>

                    {
                      selectedTourEvent?.guide_id &&
                      guideMap.get(
                        selectedTourEvent.guide_id
                      ) && (
                        <option
                          value={
                            selectedTourEvent.guide_id
                          }
                        >

                          {
                            guideMap.get(
                              selectedTourEvent.guide_id
                            )?.name
                          }

                          {" — "}

                          {
                            guideMap.get(
                              selectedTourEvent.guide_id
                            )?.email ||
                            ""
                          }

                          {" (atual)"}

                        </option>
                      )
                    }

                    {
                      availableGuidesForTourEdit
                        .filter(
                          (guide) =>
                            guide.id !==
                            selectedTourEvent?.guide_id
                        )
                        .map(
                          (
                            guide
                          ) => (
                            <option
                              key={
                                guide.id
                              }
                              value={
                                guide.id
                              }
                            >
                              {
                                guide.name
                              }
                              {
                                guide.email
                                  ? ` — ${guide.email}`
                                  : ""
                              }
                            </option>
                          )
                        )
                    }

                  </select>

                  <p className="mt-2 text-xs font-medium text-yellow-800">
                    Somente guias disponíveis neste dia aparecem para substituição.
                  </p>

                  {
                    editTourGuideId && (
                      <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-yellow-200">

                        <p className="text-xs font-bold uppercase tracking-wide text-yellow-600">
                          E-mail do guia selecionado
                        </p>

                        <p className="mt-1 break-all text-sm font-bold text-yellow-900">
                          {
                            guideMap.get(
                              editTourGuideId
                            )?.email ||
                            "Não informado"
                          }
                        </p>

                      </div>
                    )
                  }

                </div>

                {/* TÍTULO */}

                <div>

                  <label className="text-sm font-extrabold text-gray-800">
                    Título
                  </label>

                  <input
                    type="text"
                    value={
                      editTourTitle
                    }
                    onChange={(
                      event
                    ) =>
                      setEditTourTitle(
                        event.target.value
                      )
                    }
                    disabled={
                      updating
                    }
                    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9]"
                  />

                </div>

                {/* DESCRIÇÃO */}

                <div>

                  <div className="mb-2 flex items-center justify-between gap-3">

                    <label className="text-sm font-extrabold text-gray-800">
                      Descrição
                    </label>

                    <span className="text-xs font-medium text-gray-400">
                      Negrito, itálico, sublinhado e listas
                    </span>

                  </div>

                  <RichTextEditor
                    value={
                      editTourDescription
                    }
                    onChange={
                      setEditTourDescription
                    }
                    disabled={
                      updating
                    }
                    minHeight="320px"
                  />

                </div>

                {/* ENDEREÇO */}

                <div>

                  <label className="text-sm font-extrabold text-gray-800">

                    Endereço

                    <span className="ml-1 font-medium text-gray-400">
                      (opcional)
                    </span>

                  </label>

                  <input
                    type="text"
                    value={
                      editTourAddress
                    }
                    onChange={(
                      event
                    ) =>
                      setEditTourAddress(
                        event.target.value
                      )
                    }
                    disabled={
                      updating
                    }
                    placeholder="Ex.: Av. Atlântica, 1702 - Copacabana"
                    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9]"
                  />

                </div>

                {/* DIA INTEIRO */}

                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-4">

                  <input
                    type="checkbox"
                    checked={
                      editTourAllDay
                    }
                    onChange={(
                      event
                    ) =>
                      setEditTourAllDay(
                        event.target.checked
                      )
                    }
                    disabled={
                      updating
                    }
                    className="h-5 w-5 rounded"
                  />

                  <span>

                    <span className="block text-sm font-extrabold text-gray-800">
                      Dia inteiro
                    </span>

                  </span>

                </label>

                {/* HORÁRIOS */}

                {!editTourAllDay && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <div>

                      <label className="text-sm font-extrabold text-gray-800">
                        Horário de início
                      </label>

                      <input
                        type="time"
                        value={
                          editTourStartTime
                        }
                        onChange={(
                          event
                        ) =>
                          setEditTourStartTime(
                            event.target.value
                          )
                        }
                        disabled={
                          updating
                        }
                        className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9]"
                      />

                    </div>

                    <div>

                      <label className="text-sm font-extrabold text-gray-800">
                        Horário de término
                      </label>

                      <input
                        type="time"
                        value={
                          editTourEndTime
                        }
                        onChange={(
                          event
                        ) =>
                          setEditTourEndTime(
                            event.target.value
                          )
                        }
                        disabled={
                          updating
                        }
                        className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9]"
                      />

                    </div>

                  </div>
                )}

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
                    onChange={(
                      event
                    ) =>
                      setEditTourAdditionalEmail(
                        event.target.value
                      )
                    }
                    disabled={
                      updating
                    }
                    placeholder="cliente@email.com"
                    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9]"
                  />

                </div>

                {/* GOOGLE */}

                <div className="rounded-xl bg-green-50 p-4">

                  <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                    Sincronização Google
                  </p>

                  <p className="mt-1 text-sm font-semibold text-green-900">

                    {
                      selectedTourEvent.calendar_event_id
                        ? "Este tour está vinculado ao evento do Google Calendar."
                        : "Este tour ainda não possui vínculo com o Google Calendar."
                    }

                  </p>

                  <p className="mt-2 text-xs font-medium text-green-700">

                    {
                      editTourAllDay
                        ? "Dia inteiro"
                        : `${editTourStartTime} às ${editTourEndTime}`
                    }

                  </p>

                </div>

                {/* BOTÕES */}

                <div className="flex flex-col gap-3 sm:flex-row">

                  <button
                    type="button"
                    disabled={
                      updating
                    }
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
                    disabled={
                      updating
                    }
                    onClick={
                      saveTourEdit
                    }
                    className="w-full rounded-xl bg-[#1687d9] px-4 py-3 text-sm font-extrabold text-white shadow-md hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {
                      updating
                        ? "Sincronizando..."
                        : "Salvar alterações"
                    }
                  </button>

                </div>

              </div>

            </div>

          </div>
        )
      }

    </div>
  );
}