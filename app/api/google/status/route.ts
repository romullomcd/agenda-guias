import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const authorization =
      request.headers.get("authorization");

    console.log(
      "🔐 STATUS GOOGLE - AUTH:",
      authorization ? "SIM" : "NÃO"
    );

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          connected: false,
          error: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.replace("Bearer ", "");

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

    if (authError || !user) {
      console.error(
        "❌ STATUS GOOGLE - ERRO AUTH:",
        authError
      );

      return NextResponse.json(
        {
          connected: false,
          error: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    // ==========================================================
    // BUSCAR CONEXÃO GOOGLE
    // ==========================================================

    const {
      data: tokenData,
      error: tokenError,
    } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select(
        "user_id, has_access_token, has_refresh_token, expiry_date"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (tokenError) {
      console.error(
        "❌ ERRO AO VERIFICAR GOOGLE:",
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

    const connected =
      !!tokenData &&
      tokenData.has_access_token === true &&
      tokenData.has_refresh_token === true;

    console.log(
      "📅 GOOGLE CONECTADO:",
      connected
    );

    return NextResponse.json({
      connected,
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