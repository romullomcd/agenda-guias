import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: Request) {
  try {
    // Verifica o token do administrador
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sessão inválida." },
        { status: 401 }
      );
    }

    // Verifica se quem está fazendo a alteração é administrador
    const { data: adminProfile, error: adminError } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (adminError || !adminProfile) {
      console.error("ERRO AO BUSCAR ADMIN:", adminError);

      return NextResponse.json(
        { error: "Não foi possível verificar o administrador." },
        { status: 403 }
      );
    }

    if (adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem editar guias." },
        { status: 403 }
      );
    }

    // Dados recebidos
    const body = await request.json();

const guideId = String(body.guideId || "").trim();
const name = String(body.name || "").trim();
const email = String(body.email || "").trim();
const phone = String(body.phone || "").trim();
const password = String(body.password || "");

const languages = Array.isArray(body.languages)
  ? body.languages
  : [];

    if (!guideId) {
      return NextResponse.json(
        { error: "ID do guia não informado." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "O nome é obrigatório." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "O e-mail é obrigatório." },
        { status: 400 }
      );
    }

    if (languages.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um idioma." },
        { status: 400 }
      );
    }

    // Confirma que o usuário existe no Auth
    const {
      data: { user: guideUser },
      error: guideUserError,
    } = await supabaseAdmin.auth.admin.getUserById(guideId);

    if (guideUserError || !guideUser) {
      return NextResponse.json(
        { error: "Usuário do guia não encontrado." },
        { status: 404 }
      );
    }

    // Atualiza e-mail e/ou senha no Supabase Auth
    const authUpdates: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
    } = {};

    if (email !== guideUser.email) {
      authUpdates.email = email;
      authUpdates.email_confirm = true;
    }

    if (password.length > 0) {
      if (password.length < 6) {
        return NextResponse.json(
          {
            error:
              "A nova senha precisa ter pelo menos 6 caracteres.",
          },
          { status: 400 }
        );
      }

      authUpdates.password = password;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(
          guideId,
          authUpdates
        );

      if (authUpdateError) {
        console.error(
          "ERRO AO ATUALIZAR AUTH:",
          authUpdateError
        );

        return NextResponse.json(
          { error: authUpdateError.message },
          { status: 400 }
        );
      }
    }

    // Atualiza os dados do perfil
    const { data: updatedProfile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .update({
          name,
  phone,
          languages,
        })
        .eq("id", guideId)
        .eq("role", "guide")
        .select("id, name, role, active, languages, phone")
        .single();

    if (profileError) {
      console.error(
        "ERRO AO ATUALIZAR PERFIL:",
        profileError
      );

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      guide: updatedProfile,
    });
  } catch (error) {
    console.error("ERRO INTERNO:", error);

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}