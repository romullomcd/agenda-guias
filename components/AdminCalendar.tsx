"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

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
  additional_email_2: string | null;
  google_color_id: string | null;
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
CORES GOOGLE CALENDAR
============================================================ */

const GOOGLE_EVENT_COLORS = [
  {
    id: "1",
    name: "Lavanda",
    className: "bg-[#a4bdfc]",
  },
  {
    id: "2",
    name: "Verde claro",
    className: "bg-[#7ae7bf]",
  },
  {
    id: "3",
    name: "Roxo",
    className: "bg-[#dbadff]",
  },
  {
    id: "4",
    name: "Vermelho claro",
    className: "bg-[#ff887c]",
  },
  {
    id: "5",
    name: "Amarelo",
    className: "bg-[#fbd75b]",
  },
  {
    id: "6",
    name: "Laranja",
    className: "bg-[#ffb878]",
  },
  {
    id: "7",
    name: "Ciano",
    className: "bg-[#46d6db]",
  },
  {
    id: "8",
    name: "Cinza",
    className: "bg-[#e1e1e1]",
  },
  {
    id: "9",
    name: "Azul",
    className: "bg-[#5484ed]",
  },
  {
    id: "10",
    name: "Verde",
    className: "bg-[#51b749]",
  },
  {
    id: "11",
    name: "Vermelho",
    className: "bg-[#dc2127]",
  },
];


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
HTML → TEXTO PURO
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
EDITOR RICO
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
    launchTourWithoutGuide,
    setLaunchTourWithoutGuide,
  ] = useState(false);



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
  ] = useState(true);

  const [
    updating,
    setUpdating,
  ] = useState(false);

  /* ============================================================
  FORMULÁRIO CRIAÇÃO
  ============================================================ */

  const [
    showTourForm,
    setShowTourForm,
  ] = useState(false);

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
  ] = useState(true);

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

const [
  tourAdditionalEmail2,
  setTourAdditionalEmail2,
] = useState("");

const [
  tourColorId,
  setTourColorId,
] = useState("9");

  /* ============================================================
  EDIÇÃO
  ============================================================ */

  const [
    showTourEdit,
    setShowTourEdit,
  ] = useState(false);

const [
  editTourDate,
  setEditTourDate,
] = useState(""); 

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
  ] = useState(true);

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

const [
  editTourAdditionalEmail2,
  setEditTourAdditionalEmail2,
] = useState("");

const [
  editTourColorId,
  setEditTourColorId,
] = useState("9");


  // ============================================================
  // CONTATOS GOOGLE - AUTOCOMPLETE
  // ============================================================

