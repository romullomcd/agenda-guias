import { NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

/* ============================================================
TIPOS
============================================================ */

type CalendarAction =
  | "create"
  | "update"
  | "delete";

type CalendarRequest = {
  action: CalendarAction;

  eventId?: string | null;

  date?: string;
  endDate?: string;
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
};

/* ============================================================
SANITIZAR HTML
============================================================ */

function sanitizeDescriptionHtml(
  html:
    | string
    | null
    | undefined
) {
  if (!html) {
    return "";
  }

  return html
    .replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    )
    .replace(
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      ""
    )
    .replace(
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      ""
    )
    .replace(
      /<embed\b[^>]*>/gi,
      ""
    )
    .replace(
      /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi,
      ""
    )
    .replace(
      /\s+(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi,
      ""
    )
    .trim();
}

/* ============================================================
AUTENTICAR USUÁRIO
============================================================ */

async function getAuthenticatedUser(
  request: Request
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    return {
      user: null,
      error:
        "Usuário não autenticado.",
    };
  }

  const accessToken =
    authorization.substring(7);

  const supabase =
    createClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser(
      accessToken
    );

  if (
    error ||
    !user
  ) {
    console.error(
      "❌ GOOGLE CALENDAR - ERRO AUTH:",
      error
    );

    return {
      user: null,
      error:
        "Usuário não autenticado.",
    };
  }

  return {
    user,
    error: null,
  };
}

/* ============================================================
CLIENT GOOGLE
============================================================ */

async function getGoogleCalendarClient(
  userId: string
) {
  const clientId =
    process.env
      .GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env
      .GOOGLE_CLIENT_SECRET;

  const redirectUri =
    process.env
      .GOOGLE_REDIRECT_URI;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    throw new Error(
      "Credenciais do Google não configuradas."
    );
  }

  const {
    data: tokenData,
    error: tokenError,
  } =
    await supabaseAdmin
      .from(
        "google_calendar_tokens"
      )
      .select(
        "user_id, access_token, refresh_token, expiry_date"
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  if (tokenError) {
    console.error(
      "❌ ERRO AO BUSCAR TOKENS GOOGLE:",
      tokenError
    );

    throw new Error(
      "Não foi possível buscar a conexão com o Google."
    );
  }

  if (
    !tokenData?.refresh_token
  ) {
    throw new Error(
      "O administrador não possui conexão ativa com o Google Calendar."
    );
  }

  const oauth2Client =
    new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

  oauth2Client.setCredentials(
    {
      access_token:
        tokenData.access_token ||
        undefined,

      refresh_token:
        tokenData.refresh_token,

      expiry_date:
        tokenData.expiry_date ||
        undefined,
    }
  );

  return oauth2Client;
}

/* ============================================================
VALIDAR COR
============================================================ */

function normalizeColorId(
  colorId:
    | string
    | null
    | undefined
) {
  if (!colorId) {
    return undefined;
  }

  const allowedColors =
    new Set([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
    ]);

  return allowedColors.has(
    colorId
  )
    ? colorId
    : undefined;
}

/* ============================================================
VALIDAR HORÁRIO
============================================================ */

function isValidTime(
  time:
    | string
    | null
    | undefined
) {
  if (!time) {
    return false;
  }

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    time
  );
}

function isEndAfterStart(
  startTime: string,
  endTime: string
) {
  return (
    startTime <
    endTime
  );
}

/* ============================================================
MONTAR EVENTO GOOGLE
============================================================ */

