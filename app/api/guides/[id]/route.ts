import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// VERIFICA ADMINISTRADOR
// ============================================

async function verifyAdmin(request: Request) {
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
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    console.error("AUTH ERROR:", authError);

    return {
      user: null,
      error: "Sessão inválida.",
      status: 401,
    };
  }

  const { data: adminProfile, error: adminError } =
    await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

  if (adminError || !adminProfile) {
    console.error("ADMIN PROFILE ERROR:", adminError);

    return {
      user: null,
      error: "Não foi possível verificar o administrador.",
      status: 403,
    };
  }

  if (adminProfile.role !== "admin") {
    return {
      user: null,
      error: "Apenas administradores podem realizar esta ação.",
      status: 403,
    };
  }

  return {
    user,
    error: null,
    status: 200,
  };
}

// ============================================
// GET — BUSCAR GUIA
// ============================================

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);

    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "ID do guia não informado." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, name, role, active, languages, phone"
        )
        .eq("id", id)
        .eq("role", "guide")
        .single();

    if (profileError || !profile) {
      console.error(
        "PROFILE ERROR:",
        profileError
      );

      return NextResponse.json(
        { error: "Guia não encontrado." },
        { status: 404 }
      );
    }

    const {
      data: { user: guideUser },
      error: guideError,
    } = await supabaseAdmin.auth.admin.getUserById(id);

    if (guideError || !guideUser) {
      console.error(
        "GUIDE USER ERROR:",
        guideError
      );

      return NextResponse.json(
        { error: "Usuário do guia não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: guideUser.email || "",
      role: profile.role,
      active: profile.active,
      languages: profile.languages || [],
      phone: profile.phone || "",
    });
  } catch (error) {
    console.error(
      "ERRO AO BUSCAR GUIA:",
      error
    );

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE — DELETAR GUIA
// ============================================

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // --------------------------------------------
    // VERIFICA ADMIN
    // --------------------------------------------

    const auth = await verifyAdmin(request);

    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // --------------------------------------------
    // PEGA ID
    // --------------------------------------------

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "ID do guia não informado." },
        { status: 400 }
      );
    }

    // --------------------------------------------
    // VERIFICA SE É UM GUIA
    // --------------------------------------------

    const { data: guideProfile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, name, role")
        .eq("id", id)
        .eq("role", "guide")
        .single();

    if (profileError || !guideProfile) {
      console.error(
        "GUIA NÃO ENCONTRADO:",
        profileError
      );

      return NextResponse.json(
        { error: "Guia não encontrado." },
        { status: 404 }
      );
    }

    // --------------------------------------------
    // DELETA PERFIL
    // --------------------------------------------

    const { error: deleteProfileError } =
      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", id);

    if (deleteProfileError) {
      console.error(
        "ERRO AO DELETAR PROFILE:",
        deleteProfileError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível deletar o perfil do guia.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------
    // DELETA USUÁRIO DO AUTH
    // --------------------------------------------

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteUserError) {
      console.error(
        "ERRO AO DELETAR USUÁRIO AUTH:",
        deleteUserError
      );

      return NextResponse.json(
        {
          error:
            "O perfil foi removido, mas não foi possível remover o usuário de autenticação.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------
    // SUCESSO
    // --------------------------------------------

    return NextResponse.json({
      success: true,
      message: `O guia "${guideProfile.name}" foi deletado com sucesso.`,
    });
  } catch (error) {
    console.error(
      "ERRO AO DELETAR GUIA:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Ocorreu um erro interno ao tentar deletar o guia.",
      },
      { status: 500 }
    );
  }
}