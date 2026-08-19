import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Identifica quem está fazendo a requisição
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

    // Verifica se o usuário é administrador
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

  if (profileError) {
  console.error("ERRO AO BUSCAR PERFIL:", profileError);

  return NextResponse.json(
    {
      error: "Erro ao verificar administrador.",
      details: profileError,
    },
    { status: 403 }
  );
}

if (!profile) {
  return NextResponse.json(
    {
      error: "Perfil não encontrado.",
      user_id: user.id,
    },
    { status: 403 }
  );
}

if (profile.role !== "admin") {
  return NextResponse.json(
    {
      error: "Usuário não é administrador.",
      user_id: user.id,
      role: profile.role,
    },
    { status: 403 }
  );
}

    // Dados enviados pelo formulário
    const body = await request.json();

    const name = String(body.name || "").trim();
const email = String(body.email || "").trim();
const phone = String(body.phone || "").trim();
const password = String(body.password || "");
const pixKey = String(body.pix_key || "").trim();


const languages = Array.isArray(body.languages)
  ? body.languages.map((language: unknown) => String(language))
  : [];

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, e-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha precisa ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

if (languages.length === 0) {
  return NextResponse.json(
    { error: "Selecione pelo menos um idioma." },
    { status: 400 }
  );
}

    // Cria a conta de autenticação
    const {
      data: { user: newUser },
      error: userError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (userError) {
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      );
    }

    if (!newUser) {
      return NextResponse.json(
        { error: "Não foi possível criar o usuário." },
        { status: 500 }
      );
    }

    // Cria o perfil do guia
const { error: newProfileError } = await supabaseAdmin
  .from("profiles")
  .insert({
    id: newUser.id,
    name,
    role: "guide",
    phone,
    languages,
    pix_key: pixKey || null,
  });

    // Se o perfil não for criado, remove também o usuário
    if (newProfileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);

      return NextResponse.json(
        { error: newProfileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}