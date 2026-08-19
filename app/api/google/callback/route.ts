import { NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    console.log("==========================================");
    console.log("🔵 GOOGLE OAUTH CALLBACK");
    console.log("==========================================");

    const { searchParams } =
      new URL(request.url);

    const code =
      searchParams.get("code");

    const state =
      searchParams.get("state");

    console.log(
      "🔑 CODE RECEBIDO:",
      code ? "SIM" : "NÃO"
    );

    console.log(
      "👤 STATE RECEBIDO:",
      state || null
    );

    // ==========================================================
    // VALIDAR CODE
    // ==========================================================

    if (!code) {
      console.error(
        "❌ CÓDIGO DE AUTORIZAÇÃO NÃO RECEBIDO"
      );

      return NextResponse.json(
        {
          error:
            "Código de autorização não recebido.",
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // VALIDAR STATE
    // ==========================================================

    if (!state) {
      console.error(
        "❌ STATE NÃO RECEBIDO"
      );

      return NextResponse.json(
        {
          error:
            "Usuário não identificado.",
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // VARIÁVEIS GOOGLE
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
      console.error(
        "❌ CREDENCIAIS GOOGLE NÃO CONFIGURADAS"
      );

      return NextResponse.json(
        {
          error:
            "Credenciais do Google não configuradas.",
        },
        { status: 500 }
      );
    }

    console.log(
      "✅ CREDENCIAIS GOOGLE ENCONTRADAS"
    );

    console.log(
      "🔗 REDIRECT URI:",
      redirectUri
    );

    // ==========================================================
    // CRIAR CLIENT GOOGLE
    // ==========================================================

    const oauth2Client =
      new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

    // ==========================================================
    // TROCAR CODE POR TOKENS
    // ==========================================================

    console.log(
      "🔄 TROCANDO CODE POR TOKENS..."
    );

    const { tokens } =
      await oauth2Client.getToken(code);

    console.log(
      "✅ TOKENS RECEBIDOS DO GOOGLE:",
      {
        hasAccessToken:
          !!tokens.access_token,

        hasRefreshToken:
          !!tokens.refresh_token,

        expiryDate:
          tokens.expiry_date || null,
      }
    );

    // ==========================================================
    // BUSCAR TOKEN EXISTENTE
    // ==========================================================

    const {
      data: existingToken,
      error: existingError,
    } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select(
        "id, access_token, refresh_token, expiry_date"
      )
      .eq(
        "user_id",
        state
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "❌ ERRO AO BUSCAR TOKEN EXISTENTE:",
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

    console.log(
      "📦 TOKEN EXISTENTE:",
      existingToken
        ? "SIM"
        : "NÃO"
    );

    // ==========================================================
    // DEFINIR REFRESH TOKEN
    // ==========================================================

    const refreshToken =
      tokens.refresh_token ||
      existingToken?.refresh_token ||
      null;

    if (!refreshToken) {
      console.error(
        "❌ NENHUM REFRESH TOKEN DISPONÍVEL"
      );

      return NextResponse.json(
        {
          error:
            "O Google não forneceu um refresh token.",
        },
        { status: 500 }
      );
    }

    // ==========================================================
    // DEFINIR ACCESS TOKEN
    // ==========================================================

    const accessToken =
      tokens.access_token ||
      existingToken?.access_token ||
      null;

    if (!accessToken) {
      console.error(
        "❌ NENHUM ACCESS TOKEN DISPONÍVEL"
      );

      return NextResponse.json(
        {
          error:
            "O Google não forneceu um access token.",
        },
        { status: 500 }
      );
    }

    // ==========================================================
    // DADOS PARA SALVAR
    // ==========================================================

    const tokenData = {
      user_id: state,

      access_token:
        accessToken,

      refresh_token:
        refreshToken,

      expiry_date:
        tokens.expiry_date ||
        existingToken?.expiry_date ||
        null,

      updated_at:
        new Date().toISOString(),
    };

    console.log(
      "💾 SALVANDO TOKENS NO SUPABASE..."
    );

    // ==========================================================
    // ATUALIZAR OU INSERIR
    // ==========================================================

    let saveError;

    if (existingToken) {
      console.log(
        "✏️ ATUALIZANDO TOKEN EXISTENTE"
      );

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

      saveError =
        result.error;

    } else {
      console.log(
        "➕ CRIANDO NOVO TOKEN"
      );

      const result =
        await supabaseAdmin
          .from(
            "google_calendar_tokens"
          )
          .insert(
            tokenData
          );

      saveError =
        result.error;
    }

    // ==========================================================
    // VERIFICAR ERRO
    // ==========================================================

    if (saveError) {
      console.error(
        "❌ ERRO AO SALVAR TOKEN GOOGLE:",
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
      "=========================================="
    );

    console.log(
      "✅ GOOGLE CALENDAR CONECTADO COM SUCESSO"
    );

    console.log(
      "👤 USUÁRIO:",
      state
    );

    console.log(
      "=========================================="
    );

    // ==========================================================
    // VOLTAR PARA DASHBOARD
    // ==========================================================

    const dashboardUrl =
      new URL(
        "/dashboard",
        request.url
      );

    dashboardUrl.searchParams.set(
      "google",
      "success"
    );

    return NextResponse.redirect(
      dashboardUrl
    );

  } catch (error) {
    console.error(
      "=========================================="
    );

    console.error(
      "❌ ERRO NO CALLBACK DO GOOGLE"
    );

    console.error(
      error
    );

    console.error(
      "=========================================="
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