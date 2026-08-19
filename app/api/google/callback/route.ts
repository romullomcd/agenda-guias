import { NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      return NextResponse.json(
        {
          error: "Código de autorização não recebido.",
        },
        { status: 400 }
      );
    }

    if (!state) {
      return NextResponse.json(
        {
          error: "Usuário não identificado.",
        },
        { status: 400 }
      );
    }

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
        { status: 500 }
      );
    }

    const oauth2Client =
      new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

    const { tokens } =
      await oauth2Client.getToken(code);

    console.log(
      "GOOGLE TOKENS RECEBIDOS:",
      {
        hasAccessToken:
          !!tokens.access_token,
        hasRefreshToken:
          !!tokens.refresh_token,
        expiryDate:
          tokens.expiry_date || null,
      }
    );

    if (
      !tokens.access_token &&
      !tokens.refresh_token
    ) {
      return NextResponse.json(
        {
          error:
            "O Google não retornou os tokens necessários.",
        },
        { status: 500 }
      );
    }

    /*
     * Se o Google não retornar um novo refresh_token,
     * mantemos o que já estiver salvo.
     */
    const {
      data: existingToken,
      error: existingError,
    } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select(
        "id, refresh_token"
      )
      .eq(
        "user_id",
        state
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "ERRO AO BUSCAR TOKEN EXISTENTE:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível verificar a conexão existente.",
        },
        { status: 500 }
      );
    }

    const refreshToken =
      tokens.refresh_token ||
      existingToken?.refresh_token ||
      null;

    /*
     * Precisamos ter refresh_token para conseguir
     * renovar o acesso futuramente.
     */
    if (!refreshToken) {
      return NextResponse.json(
        {
          error:
            "O Google não forneceu um refresh token.",
        },
        { status: 500 }
      );
    }

    const tokenData = {
      user_id: state,
      access_token:
        tokens.access_token || "",
      refresh_token:
        refreshToken,
      expiry_date:
        tokens.expiry_date || null,
      updated_at:
        new Date().toISOString(),
    };

    let saveError;

    if (existingToken) {
      const result =
        await supabaseAdmin
          .from(
            "google_calendar_tokens"
          )
          .update({
            access_token:
              tokenData.access_token,
            refresh_token:
              tokenData.refresh_token,
            expiry_date:
              tokenData.expiry_date,
            updated_at:
              tokenData.updated_at,
          })
          .eq(
            "user_id",
            state
          );

      saveError = result.error;
    } else {
      const result =
        await supabaseAdmin
          .from(
            "google_calendar_tokens"
          )
          .insert(
            tokenData
          );

      saveError = result.error;
    }

    if (saveError) {
      console.error(
        "ERRO AO SALVAR TOKEN DO GOOGLE:",
        saveError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível salvar a autorização do Google Calendar.",
        },
        { status: 500 }
      );
    }

    console.log(
      "✅ GOOGLE CALENDAR AUTORIZADO E TOKEN SALVO:",
      state
    );

    /*
     * Volta para o Dashboard em vez de mostrar
     * o JSON do callback.
     */
    return NextResponse.redirect(
      new URL(
        "/dashboard?google=success",
        request.url
      )
    );
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