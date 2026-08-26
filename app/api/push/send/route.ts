import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST() {
  try {
    console.log("========== TESTE DE PUSH ==========");

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (error) {
      console.error("❌ Erro ao buscar subscriptions:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    console.log(
      `📱 Subscriptions encontradas: ${subscriptions?.length ?? 0}`
    );

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Nenhuma subscription encontrada.",
      });
    }

    const results = [];

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: "Agenda de Guias",
            body: "🔔 Teste de notificação funcionando!",
            url: "/dashboard",
            icon: "/icon.png",
            badge: "/icon.png",
            tag: "teste-push",
          })
        );

        console.log(
          "✅ Push enviado:",
          subscription.user_id
        );

        results.push({
          id: subscription.id,
          success: true,
        });
      } catch (error: any) {
        console.error(
          "❌ Erro ao enviar para:",
          subscription.user_id,
          error
        );

        results.push({
          id: subscription.id,
          success: false,
          error: error?.message || "Erro desconhecido",
        });
      }
    }

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.length,
      results,
    });
  } catch (error: any) {
    console.error("❌ Erro geral no Push:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}