function buildGoogleEvent(
  data: CalendarRequest
) {
  if (!data.date) {
    throw new Error(
      "Data do evento não informada."
    );
  }

  if (
    !data.title?.trim()
  ) {
    throw new Error(
      "Título do evento não informado."
    );
  }

  const sanitizedDescription =
    sanitizeDescriptionHtml(
      data.description
    );

  const normalizedColorId =
    normalizeColorId(
      data.colorId
    );

  const event: any = {
    summary:
      data.title.trim(),

    description:
      sanitizedDescription ||
      undefined,

    location:
      data.address?.trim() ||
      undefined,

    colorId:
      normalizedColorId,
  };

  /* ==========================================================
  CONVIDADOS
  ========================================================== */

const emails = [
  data.guideEmail?.trim(),
  data.additionalEmail?.trim(),
  data.additionalEmail2?.trim(),
].filter(

    (
      email
    ): email is string =>
      !!email
  );

  const uniqueEmails = [
    ...new Set(emails),
  ];

  event.attendees =
    uniqueEmails.map(
      (email) => ({
        email,
      })
    );

    /* ==========================================================
  DIA INTEIRO
  ========================================================== */

  if (
    data.allDay !== false
  ) {
    const finalDate =
      data.endDate ||
      data.date;

    const endDateExclusive =
      new Date(
        `${finalDate}T00:00:00`
      );

    endDateExclusive.setDate(
      endDateExclusive.getDate() +
        1
    );

    event.start = {
      date:
        data.date,
    };

    event.end = {
      date:
        endDateExclusive
          .toISOString()
          .split("T")[0],
    };
  }

  /* ==========================================================
  EVENTO COM HORÁRIO
  ========================================================== */

   else {
    if (
      !isValidTime(
        data.startTime
      ) ||
      !isValidTime(
        data.endTime
      )
    ) {
      throw new Error(
        "Informe um horÃ¡rio de inÃ­cio e tÃ©rmino vÃ¡lidos."
      );
    }

    const startTime =
      data.startTime!;

    const endTime =
      data.endTime!;

    const finalDate =
      data.endDate ||
      data.date;

    if (
      finalDate === data.date &&
      !isEndAfterStart(
        startTime,
        endTime
      )
    ) {
      throw new Error(
        "O horÃ¡rio de tÃ©rmino precisa ser maior que o horÃ¡rio de inÃ­cio."
      );
    }

    event.start = {
      dateTime:
        `${data.date}T${startTime}:00`,

      timeZone:
        "America/Sao_Paulo",
    };

    event.end = {
      dateTime:
        `${finalDate}T${endTime}:00`,

      timeZone:
        "America/Sao_Paulo",
    };
  }

  console.log(
    "📝 DESCRIÇÃO:",
    event.description ||
      "(sem descrição)"
  );

  console.log(
    "🎨 COLOR ID:",
    normalizedColorId ||
      "(padrão)"
  );

  console.log(
    "📅 DIA TODO:",
    data.allDay !== false
  );

  if (
    data.allDay === false
  ) {
    console.log(
      "⏰ INÍCIO:",
      data.startTime
    );

    console.log(
      "⏰ FIM:",
      data.endTime
    );
  }

  return event;
}

/* ============================================================
CRIAR
============================================================ */

async function createGoogleEvent(
  calendar: any,
  data: CalendarRequest
) {
  const event =
    buildGoogleEvent(
      data
    );

  console.log(
    "📅 CRIANDO EVENTO NO GOOGLE CALENDAR"
  );

  console.log(
    "📧 GUIA:",
    data.guideEmail ||
      null
  );

  console.log(
    "📧 ADICIONAL:",
    data.additionalEmail ||
      null
  );

  const response =
    await calendar.events.insert(
      {
        calendarId:
          "primary",

        requestBody:
          event,

        sendUpdates:
          "all",
      }
    );

  return response.data;
}

/* ============================================================
ATUALIZAR
============================================================ */

async function updateGoogleEvent(
  calendar: any,
  data: CalendarRequest
) {
  if (!data.eventId) {
    throw new Error(
      "ID do evento Google não informado."
    );
  }

  const event =
    buildGoogleEvent(
      data
    );

  console.log(
    "✏️ ATUALIZANDO EVENTO GOOGLE:",
    data.eventId
  );

  const response =
    await calendar.events.update(
      {
        calendarId:
          "primary",

        eventId:
          data.eventId,

        requestBody:
          event,

        sendUpdates:
          "all",
      }
    );

  return response.data;
}