type GoogleContact = {
  name: string;
  email: string;
  photo: string | null;
};

  const [
    googleContacts,
    setGoogleContacts,
  ] = useState<GoogleContact[]>([]);

  const [
    googleContactsLoading,
    setGoogleContactsLoading,
  ] = useState(false);

  const [
    activeContactField,
    setActiveContactField,
  ] = useState<
    | "tourAdditionalEmail"
    | "tourAdditionalEmail2"
    | "editTourAdditionalEmail"
    | "editTourAdditionalEmail2"
    | null
  >(null);

  const [
    contactSearchQuery,
    setContactSearchQuery,
  ] = useState("");

  useEffect(() => {
    if (
      !activeContactField ||
      contactSearchQuery.trim().length < 2
    ) {
      setGoogleContacts([]);
      setGoogleContactsLoading(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(
      async () => {
        try {
          setGoogleContactsLoading(true);

          const {
            data: {
              session,
            },
          } =
            await supabase.auth.getSession();

          if (
            !session?.access_token
          ) {
            if (!cancelled) {
              setGoogleContacts([]);
            }

            return;
          }

          const response =
            await fetch(
              `/api/google/contacts?q=${encodeURIComponent(
                contactSearchQuery.trim()
              )}`,
              {
                method: "GET",
                headers: {
                  Authorization:
                    `Bearer ${session.access_token}`,
                },
                cache: "no-store",
              }
            );

          const result =
            await response
              .json()
              .catch(
                () => ({})
              );

          if (
            !cancelled &&
            response.ok
          ) {
            setGoogleContacts(
              Array.isArray(
                result.contacts
              )
                ? result.contacts
                : []
            );
          }

          if (
            !cancelled &&
            !response.ok
          ) {
            setGoogleContacts([]);
          }
        } catch (error) {
          console.error(
            "ERRO AO BUSCAR CONTATOS GOOGLE:",
            error
          );

          if (!cancelled) {
            setGoogleContacts([]);
          }
        } finally {
          if (!cancelled) {
            setGoogleContactsLoading(
              false
            );
          }
        }
      },
      300
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeContactField,
    contactSearchQuery,
  ]);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      const target =
        event.target as HTMLElement;

      if (
        !target.closest(
          "[data-google-contact-autocomplete]"
        )
      ) {
        setActiveContactField(null);
        setGoogleContacts([]);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  function handleAdditionalEmailChange(
    field:
      | "tourAdditionalEmail"
      | "tourAdditionalEmail2"
      | "editTourAdditionalEmail"
      | "editTourAdditionalEmail2",
    value: string
  ) {
    if (
      field ===
      "tourAdditionalEmail"
    ) {
      setTourAdditionalEmail(
        value
      );
    }

    if (
      field ===
      "tourAdditionalEmail2"
    ) {
      setTourAdditionalEmail2(
        value
      );
    }

    if (
      field ===
      "editTourAdditionalEmail"
    ) {
      setEditTourAdditionalEmail(
        value
      );
    }

    if (
      field ===
      "editTourAdditionalEmail2"
    ) {
      setEditTourAdditionalEmail2(
        value
      );
    }

    setActiveContactField(
      field
    );

    setContactSearchQuery(
      value
    );
  }

  function selectGoogleContact(
    field:
      | "tourAdditionalEmail"
      | "tourAdditionalEmail2"
      | "editTourAdditionalEmail"
      | "editTourAdditionalEmail2",
    contact: GoogleContact
  ) {
    if (
      field ===
      "tourAdditionalEmail"
    ) {
      setTourAdditionalEmail(
        contact.email
      );
    }

    if (
      field ===
      "tourAdditionalEmail2"
    ) {
      setTourAdditionalEmail2(
        contact.email
      );
    }

    if (
      field ===
      "editTourAdditionalEmail"
    ) {
      setEditTourAdditionalEmail(
        contact.email
      );
    }

    if (
      field ===
      "editTourAdditionalEmail2"
    ) {
      setEditTourAdditionalEmail2(
        contact.email
      );
    }

    setContactSearchQuery(
      contact.email
    );

    setActiveContactField(
      null
    );

    setGoogleContacts([]);
  }

// ============================================================
// ENDEREÇOS SALVOS - AUTOCOMPLETE
// ============================================================

type SavedAddress = {
  id: string;
  name: string;
  address: string;
  usage_count: number;
  is_preloaded: boolean;
};

const [
  savedAddresses,
  setSavedAddresses,
] = useState<SavedAddress[]>([]);

const [
  savedAddressesLoading,
  setSavedAddressesLoading,
] = useState(false);

const [
  activeAddressField,
  setActiveAddressField,
] = useState<
  "tourAddress" |
  "editTourAddress" |
  null
>(null);

const [
  addressSearchQuery,
  setAddressSearchQuery,
] = useState("");

useEffect(() => {
  if (
    !activeAddressField ||
    addressSearchQuery.trim().length < 2
  ) {
    setSavedAddresses([]);
    setSavedAddressesLoading(false);
    return;
  }

  let cancelled = false;

  const timer = setTimeout(
    async () => {
      try {
        setSavedAddressesLoading(
          true
        );

        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (
          !session?.access_token
        ) {
          if (!cancelled) {
            setSavedAddresses([]);
          }

          return;
        }

        const response =
          await fetch(
            `/api/addresses?q=${encodeURIComponent(
              addressSearchQuery.trim()
            )}`,
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (
          !cancelled &&
          response.ok
        ) {
          setSavedAddresses(
            Array.isArray(
              result.addresses
            )
              ? result.addresses
              : []
          );
        }

        if (
          !cancelled &&
          !response.ok
        ) {
          setSavedAddresses([]);
        }
      } catch (error) {
        console.error(
          "ERRO AO BUSCAR ENDEREÇOS:",
          error
        );

        if (!cancelled) {
          setSavedAddresses([]);
        }
      } finally {
        if (!cancelled) {
          setSavedAddressesLoading(
            false
          );
        }
      }
    },
    250
  );

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [
  activeAddressField,
  addressSearchQuery,
]);

function handleAddressChange(
  field:
    | "tourAddress"
    | "editTourAddress",
  value: string
) {
  if (
    field ===
    "tourAddress"
  ) {
    setTourAddress(
      value
    );
  }

  if (
    field ===
    "editTourAddress"
  ) {
    setEditTourAddress(
      value
    );
  }

  setActiveAddressField(
    field
  );

  setAddressSearchQuery(
    value
  );
}

function selectSavedAddress(
  field:
    | "tourAddress"
    | "editTourAddress",
  savedAddress: SavedAddress
) {
  const fullAddress =
    `${savedAddress.name}, ${savedAddress.address}`;

  if (
    field ===
    "tourAddress"
  ) {
    setTourAddress(
      fullAddress
    );
  }

  if (
    field ===
    "editTourAddress"
  ) {
    setEditTourAddress(
      fullAddress
    );
  }

  setAddressSearchQuery(
    fullAddress
  );

  setActiveAddressField(
    null
  );

  setSavedAddresses([]);
}

async function deleteSavedAddress(
  savedAddress: SavedAddress
) {
  if (
    savedAddress.is_preloaded
  ) {
    return;
  }

  const confirmed =
    window.confirm(
      `Deseja excluir o endereço "${savedAddress.name}" da lista de sugestões?\n\nIsso não apagará nenhum tour que já utilizou esse endereço.`
    );

  if (!confirmed) {
    return;
  }

  try {
    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (
      !session?.access_token
    ) {
      return;
    }

    const response =
      await fetch(
        `/api/addresses?id=${encodeURIComponent(
          savedAddress.id
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

    const result =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      window.alert(
        result.error ||
          "Não foi possível excluir o endereço."
      );

      return;
    }

    setSavedAddresses(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            savedAddress.id
        )
    );
  } catch (error) {
    console.error(
      "ERRO AO EXCLUIR ENDEREÇO:",
      error
    );

    window.alert(
      "Ocorreu um erro ao excluir o endereço."
    );
  }
}

async function saveAddressAfterTour(
  fullAddress: string
) {
  const value =
    fullAddress.trim();

  if (!value) {
    return;
  }

  try {
    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (
      !session?.access_token
    ) {
      return;
    }

    const separator =
      value.indexOf(",");

    let name = value;
    let address = "";

    if (
      separator > -1
    ) {
      name =
        value
          .slice(
            0,
            separator
          )
          .trim();

      address =
        value
          .slice(
            separator + 1
          )
          .trim();
    }

    if (
      !name ||
      !address
    ) {
      return;
    }

    await fetch(
      "/api/addresses",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          address,
        }),
      }
    );
  } catch (error) {
    console.error(
      "ERRO AO SALVAR ENDEREÇO APRENDIDO:",
      error
    );
  }
}

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

                if (
                  newItem.date <
                    firstDay ||
                  newItem.date >
                    lastDay
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

            if (
              newEvent.date <
                firstDay ||
              newEvent.date >
                lastDay
            ) {
              return;
            }

            setTourEvents(
              (current) => {
                const alreadyExists =
                  current.some(
                    (event) =>
                      event.id ===
                      newEvent.id
                  );

                if (
                  alreadyExists
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
  }, [
    currentMonth,
  ]);

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
          .from("availability")
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
          .from("tour_events")
.select(
  "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, additional_email_2, google_color_id, calendar_event_id, status, created_at, updated_at"
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
  MAPA
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
  GUIAS DISPONÍVEIS PARA TROCAR
  ============================================================ */

  const availableGuidesForTourEdit =
  useMemo(() => {
    if (
      !selectedTourEvent ||
      !editTourDate
    ) {
      return [];
    }

    const availableGuideIds =
      new Set(
        availability
          .filter(
            (item) =>
              item.date ===
                editTourDate &&
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
    editTourDate,
  ]);

  /* ============================================================
  DISPONIBILIDADE FILTRADA
  ============================================================ */

  const filteredAvailability =
    useMemo(() => {
      if (
        !normalizedSearch
      ) {
        return availability;
      }

      const matchingGuideIds =
        new Set(
          filteredGuides.map(
            (guide) =>
              guide.id
          )
        );

      return availability.filter(
        (item) =>
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
  TOURS FILTRADOS
  ============================================================ */

  const filteredTourEvents =
    useMemo(() => {
      if (
        !normalizedSearch
      ) {
        return tourEvents;
      }

      const matchingGuideIds =
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
  SELECTED DAY
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

  /* ============================================================
  HELPERS
  ============================================================ */

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
    guideId: string | null
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
    guideId: string | null
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
                className="inline-block h-2.5 w-4 rounded-sm object-cover sm:h-4 sm:w-6"
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


function getColorName(
  colorId:
    | string
    | null
    | undefined
) {
  return (
    GOOGLE_EVENT_COLORS.find(
      (color) =>
        color.id ===
        colorId
    )?.name ||
    "Azul"
  );
}

function getColorClass(
  colorId:
    | string
    | null
    | undefined
) {
  return (
    GOOGLE_EVENT_COLORS.find(
      (color) =>
        color.id ===
        colorId
    )?.className ||
    "bg-[#5484ed]"
  );
}



  /* ============================================================
  GOOGLE CALENDAR
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

      additionalEmail2?: string | null;

      colorId?: string | null;
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
  ESCALAR
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

    const escalationDate =
      selectedDate ||
      currentDayString;

    setTourFormDate(
      escalationDate
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

setTourAdditionalEmail2(
  ""
);
    setLaunchTourWithoutGuide(
      false
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
  LANÇAR TOUR PELO DIA — SEM GUIA OBRIGATÓRIO
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

setTourAdditionalEmail2(
  ""
);

    setLaunchTourWithoutGuide(
      true
    );

    setSelectedGuideDetails(
      null
    );

    setSelectedGuideAvailability(
      null
    );

    /*
     * Fecha o modal do dia antes de abrir
     * o formulário de lançamento.
     */
    setSelectedDate(
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
    const escalationDate =
      tourFormDate ||
      selectedDate ||
      currentDayString;

    const availabilityId =
      tourFormAvailabilityId;

    if (
      !escalationDate
    ) {
      alert(
        "Não foi possível identificar o dia da escala."
      );

      return;
    }

   const guide =
  guideMap.get(
    tourGuideId
  );

if (
  !launchTourWithoutGuide &&
  !availabilityId
) {
  alert(
    "Não foi possível identificar a disponibilidade do guia."
  );

  return;
}

if (
  !launchTourWithoutGuide &&
  !guide
) {
  alert(
    "Selecione um guia válido."
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

        if (
      !launchTourWithoutGuide &&
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

    setUpdating(
      true
    );

    let newDatabaseEvent:
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
              escalationDate,

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

additional_email_2:
  tourAdditionalEmail2.trim() ||
  null,

google_color_id:
  tourColorId,

calendar_event_id:
  null,

            status:
              "scheduled",
          })
 .select(
  "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, additional_email_2, google_color_id, calendar_event_id, status, created_at, updated_at"
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

      newDatabaseEvent =
        newEvent as TourEvent;

      /* ========================================================
         GOOGLE
      ======================================================== */

      const googleResult =
        await callGoogleCalendar({
          action:
            "create",

          date:
            escalationDate,

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

additionalEmail2:
  tourAdditionalEmail2.trim() ||
  null,

colorId:
  tourColorId,

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

      newDatabaseEvent =
        eventWithGoogleId as TourEvent;

   /* ========================================================
   ESCALAR GUIA
   Só executa no fluxo normal de escala.
   No modo "Lançar tour" sem guia, não existe
   disponibilidade para escalar.
======================================================== */

if (
  !launchTourWithoutGuide
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
        availabilityId
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
}

      setTourEvents(
        (current) => {
          const exists =
            current.some(
              (event) =>
                event.id ===
                newDatabaseEvent!.id
            );

          if (
            exists
          ) {
            return current.map(
              (event) =>
                event.id ===
                  newDatabaseEvent!.id
                  ? newDatabaseEvent!
                  : event
            );
          }

          return [
            ...current,
            newDatabaseEvent!,
          ];
        }
      );

      if (
  !launchTourWithoutGuide
) {
  setAvailability(
    (current) =>
      current.map(
        (item) =>
          item.id ===
            availabilityId
            ? {
                ...item,
                status:
                  "escalated",
              }
            : item
      )
  );
}

      setShowTourForm(
        false
      );

      setTourFormDate(
        null
      );

      setTourFormAvailabilityId(
        null
      );

      setLaunchTourWithoutGuide(
        false
      );

      setSelectedGuideDetails(
        null
      );

      setSelectedGuideAvailability(
        null
      );


      // ========================================================
      // SALVAR ENDEREÇO PARA AUTOCOMPLETE
      // Só acontece depois que o tour foi criado com sucesso.
      // ========================================================

      await saveAddressAfterTour(
        tourAddress
      );

    
      alert(
        launchTourWithoutGuide
          ? "✅ Tour lançado com sucesso no sistema e no Google Calendar, sem guia."
          : "✅ Tour criado, guia escalado e evento enviado para o Google Calendar."
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

      /* GOOGLE */

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

      /* SUPABASE — DEIXA TOUR SEM GUIA */

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

      /* LIBERAR GUIA */

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
  ABRIR EDIÇÃO
  ============================================================ */

  function openTourEdit(
    event: TourEvent
  ) {

setEditTourDate(
  event.date
);
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

setEditTourColorId(
  event.google_color_id ||
    "9"
);

    setEditTourGuideId(
      event.guide_id ||
        ""
    );

    setEditTourAdditionalEmail(
  event.additional_email ||
    ""
);

setEditTourAdditionalEmail2(
  event.additional_email_2 ||
    ""
);

    setShowTourEdit(
      true
    );
  }

function handleEditTourDateChange(
  value: string
) {
  const originalDate =
    selectedTourEvent?.date ||
    "";

  setEditTourDate(
    value
  );

  // Voltou para a data original:
  // restaura automaticamente o guia que o tour tinha.
  if (
    value === originalDate &&
    selectedTourEvent?.guide_id
  ) {
    setEditTourGuideId(
      selectedTourEvent.guide_id
    );

    return;
  }

  // Mudou para outra data:
  // remove o guia atual para obrigar
  // uma nova escolha baseada na nova data.
  if (
    value !== originalDate
  ) {
    setEditTourGuideId("");
  }
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

const dateChanged =
  selectedTourEvent.date !==
  editTourDate;

const assignmentChanged =
  guideChanged ||
  dateChanged;

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

      /* NOVO GUIA */

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
              editTourDate
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

      /* GUIA ANTIGO */

     if (
  assignmentChanged &&
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

      /* DESCRIÇÃO */

      const normalizedDescription =
        sanitizeDescriptionHtml(
          editTourDescription
        );

      const plainDescription =
        htmlToPlainText(
          normalizedDescription
        );

      /* GOOGLE */

      if (
        selectedTourEvent.calendar_event_id
      ) {
        await callGoogleCalendar({
          action:
            "update",

          eventId:
            selectedTourEvent.calendar_event_id,

          date:
  editTourDate,

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

additionalEmail2:
  editTourAdditionalEmail2.trim() ||
  null,

colorId:
  editTourColorId,


        });
      }

      /* SUPABASE */

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "tour_events"
          )
          .update({
date:
    editTourDate,
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

additional_email_2:
  editTourAdditionalEmail2.trim() ||
  null,

google_color_id:
  editTourColorId,

          })
          .eq(
            "id",
            selectedTourEvent.id
          )
.select(
  "id, date, title, description, address, all_day, start_time, end_time, guide_id, guide_email, additional_email, additional_email_2, google_color_id, calendar_event_id, status, created_at, updated_at"
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

      /* TROCAR GUIA */

     if (
  assignmentChanged
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

await saveAddressAfterTour(
  editTourAddress
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

    setLaunchTourWithoutGuide(
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

    setLaunchTourWithoutGuide(
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

    setLaunchTourWithoutGuide(
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
  DADOS DIA
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
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-black sm:mt-6 sm:rounded-3xl sm:p-6">

      {/* CABEÇALHO */}

      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-5 md:flex-row md:items-center md:justify-between">

        <div>
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white sm:text-2xl">
            Agenda dos Guias
          </h3>

          <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-300 sm:text-sm">
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
            className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-black dark:text-gray-100 outline-none transition placeholder:text-gray-400 focus:border-[#1687d9] focus:ring-4 focus:ring-blue-100 sm:rounded-xl"
          />

          {guideSearch && (
            <button
              type="button"
              onClick={() =>
                setGuideSearch(
                  ""
                )
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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

      {/* MÊS / DIA */}

      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-gray-50 dark:bg-gray-900 p-2 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:p-3">

        <div className="flex rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-black p-1">

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
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
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
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
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
            className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-black px-4 py-2 text-sm font-extrabold text-gray-700 dark:text-gray-200 transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9]"
          >
            Hoje
          </button>
        )}

      </div>

      {/* NAVEGAÇÃO */}

      <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-900 p-2 sm:mb-6 sm:rounded-2xl sm:p-3">

        <button
          type="button"
          onClick={
            calendarView ===
            "month"
              ? goPreviousMonth
              : goPreviousDay
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-black text-lg font-extrabold text-gray-900 dark:text-white shadow-sm transition hover:border-[#e91e8c] hover:bg-pink-50 hover:text-[#e91e8c] sm:h-11 sm:w-11 sm:rounded-xl sm:border-2 sm:text-xl"
        >
          ←
        </button>

        <div className="min-w-0 px-2 text-center">

          {calendarView ===
          "month" ? (
            <h4 className="px-2 text-base font-extrabold capitalize text-gray-900 dark:text-white sm:text-2xl">
              {
                monthName
              }
            </h4>
          ) : (
            <h4 className="break-words px-2 text-sm font-extrabold capitalize text-gray-900 dark:text-white sm:text-xl">
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
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-black text-lg font-extrabold text-gray-900 dark:text-white shadow-sm transition hover:border-[#1687d9] hover:bg-blue-50 hover:text-[#1687d9] sm:h-11 sm:w-11 sm:rounded-xl sm:border-2 sm:text-xl"
        >
          →
        </button>

      </div>

      {/* LOADING */}

      {loading ? (
        <div className="py-10 text-center sm:py-12">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-[#e91e8c] sm:h-9 sm:w-9" />

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
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[8px] font-extrabold uppercase tracking-wide text-gray-800 dark:text-gray-200 sm:mb-3 sm:gap-2 sm:text-xs md:text-sm">

                <div>Seg</div>
                <div>Ter</div>
                <div>Qua</div>
                <div>Qui</div>
                <div>Sex</div>
                <div>Sáb</div>
                <div>Dom</div>

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
  ? "cursor-default border-transparent bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500"
  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-black hover:border-[#1687d9] hover:shadow-md",
                        ].join(
                          " "
                        )}
                      >

                        <div
                          className={[
                            "mb-1 text-right text-[9px] font-extrabold sm:mb-2 sm:text-sm",
                            sameMonth
  ? "text-gray-900 dark:text-white"
  : "text-gray-400 dark:text-gray-500",
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
className={[
  "truncate rounded px-0.5 py-0.5 text-[7px] font-extrabold leading-tight text-gray-900 dark:text-white sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-xs",
  getColorClass(
    event.google_color_id ||
      "9"
  ),
].join(" ")}
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

                        
                          

                          

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-700 sm:mt-6 sm:gap-5 sm:pt-5 sm:text-sm">

                <div className="flex items-center gap-1.5">
  <span className="h-3 w-3 rounded bg-[#dc2127] ring-1 ring-[#b91c1c] sm:h-4 sm:w-4" />
  Tour sem guia/motorista
</div>

<div className="flex items-center gap-1.5">
  <span className="h-3 w-3 rounded bg-[#fbd75b] ring-1 ring-[#d4a900] sm:h-4 sm:w-4" />
  Tour com guia e motorista
</div>

<div className="flex items-center gap-1.5">
  <span className="h-3 w-3 rounded bg-[#5484ed] ring-1 ring-[#3b64c4] sm:h-4 sm:w-4" />
  Tour Ilha Grande
</div>

<div className="flex items-center gap-1.5">
  <span className="h-3 w-3 rounded bg-[#ff887c] ring-1 ring-[#d96359] sm:h-4 sm:w-4" />
  Tour Website
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

              <div className="rounded-2xl border border-blue-100 bg-white dark:border-blue-900 dark:bg-black p-4 shadow-sm sm:p-5">

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
                    <p className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
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
                         className={[
  "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:opacity-90",
  getColorClass(
    event.google_color_id ||
      "9"
  ),
].join(" ")}
                        >

                          <div className="min-w-0">

                            <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                              {
                                event.title
                              }
                            </p>

                            <p className="mt-1 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">

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

                          <span className="shrink-0 text-gray-700 dark:text-gray-200">
                            →
                          </span>

                        </button>
                      )
                    )
                  )}

                </div>

              </div>

              <div className="rounded-2xl border border-yellow-100 bg-white dark:border-yellow-900 dark:bg-black p-4 shadow-sm sm:p-5">

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
                    <p className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
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

              <div className="rounded-2xl border border-green-100 bg-white dark:border-green-900 dark:bg-black p-4 shadow-sm sm:p-5">

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
                    <p className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
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
                            className="flex w-full items-center justify-between gap-3 rounded-xl bg-green-50 dark:bg-green-950 px-4 py-3 text-left transition hover:bg-green-100"
                          >

                            <span className="flex min-w-0 items-center gap-2">

                              {
                                getGuideFlags(
                                  item.guide_id
                                )
                              }

                              <span className="truncate text-sm font-extrabold text-green-800 dark:text-white">
                                {
                                  getGuideName(
                                    item.guide_id
                                  )
                                }
                              </span>

                            </span>

                            <span className="shrink-0 text-green-600 dark:text-white">
                              →
                            </span>

                          </button>
                        );
                      }
                    )
                  )}

                </div>

              </div>

              <div className="rounded-2xl border border-red-100 bg-white dark:border-red-900 dark:bg-black p-4 shadow-sm sm:p-5">

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
                    <p className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
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
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4"
            onClick={() =>
              setSelectedDate(
                null
              )
            }
          >

            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-black p-4 shadow-2xl sm:rounded-3xl sm:p-6"
              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
            >

              <div className="flex items-start justify-between">

                <div>

                  <h3 className="text-lg font-extrabold capitalize text-gray-900 dark:text-white sm:text-xl">
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

                  <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-300 sm:text-sm">
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold text-gray-700 dark:text-gray-200 transition hover:bg-gray-100 dark:hover:bg-gray-800 sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg"
                >
                  ✕
                </button>

              </div>

              {/* TOURS */}

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
                    className="shrink-0 rounded-xl bg-[#1687d9] px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#0f75bd] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
                  >
                    ➕ Lançar tour
                  </button>

                </div>

                <div className="mt-2 space-y-2">

                  {selectedDayEvents.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">
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
className={[
  "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white transition hover:opacity-90",
  getColorClass(
    event.google_color_id ||
      "9"
  ),
].join(" ")}
                        >

                          <span className="min-w-0">

                            <span className="block truncate">
                              {
                                event.title
                              }
                            </span>

                            <span className="mt-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-200">

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

              {/* ESCALADOS */}

              <div className="mt-5 sm:mt-6">

                <h4 className="text-sm font-extrabold text-[#806600] sm:text-base">
                  🟡 Escalados
                </h4>

                <div className="mt-2 space-y-2">

                  {selectedEscalated.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">
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
                            className="flex w-full items-center justify-between rounded-xl bg-[#f3e5a5] dark:bg-yellow-950 px-4 py-3 text-left text-sm font-bold text-[#806600] transition hover:bg-[#ead98c]"
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

              {/* DISPONÍVEIS */}

              <div className="mt-5 sm:mt-6">

                <h4 className="text-sm font-extrabold text-green-700 sm:text-base">
                  🟢 Disponíveis
                </h4>

                <div className="mt-2 space-y-2">

                  {selectedAvailable.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">
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
                            className="flex w-full items-center justify-between gap-3 rounded-xl bg-green-50 dark:bg-green-950 px-4 py-3 text-left transition hover:bg-green-100"
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

              {/* INDISPONÍVEIS */}

              <div className="mt-5 sm:mt-6">

                <h4 className="text-sm font-extrabold text-red-700 sm:text-base">
                  🔴 Indisponíveis
                </h4>

                <div className="mt-2 space-y-2">

                  {selectedUnavailable.length ===
                  0 ? (
                    <p className="rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">
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
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 p-4"
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
            className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-black"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 p-6">

              <div>

                <h3 className="flex flex-wrap items-center gap-2 text-xl font-extrabold text-gray-900 dark:text-white">

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

                <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-300">
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
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white disabled:opacity-50"
              >
                ✕
              </button>

            </div>

            <div className="space-y-4 p-6">

              <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  E-mail
                </p>

                <p className="mt-1 break-all text-sm font-bold text-gray-800 dark:text-gray-100">
                  {
                    selectedGuideDetails.email ||
                    "Não informado"
                  }
                </p>

              </div>

              <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Telefone
                </p>

                <p className="mt-1 text-sm font-bold text-gray-800 dark:text-gray-100">
                  {
                    selectedGuideDetails.phone
                      ? formatGuidePhone(
                          selectedGuideDetails.phone
                        )
                      : "Não informado"
                  }
                </p>

              </div>

              <div className="rounded-2xl bg-green-50 dark:bg-green-950 p-4 ring-1 ring-green-100 dark:ring-green-900">

                <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                  Chave PIX
                </p>

                <div className="mt-1 flex items-center justify-between gap-3">

                  <p className="break-all text-sm font-bold text-gray-800 dark:text-gray-100">
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
                        className="shrink-0 rounded-lg bg-white dark:bg-black px-3 py-2 text-xs font-extrabold text-green-700 shadow-sm ring-1 ring-green-200 transition hover:bg-green-100"
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

      {showTourForm &&
  typeof document !== "undefined" &&
  createPortal(
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
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
            className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-black"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="border-b border-gray-100 dark:border-gray-800 p-6">

              <div className="flex items-start justify-between">

                <div>

                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
                    {launchTourWithoutGuide
                      ? "📅 Lançar tour"
                      : "🟡 Escalar guia"}
                  </h3>

                  <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-300">
                    {launchTourWithoutGuide
                      ? "Crie o tour diretamente neste dia. O guia é opcional."
                      : "Crie o tour que ficará na agenda e no Google Calendar."}
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-gray-800"
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

              {/* GUIA */}

              <div>

                <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
                  Guia
                </label>

                               <select
                  value={
                    tourGuideId
                  }
                  onChange={(
                    event
                  ) => {
                    const selectedGuideId =
                      event.target.value;

                    setTourGuideId(
                      selectedGuideId
                    );

                    // Sem guia
                    if (
                      !selectedGuideId
                    ) {
                      setTourFormAvailabilityId(
                        null
                      );

                      return;
                    }

                    // Procura a disponibilidade
                    // desse guia na data do tour.
                    const guideAvailability =
                      availability.find(
                        (item) =>
                          item.guide_id ===
                            selectedGuideId &&
                          item.date ===
                            tourFormDate &&
                          item.status ===
                            "available"
                      );

                    setTourFormAvailabilityId(
                      guideAvailability?.id ||
                        null
                    );
                  }}
                  disabled={
                    updating
                  }
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100"
                >
                  {/* SEM GUIA SEMPRE DISPONÍVEL */}

                  <option value="">
                    Sem guia
                  </option>

                  {/* SOMENTE GUIAS DISPONÍVEIS NA DATA */}

                  {guides
                    .filter(
                      (guide) =>
                        guide.active &&
                        availability.some(
                          (item) =>
                            item.guide_id ===
                              guide.id &&
                            item.date ===
                              tourFormDate &&
                            item.status ===
                              "available"
                        )
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
                    )}
                </select>

              </div>

              {/* TITULO */}

              <div>

                <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
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
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
                />

              </div>

              {/* DESCRIÇÃO */}

              <div>

                <div className="mb-2 flex items-center justify-between gap-3">

                  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
                    Descrição
                  </label>

                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
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

             {/* ENDEREÇO */}

<div
  className="relative"
  data-address-autocomplete
>

  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
    Endereço
    <span className="ml-1 font-medium text-gray-400 dark:text-gray-500">
      (opcional)
    </span>
  </label>

  <input
    type="text"
    value={tourAddress}
    onFocus={() => {
      setActiveAddressField(
        "tourAddress"
      );

      setAddressSearchQuery(
        tourAddress
      );
    }}
    onChange={(event) =>
      handleAddressChange(
        "tourAddress",
        event.target.value
      )
    }
    disabled={updating}
    placeholder="Ex.: Av. Atlântica, 1702 - Copacabana"
    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
  />

  {activeAddressField ===
    "tourAddress" &&
    (
      savedAddressesLoading ||
      savedAddresses.length > 0
    ) && (
      <div className="absolute left-0 right-0 top-full z-[1000] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">

        {savedAddressesLoading && (
          <div className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
            Buscando endereços...
          </div>
        )}

        {!savedAddressesLoading &&
          savedAddresses.map(
            (savedAddress) => (
              <div
                key={
                  savedAddress.id
                }
                className="flex items-center gap-2 border-b border-gray-100 last:border-b-0 dark:border-gray-800"
              >

                <button
                  type="button"
                  onMouseDown={(
                    event
                  ) => {
                    event.preventDefault();

                    selectSavedAddress(
                      "tourAddress",
                      savedAddress
                    );
                  }}
                  className="min-w-0 flex-1 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
                >

                  <div className="flex items-start gap-3">

                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1687d9] text-sm">
                      🏨
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                        {savedAddress.name}
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs font-medium text-gray-500 dark:text-gray-300">
                        {savedAddress.address}
                      </p>

                    </div>

                  </div>

                </button>

                {!savedAddress.is_preloaded && (
                  <button
                    type="button"
                    onMouseDown={(
                      event
                    ) => {
                      event.preventDefault();

                      deleteSavedAddress(
                        savedAddress
                      );
                    }}
                    className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 transition duration-150 hover:bg-red-100 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    title="Excluir endereço"
                    aria-label="Excluir endereço"
                  >
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="h-5 w-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 6h18"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 6V4h8v2"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 6l-1 14H6L5 6"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 11v5M14 11v5"
    />
  </svg>
</button>
                )}

              </div>
            )
          )}

      </div>
    )}

</div>



              {/* COR */}

              <div>

                <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
                  Cor do evento
                </label>

                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">

                  {GOOGLE_EVENT_COLORS.map(
                    (color) => (
                      <button
                        key={
                          color.id
                        }
                        type="button"
                        disabled={
                          updating
                        }
                        onClick={() =>
                          setTourColorId(
                            color.id
                          )
                        }
                        title={
                          color.name
                        }
                        className={[
                          "relative flex h-11 items-center justify-center rounded-xl border-2 transition",
                          color.className,
                          tourColorId ===
                          color.id
                            ? "border-gray-900 ring-4 ring-gray-200"
                            : "border-transparent hover:scale-105",
                        ].join(
                          " "
                        )}
                      >

                        {tourColorId ===
                          color.id && (
                          <span className="text-lg font-black text-white drop-shadow">
                            ✓
                          </span>
                        )}

                      </button>
                    )
                  )}

                </div>

                <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-300">
                  Cor selecionada:{" "}
                  <strong>
                    {
                      getColorName(
                        tourColorId
                      )
                    }
                  </strong>
                </p>

              </div>


              {/* DIA INTEIRO */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-900 p-4">

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

                  <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
  Dia inteiro
</span>

                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-300">
                    O evento ocupará o dia inteiro na agenda.
                  </span>

                </span>

              </label>

              {/* HORÁRIOS */}

              {!tourAllDay && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <div>

                    <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
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
                      className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100"
                    />

                  </div>

                  <div>

                    <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
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
                      className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100"
                    />

                  </div>

                </div>
              )}

           {/* EMAIL */}

<div
  className="relative"
  data-google-contact-autocomplete
>

  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
    E-mail adicional
    <span className="ml-1 font-medium text-gray-400 dark:text-gray-500">
      (opcional)
    </span>
  </label>

  <input
    type="email"
    value={
      tourAdditionalEmail
    }
    onFocus={() => {
      setActiveContactField(
        "tourAdditionalEmail"
      );

      setContactSearchQuery(
        tourAdditionalEmail
      );
    }}
    onChange={(
      event
    ) =>
      handleAdditionalEmailChange(
        "tourAdditionalEmail",
        event.target.value
      )
    }
    disabled={
      updating
    }
    placeholder="cliente@email.com"
    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
  />

  {activeContactField ===
    "tourAdditionalEmail" &&
    (
      googleContactsLoading ||
      googleContacts.length > 0
    ) && (
      <div className="absolute left-0 right-0 top-full z-[1000] mt-2 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">

        {googleContactsLoading && (
          <div className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
            Buscando contatos...
          </div>
        )}

        {!googleContactsLoading &&
          googleContacts.map(
            (contact) => (
              <button
                key={`${contact.email}-${contact.name}`}
                type="button"
                onMouseDown={(
                  event
                ) => {
                  event.preventDefault();

                  selectGoogleContact(
                    "tourAdditionalEmail",
                    contact
                  );
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >

                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1687d9] text-sm font-extrabold text-white">
  {contact.photo ? (
    <img
      src={contact.photo}
      alt=""
      className="h-full w-full object-cover"
    />
  ) : (
    contact.name
      ? contact.name
          .charAt(0)
          .toUpperCase()
      : "@"
  )}
</div>

                <div className="min-w-0">

                  <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                    {contact.name ||
                      "Contato"}
                  </p>

                  <p className="truncate text-xs text-gray-500 dark:text-gray-300">
                    {contact.email}
                  </p>

                </div>

              </button>
            )
          )}

      </div>
    )}

</div>


{/* EMAIL ADICIONAL 2 */}

<div
  className="relative mt-4"
  data-google-contact-autocomplete
>

  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
    E-mail adicional 2
    <span className="ml-1 font-medium text-gray-400 dark:text-gray-500">
      (opcional)
    </span>
  </label>

  <input
    type="email"
    value={
      tourAdditionalEmail2
    }
    onFocus={() => {
      setActiveContactField(
        "tourAdditionalEmail2"
      );

      setContactSearchQuery(
        tourAdditionalEmail2
      );
    }}
    onChange={(
      event
    ) =>
      handleAdditionalEmailChange(
        "tourAdditionalEmail2",
        event.target.value
      )
    }
    disabled={
      updating
    }
    placeholder="cliente2@email.com"
    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
  />

  {activeContactField ===
    "tourAdditionalEmail2" &&
    (
      googleContactsLoading ||
      googleContacts.length > 0
    ) && (
      <div className="absolute left-0 right-0 top-full z-[1000] mt-2 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">

        {googleContactsLoading && (
          <div className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
            Buscando contatos...
          </div>
        )}

        {!googleContactsLoading &&
          googleContacts.map(
            (contact) => (
              <button
                key={`${contact.email}-${contact.name}`}
                type="button"
                onMouseDown={(
                  event
                ) => {
                  event.preventDefault();

                  selectGoogleContact(
                    "tourAdditionalEmail2",
                    contact
                  );
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >

               <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1687d9] text-sm font-extrabold text-white">
  {contact.photo ? (
    <img
      src={contact.photo}
      alt=""
      className="h-full w-full object-cover"
    />
  ) : (
    contact.name
      ? contact.name
          .charAt(0)
          .toUpperCase()
      : "@"
  )}
</div>

                <div className="min-w-0">

                  <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                    {contact.name ||
                      "Contato"}
                  </p>

                  <p className="truncate text-xs text-gray-500 dark:text-gray-300">
                    {contact.email}
                  </p>

                </div>

              </button>
            )
          )}

      </div>
    )}

</div>

              {/* EMAIL GUIA */}

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

              {/* BOTÕES */}

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
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-extrabold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-900"
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
                  className="w-full rounded-xl bg-[#c9aa00] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#b59600] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {
                    updating
                      ? "Sincronizando..."
                      : launchTourWithoutGuide
                      ? "Lançar tour"
                      : "Criar tour e escalar"
                  }
                </button>

              </div>

            </div>

          </div>

                </div>,
    document.body
  )}

      {/* ======================================================
         MODAL TOUR
      ====================================================== */}

{selectedTourEvent &&
  typeof document !== "undefined" &&
  createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"

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
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-black"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="border-b border-gray-100 dark:border-gray-800 p-6">

              <div className="flex items-start justify-between gap-4">

                <div className="min-w-0">

                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-700">
                    Tour agendado
                  </span>

                  <h3 className="mt-2 break-words text-xl font-extrabold text-gray-900 dark:text-white">
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-gray-500 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  ✕
                </button>

              </div>

            </div>

            <div className="space-y-4 p-6">

              {/* DATA */}

              <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Data
                </p>

                <p className="mt-1 text-sm font-extrabold capitalize text-gray-800 dark:text-gray-100">
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

                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-300">

                  {
                    selectedTourEvent.all_day
                      ? "Dia inteiro"
                      : `${selectedTourEvent.start_time || "09:00"} às ${selectedTourEvent.end_time || "10:00"}`
                  }

                </p>

              </div>

              {/* GUIA */}

              <div className="rounded-2xl bg-yellow-50 dark:bg-yellow-950 p-4">

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <p className="text-xs font-bold uppercase tracking-wide text-yellow-600">
                      Guia escalado
                    </p>

                    <p className="mt-1 flex items-center gap-2 text-sm font-extrabold text-gray-800 dark:text-gray-100">

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

                    <p className="mt-1 break-all text-xs font-semibold text-gray-500 dark:text-gray-300">
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
                    className="shrink-0 rounded-xl border-2 border-yellow-200 bg-white dark:bg-black px-3 py-2 text-xs font-extrabold text-yellow-800 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    🔄 Trocar guia
                  </button>

                </div>

              </div>

              {/* DESCRIÇÃO */}

              <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Descrição
                </p>

                <div
                  className="mt-2 break-words text-sm font-medium leading-7 text-gray-800 dark:text-gray-100 [&_b]:font-black [&_strong]:font-black [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedTourEvent.description
                        ? sanitizeDescriptionHtml(
                            selectedTourEvent.description
                          )
                        : "<span class='text-gray-500 dark:text-gray-300'>Nenhuma descrição informada.</span>",
                  }}
                />

              </div>

              {/* ENDEREÇO */}

              <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Endereço
                </p>

                <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold text-gray-800 dark:text-gray-100">
                  {
                    selectedTourEvent.address ||
                    "Nenhum endereço informado."
                  }
                </p>

              </div>

              {/* EMAIL */}

                            {/* EMAIL */}

              <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  E-mail adicional
                </p>

                <div className="mt-1 space-y-1 text-sm font-bold text-gray-800 dark:text-gray-100">

                  {
                    selectedTourEvent.additional_email ||
                    selectedTourEvent.additional_email_2
                      ? (
                          <>
                            {
                              selectedTourEvent.additional_email && (
                                <p className="break-all">
                                  {
                                    selectedTourEvent.additional_email
                                  }
                                </p>
                              )
                            }

                            {
                              selectedTourEvent.additional_email_2 && (
                                <p className="break-all">
                                  {
                                    selectedTourEvent.additional_email_2
                                  }
                                </p>
                              )
                            }
                          </>
                        )
                      : (
                          "Nenhum e-mail adicional."
                        )
                  }

                </div>

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

                </div>,
    document.body
  )}

      {/* ======================================================
         MODAL EDITAR
      ====================================================== */}

{
  showTourEdit &&
  selectedTourEvent &&
  typeof document !== "undefined" &&
  createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
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
              className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-black"
              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
            >

              <div className="border-b border-gray-100 dark:border-gray-800 p-6">

                <div className="flex items-start justify-between">

                  <div>

                    <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
                      ✏️ Editar tour
                    </h3>

                    <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-300">
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
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    ✕
                  </button>

                </div>

              </div>

              <div className="space-y-5 p-6">


{/* DATA */}

<div>
  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
    Data do tour
  </label>

  <input
    type="date"
    value={editTourDate}
    onChange={(event) =>
      handleEditTourDateChange(
        event.target.value
      )
    }
    onClick={(event) => {
      const input =
        event.currentTarget;

      if (
        typeof input.showPicker ===
        "function"
      ) {
        try {
          input.showPicker();
        } catch {
          // O navegador pode bloquear o seletor
          // em algumas situações.
        }
      }
    }}
    disabled={updating}
    className="mt-2 h-[48px] w-full appearance-none rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold leading-normal text-gray-900 outline-none transition focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100"
  />
</div>
                {/* GUIA */}

                <div className="rounded-2xl border-2 border-yellow-100 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 p-4">

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
                    className="mt-2 w-full rounded-xl border-2 border-yellow-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#c9aa00] dark:border-gray-700 dark:bg-black dark:text-gray-100"
                  >
                    <option value="">
                      Sem guia
                    </option>

                    {/* ==================================================
                        GUIA ORIGINAL
                        Só aparece enquanto estivermos na data original.
                    ================================================== */}

                    {editTourDate ===
                      selectedTourEvent?.date &&
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
                      )}

                    {/* ==================================================
                        SOMENTE GUIAS DISPONÍVEIS NA DATA ESCOLHIDA
                    ================================================== */}

                    {availableGuidesForTourEdit
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
                      )}
                  </select>

                  <p className="mt-2 text-xs font-medium text-yellow-800">
                    Somente guias disponíveis neste dia aparecem para substituição.
                  </p>

                  {
                    editTourGuideId && (
                      <div className="mt-3 rounded-xl bg-white dark:bg-black p-3 ring-1 ring-yellow-200">

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

                  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
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
                    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
                  />

                </div>

                {/* DESCRIÇÃO */}

                <div>

                  <div className="mb-2 flex items-center justify-between gap-3">

                    <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
                      Descrição
                    </label>

                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
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

<div
  className="relative"
  data-address-autocomplete
>

  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
    Endereço
    <span className="ml-1 font-medium text-gray-400 dark:text-gray-500">
      (opcional)
    </span>
  </label>

  <input
    type="text"
    value={editTourAddress}
    onFocus={() => {
      setActiveAddressField(
        "editTourAddress"
      );

      setAddressSearchQuery(
        editTourAddress
      );
    }}
    onChange={(event) =>
      handleAddressChange(
        "editTourAddress",
        event.target.value
      )
    }
    disabled={updating}
    placeholder="Ex.: Av. Atlântica, 1702 - Copacabana"
    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
  />

  {activeAddressField ===
    "editTourAddress" &&
    (
      savedAddressesLoading ||
      savedAddresses.length > 0
    ) && (
      <div className="absolute left-0 right-0 top-full z-[1000] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">

        {savedAddressesLoading && (
          <div className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
            Buscando endereços...
          </div>
        )}

        {!savedAddressesLoading &&
          savedAddresses.map(
            (savedAddress) => (
              <div
                key={
                  savedAddress.id
                }
                className="flex items-center gap-2 border-b border-gray-100 last:border-b-0 dark:border-gray-800"
              >

                <button
                  type="button"
                  onMouseDown={(
                    event
                  ) => {
                    event.preventDefault();

                    selectSavedAddress(
                      "editTourAddress",
                      savedAddress
                    );
                  }}
                  className="min-w-0 flex-1 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
                >

                  <div className="flex items-start gap-3">

                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1687d9] text-sm">
                      🏨
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                        {savedAddress.name}
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs font-medium text-gray-500 dark:text-gray-300">
                        {savedAddress.address}
                      </p>

                    </div>

                  </div>

                </button>

                {!savedAddress.is_preloaded && (
                  <button
                    type="button"
                    onMouseDown={(
                      event
                    ) => {
                      event.preventDefault();

                      deleteSavedAddress(
                        savedAddress
                      );
                    }}
                    className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 transition duration-150 hover:bg-red-100 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    title="Excluir endereço"
                    aria-label="Excluir endereço"
                 >
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="h-5 w-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 6h18"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 6V4h8v2"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 6l-1 14H6L5 6"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 11v5M14 11v5"
    />
  </svg>
</button>
                )}

              </div>
            )
          )}

      </div>
    )}

</div>


                {/* COR */}

                <div>

                  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
                    Cor do evento
                  </label>

                  <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">

                    {GOOGLE_EVENT_COLORS.map(
                      (color) => (
                        <button
                          key={
                            color.id
                          }
                          type="button"
                          disabled={
                            updating
                          }
                          onClick={() =>
                            setEditTourColorId(
                              color.id
                            )
                          }
                          title={
                            color.name
                          }
                          className={[
                            "relative flex h-11 items-center justify-center rounded-xl border-2 transition",
                            color.className,
                            editTourColorId ===
                            color.id
                              ? "border-gray-900 ring-4 ring-gray-200"
                              : "border-transparent hover:scale-105",
                          ].join(
                            " "
                          )}
                        >

                          {editTourColorId ===
                            color.id && (
                            <span className="text-lg font-black text-white drop-shadow">
                              ✓
                            </span>
                          )}

                        </button>
                      )
                    )}

                  </div>

                  <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-300">
                    Cor selecionada:{" "}
                    <strong>
                      {
                        getColorName(
                          editTourColorId
                        )
                      }
                    </strong>
                  </p>

                </div>



                {/* DIA INTEIRO */}

                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-900 p-4">

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

                    <span className="block text-sm font-extrabold text-gray-800 dark:text-gray-100">
                      Dia inteiro
                    </span>

                  </span>

                </label>

                {/* HORÁRIOS */}

                {!editTourAllDay && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <div>

                      <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
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
                        className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
                      />

                    </div>

                    <div>

                      <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
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

<div
  className="relative"
  data-google-contact-autocomplete
>

  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
    E-mail adicional
    <span className="ml-1 font-medium text-gray-400 dark:text-gray-500">
      (opcional)
    </span>
  </label>

  <input
    type="email"
    value={
      editTourAdditionalEmail
    }
    onFocus={() => {
      setActiveContactField(
        "editTourAdditionalEmail"
      );

      setContactSearchQuery(
        editTourAdditionalEmail
      );
    }}
    onChange={(
      event
    ) =>
      handleAdditionalEmailChange(
        "editTourAdditionalEmail",
        event.target.value
      )
    }
    disabled={
      updating
    }
    placeholder="cliente@email.com"
    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
  />

  {activeContactField ===
    "editTourAdditionalEmail" &&
    (
      googleContactsLoading ||
      googleContacts.length > 0
    ) && (
      <div className="absolute left-0 right-0 top-full z-[1000] mt-2 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">

        {googleContactsLoading && (
          <div className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
            Buscando contatos...
          </div>
        )}

        {!googleContactsLoading &&
          googleContacts.map(
            (contact) => (
              <button
                key={`${contact.email}-${contact.name}`}
                type="button"
                onMouseDown={(
                  event
                ) => {
                  event.preventDefault();

                  selectGoogleContact(
                    "editTourAdditionalEmail",
                    contact
                  );
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >

               <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1687d9] text-sm font-extrabold text-white">
  {contact.photo ? (
    <img
      src={contact.photo}
      alt=""
      className="h-full w-full object-cover"
    />
  ) : (
    contact.name
      ? contact.name
          .charAt(0)
          .toUpperCase()
      : "@"
  )}
</div>

                <div className="min-w-0">

                  <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                    {contact.name ||
                      "Contato"}
                  </p>

                  <p className="truncate text-xs text-gray-500 dark:text-gray-300">
                    {contact.email}
                  </p>

                </div>

              </button>
            )
          )}

      </div>
    )}

</div>


{/* EMAIL ADICIONAL 2 */}

<div
  className="relative mt-4"
  data-google-contact-autocomplete
>

  <label className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
    E-mail adicional 2
    <span className="ml-1 font-medium text-gray-400 dark:text-gray-500">
      (opcional)
    </span>
  </label>

  <input
    type="email"
    value={
      editTourAdditionalEmail2
    }
    onFocus={() => {
      setActiveContactField(
        "editTourAdditionalEmail2"
      );

      setContactSearchQuery(
        editTourAdditionalEmail2
      );
    }}
    onChange={(
      event
    ) =>
      handleAdditionalEmailChange(
        "editTourAdditionalEmail2",
        event.target.value
      )
    }
    disabled={
      updating
    }
    placeholder="cliente2@email.com"
    className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#1687d9] dark:border-gray-700 dark:bg-black dark:text-gray-100 dark:placeholder:text-gray-500"
  />

  {activeContactField ===
    "editTourAdditionalEmail2" &&
    (
      googleContactsLoading ||
      googleContacts.length > 0
    ) && (
      <div className="absolute left-0 right-0 top-full z-[1000] mt-2 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">

        {googleContactsLoading && (
          <div className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-300">
            Buscando contatos...
          </div>
        )}

        {!googleContactsLoading &&
          googleContacts.map(
            (contact) => (
              <button
                key={`${contact.email}-${contact.name}`}
                type="button"
                onMouseDown={(
                  event
                ) => {
                  event.preventDefault();

                  selectGoogleContact(
                    "editTourAdditionalEmail2",
                    contact
                  );
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >

               <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1687d9] text-sm font-extrabold text-white">
  {contact.photo ? (
    <img
      src={contact.photo}
      alt=""
      className="h-full w-full object-cover"
    />
  ) : (
    contact.name
      ? contact.name
          .charAt(0)
          .toUpperCase()
      : "@"
  )}
</div>

                <div className="min-w-0">

                  <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                    {contact.name ||
                      "Contato"}
                  </p>

                  <p className="truncate text-xs text-gray-500 dark:text-gray-300">
                    {contact.email}
                  </p>

                </div>

              </button>
            )
          )}

      </div>
    )}

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
                    className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-extrabold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
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

                             </div>,
        document.body
      )
    }

    </div>
  );
}