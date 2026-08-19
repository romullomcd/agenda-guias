import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          error:
            "GOOGLE_CLIENT_ID ou GOOGLE_REDIRECT_URI não configurado.",
        },
        { status: 500 }
      );
    }

    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
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
      error,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (error || !user) {
      console.error(
        "ERRO AO VALIDAR USUÁRIO:",
        error
      );

      return NextResponse.json(
        {
          error: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope:
        "https://www.googleapis.com/auth/calendar.events",
      state: user.id,
    });

    const googleUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.redirect(
      googleUrl
    );
  } catch (error) {
    console.error(
      "ERRO AO INICIAR GOOGLE OAUTH:",
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