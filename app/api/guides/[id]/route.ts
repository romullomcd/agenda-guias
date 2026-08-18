import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
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

    const { data: adminProfile, error: adminError } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (adminError || !adminProfile) {
      return NextResponse.json(
        { error: "Não foi possível verificar o administrador." },
        { status: 403 }
      );
    }

    if (adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem visualizar os dados." },
        { status: 403 }
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
        .select("id, name, role, active, languages")
        .eq("id", id)
        .eq("role", "guide")
        .single();

    if (profileError || !profile) {
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
    });
  } catch (error) {
    console.error("ERRO AO BUSCAR GUIA:", error);

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}