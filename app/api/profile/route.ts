
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// VERIFICA USUÁRIO LOGADO
// ============================================

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      user: null,
      error: "Não autenticado.",
      status: 401,
    };
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    console.error("AUTH ERROR:", error);

    return {
      user: null,
      error: "Sessão inválida.",
      status: 401,
    };
  }

  return {
    user,
    error: null,
    status: 200,
  };
}

// ============================================
// GET — BUSCAR MEU PERFIL
// ============================================

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const user = auth.user;

    // Busca o perfil do próprio usuário
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, name, role, phone, languages, pix_key"
        )
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      console.error(
        "PROFILE ERROR:",
        profileError
      );

      return NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      name: profile.name || "",
      email: user.email || "",
      role: profile.role,
      phone: profile.phone || "",
      languages: profile.languages || [],
      pix_key: profile.pix_key || "",
    });
  } catch (error) {
    console.error(
      "ERRO AO BUSCAR PERFIL:",
      error
    );

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH — ALTERAR MEU PERFIL
// ============================================

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const user = auth.user;

    const body = await request.json();

    const password = String(
      body.password || ""
    );

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const pixKey =
      typeof body.pix_key === "string"
        ? body.pix_key.trim()
        : "";

    const languages = Array.isArray(
      body.languages
    )
      ? body.languages.map((language: unknown) =>
          String(language)
        )
      : [];

    // ==========================================
    // BUSCA O ROLE DO USUÁRIO
    // ==========================================

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      console.error(
        "PROFILE ERROR:",
        profileError
      );

      return NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 404 }
      );
    }

    // ==========================================
    // SENHA
    // ==========================================

    if (password.length > 0) {
      if (password.length < 6) {
        return NextResponse.json(
          {
            error:
              "A senha precisa ter pelo menos 6 caracteres.",
          },
          { status: 400 }
        );
      }

      const { error: passwordError } =
        await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          {
            password,
          }
        );

      if (passwordError) {
        console.error(
          "ERRO AO ALTERAR SENHA:",
          passwordError
        );

        return NextResponse.json(
          {
            error:
              passwordError.message,
          },
          { status: 400 }
        );
      }
    }

    // ==========================================
    // ADMIN
    // ==========================================

    if (profile.role === "admin") {
      // Admin só pode alterar a própria senha.
      // Nenhum campo de telefone, PIX ou idioma
      // é alterado para administrador.

      return NextResponse.json({
        success: true,
        message:
          password.length > 0
            ? "Senha alterada com sucesso!"
            : "Perfil atualizado com sucesso!",
      });
    }

    // ==========================================
    // GUIA
    // ==========================================

    if (profile.role === "guide") {
      if (languages.length === 0) {
        return NextResponse.json(
          {
            error:
              "Selecione pelo menos um idioma.",
          },
          { status: 400 }
        );
      }

      const { error: updateError } =
        await supabaseAdmin
          .from("profiles")
          .update({
            phone,
            pix_key: pixKey,
            languages,
          })
          .eq("id", user.id)
          .eq("role", "guide");

      if (updateError) {
        console.error(
          "ERRO AO ATUALIZAR GUIA:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              updateError.message,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          password.length > 0
            ? "Perfil e senha atualizados com sucesso!"
            : "Perfil atualizado com sucesso!",
      });
    }

    // ==========================================
    // ROLE INVÁLIDO
    // ==========================================

    return NextResponse.json(
      {
        error:
          "Tipo de usuário não permitido.",
      },
      { status: 403 }
    );
  } catch (error) {
    console.error(
      "ERRO AO ATUALIZAR PERFIL:",
      error
    );

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

