import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    console.log("==========================================");
    console.log("🔵 INICIANDO GOOGLE OAUTH");
    console.log("==========================================");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error(
        "❌ GOOGLE_CLIENT_ID OU GOOGLE_REDIRECT_URI NÃO CONFIGURADO"
      );

      return NextResponse.json(
        {
          error:
            "GOOGLE_CLIENT_ID ou GOOGLE_REDIRECT_URI não configurado.",
        },
        { status: 500 }
      );
    }

    console.log("✅ GOOGLE_CLIENT_ID ENCONTRADO");
    console.log(
      "🔗 GOOGLE_REDIRECT_URI:",
      redirectUri
    );

    // ============================================================
    // AUTHORIZATION
    // ============================================================

    const authorization =
      request.headers.get("authorization");

    console.log(
      "🔐 AUTHORIZATION RECEBIDO:",
      authorization ? "SIM" : "NÃO"
    );

    if (!authorization?.startsWith("Bearer ")) {
      console.error(
        "❌ HEADER AUTHORIZATION NÃO ENCONTRADO"
      );

      return NextResponse.json(
        {
          error: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.substring(7);

    console.log(
      "🔑 ACCESS TOKEN RECEBIDO:",
      accessToken ? "SIM" : "NÃO"
    );

    // ============================================================
    // VALIDAR USUÁRIO
    // ============================================================

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    console.log(
      "👤 USUÁRIO VALIDADO:",
      user?.id || null
    );

    if (userError) {
      console.error(
        "❌ ERRO AO VALIDAR USUÁRIO:",
        userError
      );
    }

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    // ============================================================
    // GERAR URL DO GOOGLE
    // ============================================================

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope:
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/contacts.other.readonly",
      state: user.id,
    });

    const googleUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    console.log(
      "✅ URL DO GOOGLE GERADA"
    );

    console.log(
      "🔵 REDIRECT:",
      redirectUri
    );

    return NextResponse.json({
      success: true,
      url: googleUrl,
    });
  } catch (error) {
    console.error(
      "❌ ERRO AO INICIAR GOOGLE OAUTH:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível iniciar a autorização do Google Calendar.",
      },
      { status: 500 }
    );
  }
}