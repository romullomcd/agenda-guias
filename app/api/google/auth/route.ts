import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const clientId =
      process.env.GOOGLE_CLIENT_ID;

    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !clientId ||
      !redirectUri
    ) {
      return NextResponse.json(
        {
          error:
            "Configurações necessárias não encontradas.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey
    );

    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    const token =
      authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json(
        {
          error:
            "Sessão do usuário inválida.",
        },
        { status: 401 }
      );
    }

    const state = crypto.randomBytes(32).toString("hex");

    const response = NextResponse.redirect(
      "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          access_type: "offline",
          prompt: "consent",
          scope:
            "https://www.googleapis.com/auth/calendar.events",
          state,
        }).toString()
    );

    response.cookies.set(
      "google_oauth_state",
      JSON.stringify({
        state,
        userId: user.id,
      }),
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      }
    );

    return response;
  } catch (error) {
    console.error(
      "ERRO AO INICIAR GOOGLE OAUTH:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível iniciar a autorização do Google.",
      },
      { status: 500 }
    );
  }
}