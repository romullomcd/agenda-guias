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

type PushPayload = {
  user_id?: string;
  title?: string;
  message?: string;
  type?: string;
  record?: {
    user_id?: string;
    title?: string;
    message?: string;
    type?: string;
  };
};

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as PushPayload;

    const userId =
      body.record?.user_id ||
      body.user_id;

    const title =
      body.record?.title ||
      body.title ||
      "Agenda de Guias";

    const message =
      body.record?.message ||
      body.message ||
      "Você recebeu uma nova notificação.";

    const type =
      body.record?.type ||
      body.type ||
      "notification";

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "user_id não informado.",
        },
        { status: 400 }
      );
    }

    const {
      data: subscriptions,
      error: subscriptionsError,
    } = await supabase
      .from("push_subscriptions")
      .select(
        "id, user_id, endpoint, p256dh, auth"
      )
      .eq(
        "user_id",
        userId
      );

    if (subscriptionsError) {
      return NextResponse.json(
        {
          success: false,
          error:
            subscriptionsError.message,
        },
        { status: 500 }
      );
    }

    if (
      !subscriptions ||
      subscriptions.length === 0
    ) {
      return NextResponse.json({
        success: true,
        message:
          "Nenhuma subscription encontrada para este guia.",
        user_id: userId,
        sent: 0,
      });
    }

    const results = [];

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint:
              subscription.endpoint,
            keys: {
              p256dh:
                subscription.p256dh,
              auth:
                subscription.auth,
            },
          },
          JSON.stringify({
            title,
            body: message,
            url: "/dashboard",
            icon: "/icon.png",
            badge: "/icon.png",
            tag: `agenda-${type}`,
          })
        );

        results.push({
          id: subscription.id,
          success: true,
        });
      } catch (error: any) {
        const statusCode =
          error?.statusCode;

        /*
         * 404/410 normalmente significam que
         * a subscription não existe mais.
         * Removemos para não continuar tentando
         * enviar para um dispositivo inválido.
         */
        if (
          statusCode === 404 ||
          statusCode === 410
        ) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq(
              "id",
              subscription.id
            );
        }

        results.push({
          id: subscription.id,
          success: false,
          statusCode:
            statusCode || null,
          error:
            error?.message ||
            "Erro desconhecido",
        });
      }
    }

    const sentCount =
      results.filter(
        (result) =>
          result.success
      ).length;

    return NextResponse.json({
      success: true,
      user_id: userId,
      title,
      message,
      subscriptions:
        subscriptions.length,
      sent: sentCount,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}