import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json(
        {
          error: "Código ou estado do Google não recebido.",
        },
        { status: 400 }
      );
    }

    const googleClientId =
      process.env.GOOGLE_CLIENT_ID;

    const googleClientSecret =
      process.env.GOOGLE_CLIENT_SECRET;

    const googleRedirectUri =
      process.env.GOOGLE_REDIRECT_URI;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !googleClientId ||
      !googleClientSecret ||
      !googleRedirectUri ||
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Configurações do Google ou Supabase não configuradas.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // RECUPERAR STATE DO COOKIE
    // ============================================================

    const cookieHeader =
      request.headers.get("cookie") || "";

    const stateCookie = cookieHeader
      .split(";")
      .map((item) => item.trim())
      .find((item) =>
        item.startsWith("google_oauth_state=")
      );

    if (!stateCookie) {
      return NextResponse.json(
        {
          error:
            "Sessão de autorização não encontrada.",
        },
        { status: 400 }
      );
    }

    const encodedState =
      stateCookie.substring(
        "google_oauth_state=".length
      );

    const savedState = JSON.parse(
      decodeURIComponent(encodedState)
    );

    if (
      !savedState ||
      savedState.state !== state ||
      !savedState.userId
    ) {
      return NextResponse.json(
        {
          error:
            "Estado de autorização inválido.",
        },
        { status: 400 }
      );
    }

    const userId =
      savedState.userId;

    // ============================================================
    // CLIENTE GOOGLE
    // ============================================================

    const oauth2Client =
      new google.auth.OAuth2(
        googleClientId,
        googleClientSecret,
        googleRedirectUri
      );

    const { tokens } =
      await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          error:
            "O Google não retornou um refresh token.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // CLIENTE ADMIN DO SUPABASE
    // ============================================================

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    // ============================================================
    // SALVAR TOKEN
    // ============================================================

    const { error: databaseError } =
      await supabaseAdmin
        .from("google_calendar_tokens")
        .upsert(
          {
            user_id: userId,
            access_token:
              tokens.access_token || "",
            refresh_token:
              tokens.refresh_token,
            expiry_date:
              tokens.expiry_date || null,
          },
          {
            onConflict:
              "user_id",
          }
        );

    if (databaseError) {
      console.error(
        "ERRO AO SALVAR TOKEN GOOGLE:",
        databaseError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível salvar a autorização do Google.",
          details:
            databaseError.message,
        },
        { status: 500 }
      );
    }

    // ============================================================
    // LIMPAR COOKIE E VOLTAR PARA O SITE
    // ============================================================

    const response =
      NextResponse.redirect(
        new URL(
          "/?google=success",
          request.url
        )
      );

    response.cookies.delete(
      "google_oauth_state"
    );

    return response;
  } catch (error) {
    console.error(
      "ERRO NO CALLBACK DO GOOGLE:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível concluir a autorização do Google Calendar.",
      },
      { status: 500 }
    );
  }
}