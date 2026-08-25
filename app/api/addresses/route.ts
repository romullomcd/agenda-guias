import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SavedAddress = {
  id: string;
  name: string;
  address: string;
  usage_count: number;
  is_preloaded: boolean;
  created_at: string;
  updated_at: string;
};

const ADDRESS_SELECT =
  "id, name, address, usage_count, is_preloaded, created_at, updated_at";

// ============================================================
// NORMALIZAR TEXTO
//
// Remove:
// - acentos
// - diferenças entre maiúsculas/minúsculas
// - espaços duplicados
//
// Exemplos:
// "Atlântica" -> "atlantica"
// "ATLANTICA" -> "atlantica"
// "  Rio   de Janeiro " -> "rio de janeiro"
// ============================================================

function normalizeText(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

// ============================================================
// VALIDAR USUÁRIO
// ============================================================

async function getAuthenticatedUser(
  request: Request
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    return {
      user: null,
      error:
        "Usuário não autenticado.",
    };
  }

  const accessToken =
    authorization.substring(7);

  const {
    data: { user },
    error,
  } =
    await supabaseAdmin.auth.getUser(
      accessToken
    );

  if (error || !user) {
    console.error(
      "❌ ERRO AO VALIDAR USUÁRIO:",
      error
    );

    return {
      user: null,
      error:
        "Usuário não autenticado.",
    };
  }

  return {
    user,
    error: null,
  };
}

// ============================================================
// VERIFICAR ADMIN
// ============================================================

async function isAdmin(
  userId: string
) {
  const {
    data: profile,
    error,
  } =
    await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

  if (error) {
    console.error(
      "❌ ERRO AO VERIFICAR ADMIN:",
      error
    );

    return false;
  }

  return (
    profile?.role ===
    "admin"
  );
}

// ============================================================
// GET
// BUSCAR ENDEREÇOS
// ============================================================