/* ============================================================
EXCLUIR
============================================================ */

async function deleteGoogleEvent(
  calendar: any,
  eventId: string
) {
  try {
    const existingEvent =
      await calendar.events.get(
        {
          calendarId:
            "primary",

          eventId:
            eventId,
        }
      );

    console.log(
      "✅ EVENTO ENCONTRADO:",
      {
        id:
          existingEvent.data.id,

        summary:
          existingEvent.data.summary,

        status:
          existingEvent.data.status,

        htmlLink:
          existingEvent.data.htmlLink,
      }
    );

    await calendar.events.delete(
      {
        calendarId:
          "primary",

        eventId:
          eventId,

        sendUpdates:
          "all",
      }
    );

    console.log(
      "✅ EVENTO REMOVIDO DO GOOGLE"
    );

    return true;
  } catch (
    error: any
  ) {
    console.error(
      "❌ ERRO AO EXCLUIR EVENTO GOOGLE:",
      error?.response?.data ||
        error?.message ||
        error
    );

    throw error;
  }
}

/* ============================================================
POST
============================================================ */

export async function POST(
  request: Request
) {
  try {
    const {
      user,
      error: authError,
    } =
      await getAuthenticatedUser(
        request
      );

    if (!user) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            authError ||
            "Usuário não autenticado.",
        },
        {
          status:
            401,
        }
      );
    }

    const body =
      (await request.json()) as CalendarRequest;

    console.log(
      "📅 GOOGLE CALENDAR API"
    );

    console.log(
      "👤 USUÁRIO:",
      user.id
    );

    console.log(
      "🔎 AÇÃO:",
      body.action
    );

    console.log(
      "🎨 COLOR:",
      body.colorId ||
        "(padrão)"
    );

    console.log(
      "📅 DIA TODO:",
      body.allDay
    );

    console.log(
      "⏰ INÍCIO:",
      body.startTime ||
        null
    );

    console.log(
      "⏰ FIM:",
      body.endTime ||
        null
    );

    if (
      ![
        "create",
        "update",
        "delete",
      ].includes(
        body.action
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Ação inválida.",
        },
        {
          status:
            400,
        }
      );
    }

    const auth =
      await getGoogleCalendarClient(
        user.id
      );

    const calendar =
      google.calendar(
        {
          version:
            "v3",

          auth,
        }
      );

    /* CREATE */

    if (
      body.action ===
      "create"
    ) {
      const event =
        await createGoogleEvent(
          calendar,
          body
        );

      return NextResponse.json(
        {
          success:
            true,

          action:
            "create",

          eventId:
            event.id ||
            null,

          event,
        }
      );
    }

    /* UPDATE */

    if (
      body.action ===
      "update"
    ) {
      const event =
        await updateGoogleEvent(
          calendar,
          body
        );

      return NextResponse.json(
        {
          success:
            true,

          action:
            "update",

          eventId:
            event.id ||
            null,

          event,
        }
      );
    }

    /* DELETE */

    if (
      body.action ===
      "delete"
    ) {
      if (!body.eventId) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "ID do evento Google não informado.",
          },
          {
            status:
              400,
          }
        );
      }

      await deleteGoogleEvent(
        calendar,
        body.eventId
      );

      return NextResponse.json(
        {
          success:
            true,

          action:
            "delete",

          eventId:
            body.eventId,
        }
      );
    }

    return NextResponse.json(
      {
        success:
          false,

        error:
          "Ação inválida.",
      },
      {
        status:
          400,
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "❌ ERRO GOOGLE CALENDAR API:",
      error
    );

    const googleMessage =
      error?.response
        ?.data
        ?.error
        ?.message;

    return NextResponse.json(
      {
        success:
          false,

        error:
          googleMessage ||
          error?.message ||
          "Não foi possível realizar a operação no Google Calendar.",
      },
      {
        status:
          500,
      }
    );
  }
}