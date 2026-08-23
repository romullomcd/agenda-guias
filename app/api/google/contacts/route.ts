import { NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Contact = {
  name: string;
  email: string;
  photo: string | null;
};

function getFallbackName(
  email: string
) {
  const localPart =
    email.split("@")[0] || "";

  const cleaned =
    localPart
      .replace(/[._-]+/g, " ")
      .replace(/\d+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (!cleaned) {
    return "Contato";
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1).toLowerCase()
    )
    .join(" ");
}

function extractContacts(
  people: any[]
): Contact[] {
  const contacts: Contact[] = [];

  for (
    const person of people
  ) {
    const personName =
      person?.names?.[0]
        ?.displayName ||
      person?.names?.[0]
        ?.givenName ||
      "";

    const photo =
      person?.photos?.find(
        (item: any) =>
          item?.default !== true &&
          item?.url
      )?.url ||
      person?.photos?.[0]
        ?.url ||
      null;

    const emails =
      Array.isArray(
        person?.emailAddresses
      )
        ? person.emailAddresses
        : [];

    for (
      const emailData of emails
    ) {
      const email =
        emailData?.value
          ?.trim() || "";

      if (!email) {
        continue;
      }

      const emailDisplayName =
        emailData?.displayName
          ?.trim() || "";

      const name =
        personName ||
        emailDisplayName ||
        getFallbackName(
          email
        );

      contacts.push({
        name:
          name || "Contato",
        email,
        photo,
      });
    }
  }

  return contacts;
}

export async function GET(
  request: Request
) {
  try {
    console.log(
      "=========================================="
    );

    console.log(
      "📇 BUSCANDO CONTATOS GOOGLE"
    );

    console.log(
      "=========================================="
    );

    // ==========================================================
    // AUTORIZAÇÃO
    // ==========================================================

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization?.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Usuário não autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    const supabaseAccessToken =
      authorization.substring(7);

    // ==========================================================
    // VALIDAR USUÁRIO SUPABASE
    // ==========================================================

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        supabaseAccessToken
      );

    if (
      userError ||
      !user
    ) {
      console.error(
        "❌ USUÁRIO INVÁLIDO:",
        userError
      );

      return NextResponse.json(
        {
          error:
            "Usuário não autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================================
    // QUERY
    // ==========================================================

    const { searchParams } =
      new URL(request.url);

    const query =
      (
        searchParams.get(
          "q"
        ) || ""
      )
        .trim()
        .toLowerCase();

    if (
      query.length < 2
    ) {
      return NextResponse.json({
        contacts: [],
      });
    }

    // ==========================================================
    // TOKEN GOOGLE
    // ==========================================================

    const {
      data: googleToken,
      error: googleTokenError,
    } =
      await supabaseAdmin
        .from(
          "google_calendar_tokens"
        )
        .select(
          "access_token, refresh_token, expiry_date"
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      googleTokenError
    ) {
      console.error(
        "❌ ERRO AO BUSCAR TOKEN GOOGLE:",
        googleTokenError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível acessar a conexão com o Google.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !googleToken?.refresh_token
    ) {
      return NextResponse.json(
        {
          error:
            "A conta Google não está conectada.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // CREDENCIAIS GOOGLE
    // ==========================================================

    const clientId =
      process.env.GOOGLE_CLIENT_ID;

    const clientSecret =
      process.env.GOOGLE_CLIENT_SECRET;

    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI;

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      return NextResponse.json(
        {
          error:
            "Credenciais do Google não configuradas.",
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================================
    // OAUTH CLIENT
    // ==========================================================

    const oauth2Client =
      new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

    oauth2Client.setCredentials({
      access_token:
        googleToken.access_token ||
        undefined,

      refresh_token:
        googleToken.refresh_token,

      expiry_date:
        googleToken.expiry_date ||
        undefined,
    });

    // ==========================================================
    // ACCESS TOKEN VÁLIDO
    // ==========================================================

    const {
      token: accessToken,
    } =
      await oauth2Client.getAccessToken();

    if (!accessToken) {
      console.error(
        "❌ NÃO FOI POSSÍVEL OBTER ACCESS TOKEN GOOGLE"
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível autenticar com o Google.",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================================
    // RESULTADOS
    // ==========================================================

    const contacts: Contact[] =
      [];

    // ==========================================================
    // 1. MEUS CONTATOS
    // ==========================================================

    try {
      const contactsUrl =
        new URL(
          "https://people.googleapis.com/v1/people/me/connections"
        );

      contactsUrl.searchParams.set(
        "pageSize",
        "1000"
      );

      contactsUrl.searchParams.set(
        "personFields",
        "names,emailAddresses,photos,metadata"
      );

      const response =
        await fetch(
          contactsUrl.toString(),
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {
        console.error(
          "⚠️ ERRO AO BUSCAR MEUS CONTATOS:",
          JSON.stringify(
            data,
            null,
            2
          )
        );
      } else {
        const connections =
          Array.isArray(
            data?.connections
          )
            ? data.connections
            : [];

        const extracted =
          extractContacts(
            connections
          );

        contacts.push(
          ...extracted
        );

        console.log(
          "📇 MEUS CONTATOS:",
          extracted.length
        );
      }
    } catch (error) {
      console.error(
        "⚠️ ERRO AO PROCESSAR MEUS CONTATOS:",
        error
      );
    }

    // ==========================================================
    // 2. OUTROS CONTATOS
    // ==========================================================

    try {
      const otherContactsUrl =
        new URL(
          "https://people.googleapis.com/v1/otherContacts:search"
        );

      otherContactsUrl.searchParams.set(
        "query",
        query
      );

      otherContactsUrl.searchParams.set(
        "pageSize",
        "30"
      );

      otherContactsUrl.searchParams.set(
        "readMask",
        "names,emailAddresses,photos,metadata"
      );

      const response =
        await fetch(
          otherContactsUrl.toString(),
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {
        console.error(
          "⚠️ ERRO AO BUSCAR OUTROS CONTATOS:",
          JSON.stringify(
            data,
            null,
            2
          )
        );
      } else {
        const results =
          Array.isArray(
            data?.results
          )
            ? data.results
            : [];

        const people =
          results
            .map(
              (result: any) =>
                result?.person
            )
            .filter(
              Boolean
            );

        const extracted =
          extractContacts(
            people
          );

        contacts.push(
          ...extracted
        );

        console.log(
          "📇 OUTROS CONTATOS:",
          extracted.length
        );
      }
    } catch (error) {
      console.error(
        "⚠️ ERRO AO PROCESSAR OUTROS CONTATOS:",
        error
      );
    }

    // ==========================================================
    // FILTRAR
    // ==========================================================

    const filteredContacts =
      contacts.filter(
        (contact) => {
          const name =
            contact.name
              .toLowerCase();

          const email =
            contact.email
              .toLowerCase();

          return (
            name.includes(query) ||
            email.includes(query)
          );
        }
      );

    // ==========================================================
    // REMOVER DUPLICADOS
    // ==========================================================

    const uniqueContacts =
      Array.from(
        new Map(
          filteredContacts.map(
            (contact) => [
              contact.email
                .trim()
                .toLowerCase(),
              contact,
            ]
          )
        ).values()
      ).slice(
        0,
        10
      );

    console.log(
      "✅ CONTATOS ENCONTRADOS:",
      uniqueContacts.length
    );

    return NextResponse.json({
      contacts:
        uniqueContacts,
    });
  } catch (error) {
    console.error(
      "❌ ERRO AO BUSCAR CONTATOS GOOGLE:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Ocorreu um erro ao buscar os contatos do Google.",
      },
      {
        status: 500,
      }
    );
  }
}