export async function GET(
  request: Request
) {
  try {
    console.log(
      "=========================================="
    );

    console.log(
      "📍 BUSCANDO ENDEREÇOS SALVOS"
    );

    console.log(
      "=========================================="
    );

    const {
      user,
      error: authError,
    } =
      await getAuthenticatedUser(
        request
      );

    if (!user) {
      return NextResponse.json(
        {
          error:
            authError ||
            "Usuário não autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const rawQuery =
      searchParams.get(
        "q"
      ) || "";

    const query =
      normalizeText(
        rawQuery
      );

    // ==========================================================
    // BUSCAR ENDEREÇOS
    //
    // Pegamos até 1000 registros e fazemos a comparação em
    // JavaScript para ignorar acentos corretamente.
    //
    // Depois limitamos o resultado final a 10.
    // ==========================================================

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "saved_addresses"
        )
        .select(
          ADDRESS_SELECT
        )
        .order(
          "usage_count",
          {
            ascending: false,
          }
        )
        .order(
          "name",
          {
            ascending: true,
          }
        )
        .limit(1000);

    if (error) {
      console.error(
        "❌ ERRO AO BUSCAR ENDEREÇOS:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível buscar os endereços.",
        },
        {
          status: 500,
        }
      );
    }

    let addresses =
      (data ||
        []) as SavedAddress[];

    // ==========================================================
    // FILTRO
    //
    // Procura em:
    // - nome
    // - endereço
    //
    // E ignora acentos.
    // ==========================================================

    if (query) {
      addresses =
        addresses.filter(
          (item) => {
            const normalizedName =
              normalizeText(
                item.name
              );

            const normalizedAddress =
              normalizeText(
                item.address
              );

            return (
              normalizedName.includes(
                query
              ) ||
              normalizedAddress.includes(
                query
              )
            );
          }
        );
    }

    // ==========================================================
    // LIMITE DO AUTOCOMPLETE
    // ==========================================================

    addresses =
      addresses.slice(
        0,
        query ? 10 : 20
      );

    console.log(
      "✅ ENDEREÇOS ENCONTRADOS:",
      addresses.length
    );

    return NextResponse.json({
      addresses,
    });
  } catch (error) {
    console.error(
      "❌ ERRO INESPERADO AO BUSCAR ENDEREÇOS:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Ocorreu um erro ao buscar os endereços.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// POST
//
// Se já existir o mesmo endereço:
// - aumenta usage_count
//
// Se não existir:
// - cria um novo endereço
//
// Somente ADMIN pode salvar.
// ============================================================

export async function POST(
  request: Request
) {
  try {
    console.log(
      "=========================================="
    );

    console.log(
      "📍 SALVANDO ENDEREÇO"
    );

    console.log(
      "=========================================="
    );

    const {
      user,
      error: authError,
    } =
      await getAuthenticatedUser(
        request
      );

    if (!user) {
      return NextResponse.json(
        {
          error:
            authError ||
            "Usuário não autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    const admin =
      await isAdmin(
        user.id
      );

    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Apenas administradores podem salvar endereços.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const name =
      typeof body?.name ===
      "string"
        ? body.name
            .replace(
              /\s+/g,
              " "
            )
            .trim()
        : "";

    const address =
      typeof body?.address ===
      "string"
        ? body.address
            .replace(
              /\s+/g,
              " "
            )
            .trim()
        : "";

    const isPreloaded =
      body?.is_preloaded ===
      true;

    if (!name) {
      return NextResponse.json(
        {
          error:
            "O nome do endereço é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    if (!address) {
      return NextResponse.json(
        {
          error:
            "O endereço é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // BUSCAR ENDEREÇOS EXISTENTES
    //
    // Fazemos a comparação normalizada para evitar duplicados
    // causados por:
    //
    // "Atlântica"
    // "Atlantica"
    // "ATLÂNTICA"
    // ==========================================================

    const {
      data: existingAddresses,
      error: existingListError,
    } =
      await supabaseAdmin
        .from(
          "saved_addresses"
        )
        .select(
          ADDRESS_SELECT
        )
        .limit(1000);

    if (
      existingListError
    ) {
      console.error(
        "❌ ERRO AO VERIFICAR ENDEREÇOS EXISTENTES:",
        existingListError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível verificar os endereços existentes.",
        },
        {
          status: 500,
        }
      );
    }

    const normalizedNewAddress =
      normalizeText(
        address
      );

    const existingAddress =
      (
        existingAddresses ||
        []
      ).find(
        (item) =>
          normalizeText(
            item.address
          ) ===
          normalizedNewAddress
      );

    // ==========================================================
    // JÁ EXISTE
    // ==========================================================

    if (
      existingAddress
    ) {
      const newUsageCount =
        Number(
          existingAddress.usage_count ||
            0
        ) + 1;

      const {
        data: updatedAddress,
        error: updateError,
      } =
        await supabaseAdmin
          .from(
            "saved_addresses"
          )
          .update({
            usage_count:
              newUsageCount,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            existingAddress.id
          )
          .select(
            ADDRESS_SELECT
          )
          .single();

      if (updateError) {
        console.error(
          "❌ ERRO AO ATUALIZAR USO DO ENDEREÇO:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível atualizar o uso do endereço.",
          },
          {
            status: 500
          }
        );
      }

      console.log(
        "✅ ENDEREÇO JÁ EXISTIA. USO INCREMENTADO:",
        updatedAddress
      );

      return NextResponse.json({
        success: true,
        created: false,
        address:
          updatedAddress,
      });
    }

    // ==========================================================
    // NOVO ENDEREÇO
    // ==========================================================

    const {
      data: newAddress,
      error: insertError,
    } =
      await supabaseAdmin
        .from(
          "saved_addresses"
        )
        .insert({
          name,
          address,
          usage_count: 1,
          is_preloaded:
            isPreloaded,
        })
        .select(
          ADDRESS_SELECT
        )
        .single();

    if (insertError) {
      console.error(
        "❌ ERRO AO CRIAR ENDEREÇO:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível salvar o novo endereço.",
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "✅ NOVO ENDEREÇO CRIADO:",
      newAddress
    );

    return NextResponse.json(
      {
        success: true,
        created: true,
        address:
          newAddress,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "❌ ERRO INESPERADO AO SALVAR ENDEREÇO:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Ocorreu um erro ao salvar o endereço.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// DELETE
//
// Somente ADMIN.
//
// Endereços pré-cadastrados não podem ser apagados.
// ============================================================

export async function DELETE(
  request: Request
) {
  try {
    console.log(
      "=========================================="
    );

    console.log(
      "🗑️ EXCLUINDO ENDEREÇO"
    );

    console.log(
      "=========================================="
    );

    const {
      user,
      error: authError,
    } =
      await getAuthenticatedUser(
        request
      );

    if (!user) {
      return NextResponse.json(
        {
          error:
            authError ||
            "Usuário não autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    const admin =
      await isAdmin(
        user.id
      );

    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Apenas administradores podem excluir endereços.",
        },
        {
          status: 403,
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const id =
      searchParams.get(
        "id"
      );

    if (!id) {
      return NextResponse.json(
        {
          error:
            "ID do endereço não informado.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // BUSCAR ENDEREÇO
    // ==========================================================

    const {
      data: savedAddress,
      error: findError,
    } =
      await supabaseAdmin
        .from(
          "saved_addresses"
        )
        .select(
          "id, name, address, is_preloaded"
        )
        .eq(
          "id",
          id
        )
        .maybeSingle();

    if (findError) {
      console.error(
        "❌ ERRO AO LOCALIZAR ENDEREÇO:",
        findError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível localizar o endereço.",
        },
        {
          status: 500,
        }
      );
    }

    if (!savedAddress) {
      return NextResponse.json(
        {
          error:
            "Endereço não encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================================
    // PROTEGER PRÉ-CADASTRADOS
    // ==========================================================

    if (
      savedAddress.is_preloaded
    ) {
      return NextResponse.json(
        {
          error:
            "Este endereço faz parte da lista pré-cadastrada e não pode ser excluído por aqui.",
        },
        {
          status: 403,
        }
      );
    }

    // ==========================================================
    // EXCLUIR
    // ==========================================================

    const {
      error: deleteError,
    } =
      await supabaseAdmin
        .from(
          "saved_addresses"
        )
        .delete()
        .eq(
          "id",
          id
        );

    if (deleteError) {
      console.error(
        "❌ ERRO AO EXCLUIR ENDEREÇO:",
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível excluir o endereço.",
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "✅ ENDEREÇO EXCLUÍDO:",
      savedAddress
    );

    return NextResponse.json({
      success: true,
      message:
        "Endereço excluído com sucesso.",
    });
  } catch (error) {
    console.error(
      "❌ ERRO INESPERADO AO EXCLUIR ENDEREÇO:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Ocorreu um erro ao excluir o endereço.",
      },
      {
        status: 500,
      }
    );
  }
}