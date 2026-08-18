import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: Request) {
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

    if (
      adminError ||
      !adminProfile ||
      adminProfile.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Apenas administradores podem alterar guias." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const guideId = String(body.guideId || "");
    const active = Boolean(body.active);

    if (!guideId) {
      return NextResponse.json(
        { error: "Guia não informado." },
        { status: 400 }
      );
    }

    const { data: guide, error: guideError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .eq("id", guideId)
        .single();

    if (guideError || !guide) {
      return NextResponse.json(
        { error: "Guia não encontrado." },
        { status: 404 }
      );
    }

    if (guide.role !== "guide") {
      return NextResponse.json(
        { error: "Esse usuário não é um guia." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ active })
      .eq("id", guideId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      active,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}