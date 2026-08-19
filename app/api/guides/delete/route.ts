import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: Request) {
  try {
    // ============================================
    // VERIFICA AUTENTICAÇÃO
    // ============================================

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

    // ============================================
    // VERIFICA SE É ADMIN
    // ============================================

    const { data: adminProfile, error: adminError } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
      adminError ||
      !adminProfile ||
      adminProfile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Apenas administradores podem excluir guias.",
        },
        { status: 403 }
      );
    }

    // ============================================
    // RECEBE O ID DO GUIA
    // ============================================

    const body = await request.json();

    const guideId = String(body.guideId || "");

    if (!guideId) {
      return NextResponse.json(
        { error: "Guia não informado." },
        { status: 400 }
      );
    }

    // ============================================
    // VERIFICA SE O GUIA EXISTE
    // ============================================

    const { data: guide, error: guideError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, name, role")
        .eq("id", guideId)
        .single();

    if (guideError || !guide) {
      return NextResponse.json(
        { error: "Guia não encontrado." },
        { status: 404 }
      );
    }

    // ============================================
    // GARANTE QUE É REALMENTE UM GUIA
    // ============================================

    if (guide.role !== "guide") {
      return NextResponse.json(
        { error: "Esse usuário não é um guia." },
        { status: 400 }
      );
    }

    // ============================================
    // NÃO PERMITE EXCLUIR O PRÓPRIO ADMIN
    // ============================================

    if (guideId === user.id) {
      return NextResponse.json(
        {
          error:
            "Você não pode excluir sua própria conta.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // EXCLUI O PERFIL
    // ============================================

    const { error: profileDeleteError } =
      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", guideId);

    if (profileDeleteError) {
      console.error(
        "ERRO AO EXCLUIR PERFIL:",
        profileDeleteError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível excluir o perfil do guia.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // EXCLUI A CONTA DO SUPABASE AUTH
    // ============================================

    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(
        guideId
      );

    if (authDeleteError) {
      console.error(
        "ERRO AO EXCLUIR USUÁRIO DO AUTH:",
        authDeleteError
      );

      return NextResponse.json(
        {
          error:
            "O perfil foi excluído, mas houve um erro ao excluir a conta de acesso.",
        },
        { status: 500 }
      );
    }

    // ============================================
    // SUCESSO
    // ============================================

    return NextResponse.json({
      success: true,
      message: `Guia ${guide.name} excluído com sucesso.`,
    });
  } catch (error) {
    console.error(
      "ERRO AO EXCLUIR GUIA:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno do servidor.",
      },
      { status: 500 }
    );
  }
}