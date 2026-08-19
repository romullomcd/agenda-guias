import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        {
          error: "Código de autorização não recebido.",
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
      "GOOGLE TOKENS:",
      tokens
    );

    return NextResponse.json({
      success: true,
      message:
        "Google Calendar autorizado com sucesso.",
      hasAccessToken:
        !!tokens.access_token,
      hasRefreshToken:
        !!tokens.refresh_token,
    });
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