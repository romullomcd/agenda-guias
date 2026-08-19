import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    console.log("==========================================");
    console.log("🔎 VERIFICANDO STATUS GOOGLE CALENDAR");
    console.log("==========================================");

    // ==========================================================
    // AUTHORIZATION
    // ==========================================================

    const authorization =
      request.headers.get("authorization");

    console.log(
      "🔐 STATUS GOOGLE - AUTH:",
      authorization ? "SIM" : "NÃO"
    );

    if (!authorization?.startsWith("Bearer ")) {
      console.error(
        "❌ STATUS GOOGLE - AUTHORIZATION NÃO ENCONTRADO"
      );

      return NextResponse.json(
        {
          connected: false,
          error: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.substring(7);

    // ==========================================================
    // VALIDAR USUÁRIO SUPABASE
    // ==========================================================

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(
      accessToken
    );

    console.log(
      "👤 STATUS GOOGLE - USUÁRIO:",
      user?.id || null
    );

    if (authError) {
      console.error(
        "❌ STATUS GOOGLE - ERRO AUTH:",
        authError
      );
    }

    if (authError || !user) {
      return NextResponse.json(
        {
          connected: false,
          error: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    // ==========================================================
    // BUSCAR TOKEN DO GOOGLE
    // ==========================================================

    const {
      data: tokenData,
      error: tokenError,
    } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select(
        "user_id, access_token, refresh_token, expiry_date"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (tokenError) {
      console.error(
        "❌ ERRO AO BUSCAR CONEXÃO GOOGLE:",
        tokenError
      );

      return NextResponse.json(
        {
          connected: false,
          error:
            "Não foi possível verificar a conexão com o Google.",
        },
        { status: 500 }
      );
    }

    // ==========================================================
    // VERIFICAR SE REALMENTE EXISTE TOKEN
    // ==========================================================

    const hasAccessToken =
      !!tokenData?.access_token;

    const hasRefreshToken =
      !!tokenData?.refresh_token;

    const connected =
      hasAccessToken &&
      hasRefreshToken;

    console.log(
      "🔑 TEM ACCESS TOKEN:",
      hasAccessToken
    );

    console.log(
      "🔄 TEM REFRESH TOKEN:",
      hasRefreshToken
    );

    console.log(
      "📅 GOOGLE CONECTADO:",
      connected
    );

    return NextResponse.json({
      connected,
      hasAccessToken,
      hasRefreshToken,
      expiryDate:
        tokenData?.expiry_date || null,
    });

  } catch (error) {
    console.error(
      "❌ ERRO INESPERADO AO VERIFICAR GOOGLE:",
      error
    );

    return NextResponse.json(
      {
        connected: false,
        error:
          "Não foi possível verificar a conexão com o Google.",
      },
      { status: 500 }
    );
  }
}