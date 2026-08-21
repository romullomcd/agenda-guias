"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Calendar from "@/components/Calendar";
import AdminCalendar from "@/components/AdminCalendar";

type Profile = {
  name: string;
  role: "admin" | "guide";
  theme: "light" | "dark";
};

type Notification = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export default function Dashboard() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [googleConnected, setGoogleConnected] =
    useState(false);

  const [checkingGoogle, setCheckingGoogle] =
    useState(true);

  const [connectingGoogle, setConnectingGoogle] =
    useState(false);

  // ============================================================
  // MENU
  // ============================================================

  const [showMenu, setShowMenu] =
    useState(false);

const [theme, setTheme] =
  useState<"light" | "dark">(
    "light"
  );


useEffect(() => {
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark"
  );
}, [theme]);


  // ============================================================
  // NOTIFICAÇÕES
  // ============================================================

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [showNotifications, setShowNotifications] =
    useState(false);

  // ============================================================
  // MODAL DE NOTIFICAÇÃO
  // ============================================================

  const [activeNotification, setActiveNotification] =
    useState<Notification | null>(null);

  const [showNotificationModal, setShowNotificationModal] =
    useState(false);

  // ============================================================
  // CARREGAR PERFIL
  // ============================================================

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log(
        "🔐 USUÁRIO AUTENTICADO:",
        user?.id || null
      );

      if (userError) {
        console.error(
          "❌ ERRO AO PEGAR USUÁRIO:",
          userError.message
        );
      }

      if (!user) {
        window.location.href = "/";
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .select("name, role, theme")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(
          "❌ ERRO AO CARREGAR PERFIL:",
          error.message,
          error.details,
          error.hint,
          error.code
        );

        setLoading(false);
        return;
      }

      if (!data) {
        console.error(
          "❌ PERFIL NÃO ENCONTRADO"
        );

        setLoading(false);
        return;
      }

      console.log(
        "✅ PERFIL:",
        data
      );

setTheme(
  data.theme ===
    "dark"
    ? "dark"
    : "light"
);

      setProfile(data);
      setLoading(false);
    } catch (error) {
      console.error(
        "❌ ERRO INESPERADO AO CARREGAR PERFIL:",
        error
      );

      setLoading(false);
    }
  }

  // ============================================================
  // GOOGLE CALENDAR
  // SOMENTE ADMIN
  // ============================================================

  async function checkGoogleConnection() {
    try {
      setCheckingGoogle(true);

      console.log(
        "=========================================="
      );

      console.log(
        "🔎 VERIFICANDO CONEXÃO COM GOOGLE CALENDAR..."
      );

      console.log(
        "=========================================="
      );

      const {
        data: {
          session,
        },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "❌ ERRO AO PEGAR SESSÃO:",
          sessionError
        );

        setGoogleConnected(false);
        return;
      }

      if (!session?.access_token) {
        console.error(
          "❌ TOKEN DO SUPABASE NÃO ENCONTRADO"
        );

        setGoogleConnected(false);
        return;
      }

      const response =
        await fetch(
          "/api/google/status",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

      const data =
        await response.json().catch(
          () => null
        );

      console.log(
        "🔎 RESPOSTA STATUS GOOGLE:",
        data
      );

      if (!response.ok) {
        console.error(
          "❌ ERRO AO VERIFICAR GOOGLE:",
          data
        );

        setGoogleConnected(false);
        return;
      }

      const connected =
        data?.connected === true;

      console.log(
        "🔑 ACCESS TOKEN:",
        data?.hasAccessToken
      );

      console.log(
        "🔄 REFRESH TOKEN:",
        data?.hasRefreshToken
      );

      console.log(
        "📅 GOOGLE CONECTADO:",
        connected
      );

      setGoogleConnected(
        connected
      );
    } catch (error) {
      console.error(
        "❌ ERRO AO VERIFICAR CONEXÃO GOOGLE:",
        error
      );

      setGoogleConnected(false);
    } finally {
      setCheckingGoogle(false);
    }
  }

  // ============================================================
  // VERIFICAR GOOGLE
  // SOMENTE ADMIN
  // ============================================================

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (profile.role !== "admin") {
      console.log(
        "ℹ️ Usuário não administrador. Google Calendar não será carregado."
      );

      setCheckingGoogle(false);
      setGoogleConnected(false);

      return;
    }

    checkGoogleConnection();
  }, [profile]);

  // ============================================================
  // NAVEGAÇÃO
  // ============================================================

  function navigateTo(path: string) {
    setShowMenu(false);
    setShowNotifications(false);

    window.location.href = path;
  }

  // ============================================================
  // ABRIR MODAL DE NOTIFICAÇÃO
  // ============================================================

  function openNotificationModal(
    notification: Notification
  ) {
    setActiveNotification(
      notification
    );

    setShowNotificationModal(
      true
    );
  }

  // ============================================================
  // FECHAR MODAL
  // ============================================================

  async function closeNotificationModal() {
    if (!activeNotification) {
      setShowNotificationModal(false);
      return;
    }

    const notification =
      activeNotification;

    setShowNotificationModal(false);
    setActiveNotification(null);

    if (notification.read) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("notifications")
      .update({
        read: true,
      })
      .eq(
        "id",
        notification.id
      )
      .eq(
        "user_id",
        notification.user_id
      );

    if (error) {
      console.error(
        "❌ ERRO AO MARCAR NOTIFICAÇÃO DO MODAL COMO LIDA:",
        error.message,
        error.details,
        error.hint,
        error.code
      );

      return;
    }

    setNotifications(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            notification.id
              ? {
                  ...item,
                  read: true,
                }
              : item
        )
    );
  }

  // ============================================================
  // CARREGAR NOTIFICAÇÕES
  // SOMENTE GUIAS
  // ============================================================

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (profile.role !== "guide") {
      console.log(
        "ℹ️ Usuário administrador. Notificações não serão carregadas."
      );

      return;
    }

    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    let cancelled = false;

    async function setupNotifications() {
      console.log(
        "=========================================="
      );

      console.log(
        "🔔 INICIANDO SISTEMA DE NOTIFICAÇÕES"
      );

      console.log(
        "=========================================="
      );

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log(
        "👤 USER ID:",
        user?.id || null
      );

      console.log(
        "📧 USER EMAIL:",
        user?.email || null
      );

      if (userError) {
        console.error(
          "❌ USER ERROR:",
          userError.message
        );
      }

      if (!user) {
        console.error(
          "❌ NENHUM USUÁRIO AUTENTICADO PARA NOTIFICAÇÕES"
        );

        return;
      }

      if (cancelled) {
        return;
      }

      // ========================================================
      // CARREGAR NOTIFICAÇÕES EXISTENTES
      // ========================================================

      console.log(
        "📥 CARREGANDO NOTIFICAÇÕES..."
      );

      const {
        data,
        error,
      } = await supabase
        .from("notifications")
        .select(
          "id, user_id, type, title, message, read, created_at"
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(10);

      if (error) {
        console.error(
          "❌ ERRO AO CARREGAR NOTIFICAÇÕES:",
          error
        );

        return;
      }

      console.log(
        "✅ NOTIFICAÇÕES CARREGADAS:",
        data?.length || 0
      );

      if (cancelled) {
        return;
      }

      const loadedNotifications =
        data || [];

      setNotifications(
        loadedNotifications
      );

      // ========================================================
      // ABRIR MODAL SE EXISTIR NÃO LIDA
      // ========================================================

      const firstUnread =
        loadedNotifications.find(
          (notification) =>
            !notification.read
        );

      if (
        firstUnread &&
        !cancelled
      ) {
        console.log(
          "📢 EXISTE NOTIFICAÇÃO NÃO LIDA:",
          firstUnread
        );

        setActiveNotification(
          firstUnread
        );

        setShowNotificationModal(
          true
        );
      }

      // ========================================================
      // REALTIME
      // ========================================================

      console.log(
        "📡 CONFIGURANDO REALTIME..."
      );

      channel = supabase
        .channel(
          `notifications-${user.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log(
              "🆕 NOVA NOTIFICAÇÃO:",
              payload
            );

            const newNotification =
              payload.new as Notification;

            setNotifications(
              (current) => {
                const alreadyExists =
                  current.some(
                    (notification) =>
                      notification.id ===
                      newNotification.id
                  );

                if (
                  alreadyExists
                ) {
                  return current;
                }

                return [
                  newNotification,
                  ...current,
                ];
              }
            );

            if (
              !newNotification.read
            ) {
              setActiveNotification(
                newNotification
              );

              setShowNotificationModal(
                true
              );
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log(
              "✏️ NOTIFICAÇÃO ATUALIZADA:",
              payload
            );

            const updatedNotification =
              payload.new as Notification;

            setNotifications(
              (current) =>
                current.map(
                  (
                    notification
                  ) =>
                    notification.id ===
                    updatedNotification.id
                      ? updatedNotification
                      : notification
                )
            );

            setActiveNotification(
              (current) =>
                current &&
                current.id ===
                  updatedNotification.id
                  ? updatedNotification
                  : current
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log(
              "🗑️ NOTIFICAÇÃO EXCLUÍDA:",
              payload
            );

            const deletedNotification =
              payload.old as Notification;

            setNotifications(
              (current) =>
                current.filter(
                  (
                    notification
                  ) =>
                    notification.id !==
                    deletedNotification.id
                )
            );

            setActiveNotification(
              (current) =>
                current &&
                current.id ===
                  deletedNotification.id
                  ? null
                  : current
            );
          }
        )
        .subscribe((status) => {
          console.log(
            "📡 STATUS REALTIME:",
            status
          );

          if (
            status ===
            "SUBSCRIBED"
          ) {
            console.log(
              "✅ REALTIME DE NOTIFICAÇÕES CONECTADO!"
            );
          }

          if (
            status ===
            "CHANNEL_ERROR"
          ) {
            console.error(
              "❌ ERRO NO CANAL REALTIME"
            );
          }

          if (
            status ===
            "TIMED_OUT"
          ) {
            console.error(
              "⏱️ REALTIME EXPIROU"
            );
          }

          if (
            status ===
            "CLOSED"
          ) {
            console.warn(
              "⚠️ CANAL REALTIME FECHADO"
            );
          }
        });
    }

    setupNotifications();

    return () => {
      cancelled = true;

      if (channel) {
        console.log(
          "🧹 REMOVENDO CANAL REALTIME"
        );

        supabase.removeChannel(
          channel
        );

        channel = null;
      }
    };
  }, [profile]);

  // ============================================================
  // NOTIFICAÇÕES NÃO LIDAS
  // ============================================================

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length;

  // ============================================================
  // MARCAR COMO LIDA
  // ============================================================

  async function markNotificationAsRead(
    notification: Notification
  ) {
    if (notification.read) {
      openNotificationModal(
        notification
      );

      return;
    }

    console.log(
      "📖 MARCANDO NOTIFICAÇÃO COMO LIDA:",
      notification.id
    );

    const {
      error,
    } = await supabase
      .from("notifications")
      .update({
        read: true,
      })
      .eq(
        "id",
        notification.id
      )
      .eq(
        "user_id",
        notification.user_id
      );

    if (error) {
      console.error(
        "❌ ERRO AO MARCAR NOTIFICAÇÃO COMO LIDA:",
        error.message,
        error.details,
        error.hint,
        error.code
      );

      return;
    }

    setNotifications(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            notification.id
              ? {
                  ...item,
                  read: true,
                }
              : item
        )
    );

    openNotificationModal({
      ...notification,
      read: true,
    });
  }

  // ============================================================
  // MARCAR TODAS COMO LIDAS
  // ============================================================

  async function markAllAsRead() {
    const unreadNotifications =
      notifications.filter(
        (notification) =>
          !notification.read
      );

    if (
      unreadNotifications.length ===
      0
    ) {
      return;
    }

    const ids =
      unreadNotifications.map(
        (notification) =>
          notification.id
      );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    console.log(
      "📖 MARCANDO TODAS COMO LIDAS:",
      ids
    );

    const {
      error,
    } = await supabase
      .from("notifications")
      .update({
        read: true,
      })
      .in(
        "id",
        ids
      )
      .eq(
        "user_id",
        user.id
      );

    if (error) {
      console.error(
        "❌ ERRO AO MARCAR TODAS COMO LIDAS:",
        error.message,
        error.details,
        error.hint,
        error.code
      );

      return;
    }

    setNotifications(
      (current) =>
        current.map(
          (notification) => ({
            ...notification,
            read: true,
          })
        )
    );
  }

  // ============================================================
  // DATA DA NOTIFICAÇÃO
  // ============================================================

  function formatNotificationDate(
    value: string
  ) {
    const date =
      new Date(value);

    return date.toLocaleString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // ============================================================
  // CONECTAR GOOGLE CALENDAR
  // SOMENTE ADMIN
  // ============================================================

  async function connectGoogleCalendar() {
    if (
      connectingGoogle ||
      profile?.role !== "admin"
    ) {
      return;
    }

    try {
      setConnectingGoogle(true);

      console.log(
        "=========================================="
      );

      console.log(
        "🔵 INICIANDO CONEXÃO COM GOOGLE CALENDAR"
      );

      console.log(
        "=========================================="
      );

      const {
        data: {
          session,
        },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          "❌ ERRO AO PEGAR SESSÃO:",
          error
        );

        alert(
          "Não foi possível verificar seu login."
        );

        return;
      }

      if (!session?.access_token) {
        console.error(
          "❌ TOKEN DO SUPABASE NÃO ENCONTRADO"
        );

        alert(
          "Sua sessão expirou. Faça login novamente."
        );

        return;
      }

      console.log(
        "✅ SESSÃO ENCONTRADA"
      );

      const response =
        await fetch(
          "/api/google/auth",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },

            cache: "no-store",
          }
        );

      const data =
        await response.json().catch(
          () => null
        );

      console.log(
        "🔎 RESPOSTA GOOGLE AUTH:",
        data
      );

      if (!response.ok) {
        console.error(
          "❌ ERRO AO INICIAR GOOGLE:",
          data
        );

        alert(
          data?.error ||
            "Não foi possível conectar ao Google Calendar."
        );

        return;
      }

      if (!data?.url) {
        console.error(
          "❌ URL DO GOOGLE NÃO RECEBIDA:",
          data
        );

        alert(
          "Não foi possível gerar a autorização do Google."
        );

        return;
      }

      console.log(
        "🔵 REDIRECIONANDO PARA GOOGLE..."
      );

      window.location.assign(
        data.url
      );
    } catch (error) {
      console.error(
        "❌ ERRO AO CONECTAR GOOGLE CALENDAR:",
        error
      );

      alert(
        "Ocorreu um erro ao conectar ao Google Calendar."
      );
    } finally {
      setConnectingGoogle(false);
    }
  }

  // ============================================================
  // DETECTAR RETORNO DO GOOGLE
  // ============================================================

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (profile.role !== "admin") {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const googleStatus =
      params.get("google");

    if (
      googleStatus ===
      "success"
    ) {
      console.log(
        "🎉 RETORNO DO GOOGLE DETECTADO"
      );

      window.history.replaceState(
        {},
        document.title,
        "/dashboard"
      );

      setTimeout(() => {
        checkGoogleConnection();
      }, 300);
    }
  }, [profile]);


// ============================================================
// TEMA
// ============================================================

async function toggleTheme() {
  const nextTheme =
    theme ===
    "light"
      ? "dark"
      : "light";

  setTheme(
    nextTheme
  );

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const {
    data: updatedProfile,
    error,
  } =
    await supabase
      .from("profiles")
      .update({
        theme:
          nextTheme,
      })
      .eq(
        "id",
        user.id
      )
      .select(
        "id, theme"
      )
      .single();

  if (error) {
    console.error(
      "❌ ERRO AO SALVAR TEMA:",
      JSON.stringify(
        error,
        null,
        2
      ),
      "MESSAGE:",
      error.message,
      "DETAILS:",
      error.details,
      "HINT:",
      error.hint,
      "CODE:",
      error.code
    );

    setTheme(
      theme
    );

    return;
  }

  if (
    updatedProfile?.theme
  ) {
    setTheme(
      updatedProfile.theme
    );
  }
}
  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    console.log(
      "🚪 FAZENDO LOGOUT"
    );

    setShowMenu(false);

    await supabase.auth.signOut();

    window.location.href = "/";
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] dark:bg-black">
        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-[#e91e8c]" />

          <p className="mt-4 text-sm text-gray-500 dark:text-gray-300">
            Carregando...
          </p>

        </div>
      </main>
    );
  }

  // ============================================================
  // SEM PERFIL
  // ============================================================

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] dark:bg-black px-6">

        <div className="rounded-3xl bg-white p-8 text-center shadow-xl dark:bg-black">

          <p className="text-gray-600 dark:text-gray-300">
            Não foi possível carregar seu perfil.
          </p>

        </div>

      </main>
    );
  }

  // ============================================================
  // ADMIN
  // ============================================================

  const isAdmin =
    profile.role === "admin";

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="min-h-screen bg-[#f7f7fb] dark:bg-black">

      {/* ====================================================== */}
      {/* DECORAÇÃO DE FUNDO */}
      {/* ====================================================== */}

      <div className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-[#e91e8c] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#1687d9] opacity-[0.08] blur-3xl" />

      <div className="pointer-events-none fixed left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ffd21c] opacity-[0.04] blur-3xl" />

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <header className="relative z-50 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-black">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">

          {/* MARCA */}

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e91e8c] shadow-md shadow-pink-200">

              <img
                src="/logo-branca.png"
                alt="Way To Know Rio"
                className="max-h-8 max-w-[38px] object-contain"
              />

            </div>

            <div>

              <h1 className="text-lg font-extrabold leading-tight text-gray-900 dark:text-white sm:text-xl">
                Agenda de Guias
              </h1>

              <p className="text-xs text-gray-500 dark:text-gray-300">
                {isAdmin
                  ? "Painel administrativo"
                  : "Minha agenda"}
              </p>

            </div>

          </div>

          {/* ÁREA DO USUÁRIO */}

          <div className="flex items-center gap-2 sm:gap-3">

            {/* MENU DESKTOP */}

            <nav className="hidden items-center gap-1 lg:flex">

              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/dashboard"
                  )
                }
                className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-blue-50 hover:text-[#1687d9]"
              >
                📅{" "}
                {isAdmin
                  ? "Agenda"
                  : "Minha Agenda"}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() =>
                    navigateTo(
                      "/guias"
                    )
                  }
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-blue-50 hover:text-[#1687d9]"
                >
                  👥 Gerenciar Guias
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() =>
                    navigateTo(
                      "/admin/ranking"
                    )
                  }
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200
transition hover:bg-yellow-50 hover:text-yellow-600"
                >
                  🏆 Ranking
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() =>
                    navigateTo(
                      "/admin/logins"
                    )
                  }
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-blue-50 hover:text-[#1687d9]"
                >
                  🔐 Logins
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/perfil"
                  )
                }
                className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-pink-50 hover:text-[#e91e8c]"
              >
                👤 Meu Perfil
              </button>

<button
  type="button"
  onClick={
    toggleTheme
  }
  className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-100 dark:hover:bg-gray-800"
>
  {theme ===
  "light"
    ? "🌙"
    : "☀️"}{" "}
  {theme ===
  "light"
    ? "Escuro"
    : "Claro"}
</button>

            </nav>

            {/* NOME */}

            <div className="hidden text-right xl:block">

              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {profile.name}
              </p>

              <p className="text-xs text-gray-500 dark:text-gray-300">
                {isAdmin
                  ? "Administrador"
                  : "Guia"}
              </p>

            </div>

            {/* SINO - SOMENTE GUIA */}

            {!isAdmin && (
              <div className="relative z-[100]">

                <button
                  type="button"
                  onClick={() =>
                    setShowNotifications(
                      (current) =>
                        !current
                    )
                  }
                  className="relative flex h-10 w-10 items-center justify-center
rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-black text-xl text-gray-600 dark:text-gray-200 shadow-sm transition hover:border-[#1687d9]
hover:bg-blue-50 hover:text-[#1687d9]"
                  aria-label="Notificações"
                >

                  🔔

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e91e8c] px-1 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-white">
                      {unreadCount >
                      99
                        ? "99+"
                        : unreadCount}
                    </span>
                  )}

                </button>

                {/* =================================================
                   DROPDOWN DE NOTIFICAÇÕES
                   CORRIGIDO PARA CELULAR
                   ================================================= */}

                {showNotifications && (
                  <div
                    className="
                      fixed
                      left-1/2
                      top-[68px]
                      z-[200]
                      w-[calc(100vw-24px)]
                      max-w-[340px]
                      -translate-x-1/2
                      overflow-hidden
                      rounded-2xl
                      border
                      border-gray-100 dark:border-gray-800
                      bg-white dark:bg-black
                      shadow-2xl

                      sm:absolute
                      sm:left-auto
                      sm:right-0
                      sm:top-12
                      sm:w-[340px]
                      sm:max-w-none
                      sm:translate-x-0
                    "
                  >

                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-4 py-3">

                      <div className="min-w-0">

                        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                          Notificações
                        </h3>

                        <p className="text-[11px] text-gray-500 dark:text-gray-300">
                          {unreadCount >
                          0
                            ? `${unreadCount} não lida${
                                unreadCount !==
                                1
                                  ? "s"
                                  : ""
                              }`
                            : "Tudo em dia"}
                        </p>

                      </div>

                      {unreadCount >
                        0 && (
                        <button
                          type="button"
                          onClick={
                            markAllAsRead
                          }
                          className="shrink-0 text-right text-[11px] font-bold text-[#1687d9] hover:underline"
                        >
                          Marcar todas como lidas
                        </button>
                      )}

                    </div>

                    <div className="max-h-[420px] overflow-y-auto overflow-x-hidden">

                      {notifications.length ===
                      0 ? (
                        <div className="px-5 py-10 text-center">

                          <div className="text-3xl">
                            🔔
                          </div>

                          <p className="mt-3 text-sm font-bold text-gray-700 dark:text-gray-200">
                            Nenhuma notificação
                          </p>

                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                            Você será avisado aqui quando houver novidades.
                          </p>

                        </div>
                      ) : (
                        notifications.map(
                          (
                            notification
                          ) => (
                            <button
                              key={
                                notification.id
                              }
                              type="button"
                              onClick={() =>
                                markNotificationAsRead(
                                  notification
                                )
                              }
                              className={[
                                "flex w-full min-w-0 gap-3 border-b border-gray-50 dark:border-gray-800 px-4 py-4 text-left transition",
                                notification.read
                                  ? "bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-900"
                                  : "bg-blue-50/60 hover:bg-blue-50",
                              ].join(
                                " "
                              )}
                            >

                              <div
                                className={[
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base",
                                  notification.type ===
                                    "guide_escalated"
                                    ? "bg-gray-100 dark:bg-gray-800"
                                    : notification.type ===
                                      "guide_unescalated"
                                    ? "bg-red-100"
                                    : "bg-blue-100",
                                ].join(
                                  " "
                                )}
                              >
                                {notification.type ===
                                "guide_escalated"
                                  ? "📋"
                                  : notification.type ===
                                    "guide_unescalated"
                                  ? "↩️"
                                  : "🔔"}
                              </div>

                              <div className="min-w-0 flex-1">

                                <div className="flex min-w-0 items-start justify-between gap-2">

                                  <p
                                    className={[
                                      "min-w-0 break-words text-sm",
                                      notification.read
? "font-bold text-gray-800 dark:text-gray-200"
: "font-extrabold text-gray-900 dark:text-white",
                                    ].join(
                                      " "
                                    )}
                                  >
                                    {
                                      notification.title
                                    }
                                  </p>

                                  {!notification.read && (
                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#e91e8c]" />
                                  )}

                                </div>

                                <p className="mt-1 break-words [overflow-wrap:anywhere] text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                                  {
                                    notification.message
                                  }
                                </p>

                                <p className="mt-2 break-words text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                  {formatNotificationDate(
                                    notification.created_at
                                  )}
                                </p>

                              </div>

                            </button>
                          )
                        )
                      )}

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* AVATAR */}

            <div
              className={
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white " +
                (isAdmin
                  ? "bg-[#1687d9]"
                  : "bg-[#e91e8c]")
              }
            >
              {profile.name
                .charAt(0)
                .toUpperCase()}
            </div>

            {/* MENU MOBILE */}

            <div className="relative lg:hidden">

              <button
                type="button"
                onClick={() =>
                  setShowMenu(
                    (current) =>
                      !current
                  )
                }
className="flex h-10 w-10 items-center justify-center rounded-xl border
border-gray-200 dark:border-gray-700 bg-white dark:bg-black text-xl text-gray-700 dark:text-gray-200 shadow-sm transition hover:border-[#1687d9] hover:bg-blue-50
hover:text-[#1687d9]"
                aria-label="Abrir menu"
                aria-expanded={
                  showMenu
                }
              >
                {showMenu
                  ? "✕"
                  : "☰"}
              </button>

             {showMenu && (
  <div className="absolute right-0 top-12 z-[300] w-[290px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-black shadow-2xl">

                  <div className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900 px-5 py-4">

                    <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                      {profile.name}
                    </p>

                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                      {isAdmin
                        ? "Administrador"
                        : "Guia"}
                    </p>

                  </div>

                  <div className="p-2">

                    <button
                      type="button"
                      onClick={() =>
                        navigateTo(
                          "/dashboard"
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-blue-50 hover:text-[#1687d9]"
                    >
                      <span className="text-lg">
                        📅
                      </span>

                      <span>
                        {isAdmin
                          ? "Agenda"
                          : "Minha Agenda"}
                      </span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          navigateTo(
                            "/guias"
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-blue-50 hover:text-[#1687d9]"
                      >
                        <span className="text-lg">
                          👥
                        </span>

                        <span>
                          Gerenciar Guias
                        </span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          navigateTo(
                            "/admin/ranking"
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-yellow-50 hover:text-yellow-600"
                      >
                        <span className="text-lg">
                          🏆
                        </span>

                        <span>
                          Ranking de Tours
                        </span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          navigateTo(
                            "/admin/logins"
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-blue-50 hover:text-[#1687d9]"
                      >
                        <span className="text-lg">
                          🔐
                        </span>

                        <span>
                          Logins
                        </span>
                      </button>
                    )}

                    {/* GOOGLE CALENDAR - SOMENTE ADMIN */}

                    {isAdmin &&
                      !checkingGoogle &&
                      !googleConnected && (
                        <button
                          type="button"
                          disabled={
                            connectingGoogle
                          }
                          onClick={() => {
                            setShowMenu(false);
                            connectGoogleCalendar();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-green-50 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="text-lg">
                            📅
                          </span>

                          <span>
                            {connectingGoogle
                              ? "Conectando..."
                              : "Conectar Google Calendar"}
                          </span>
                        </button>
                      )}

                    {isAdmin &&
                      !checkingGoogle &&
                      googleConnected && (
                        <div className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-green-600">
                          <span className="text-lg">
                            ✅
                          </span>

                          <span>
                            Google Calendar conectado
                          </span>
                        </div>
                      )}

                    <button
                      type="button"
                      onClick={() =>
                        navigateTo(
                          "/perfil"
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-pink-50 hover:text-[#e91e8c]"
                    >
                      <span className="text-lg">
                        👤
                      </span>

                      <span>
                        Meu Perfil
                      </span>
                    </button>

<button
  type="button"
  onClick={
    toggleTheme
  }
  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-900"
>
  <span className="text-lg">
    {theme ===
    "light"
      ? "🌙"
      : "☀️"}
  </span>

  <span>
    {theme ===
    "light"
      ? "Tema escuro"
      : "Tema claro"}
  </span>
</button>

                  </div>

                  <div className="mx-4 border-t border-gray-100 dark:border-gray-800" />

                  <div className="p-2">

                    <button
                      type="button"
                      onClick={
                        handleLogout
                      }
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                    >
                      <span className="text-lg">
                        🚪
                      </span>

                      <span>
                        Sair
                      </span>
                    </button>

                  </div>

                </div>
              )}

            </div>

            {/* SAIR DESKTOP */}

            <button
              onClick={
                handleLogout
              }
              className="hidden rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm
font-semibold text-gray-600 dark:text-gray-300 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:px-4 lg:block"
            >
              Sair
            </button>

          </div>

        </div>

        {/* FAIXA */}

        <div className="flex h-1">

          <div className="flex-1 bg-[#e91e8c]" />
          <div className="flex-1 bg-[#ffd21c]" />
          <div className="flex-1 bg-[#1687d9]" />

        </div>

      </header>

      {/* ====================================================== */}
      {/* CONTEÚDO */}
      {/* ====================================================== */}

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-7 sm:px-6 sm:py-9">

        {/* ==================================================== */}
        {/* GOOGLE CALENDAR - SOMENTE ADMIN */}
        {/* ==================================================== */}

        {isAdmin && (
          <div className="mb-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-black">

            <div className="flex h-1">

              <div className="flex-1 bg-[#4285F4]" />
              <div className="flex-1 bg-[#34A853]" />
              <div className="flex-1 bg-[#FBBC05]" />
              <div className="flex-1 bg-[#EA4335]" />

            </div>

            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-2xl">
                  📅
                </div>

                <div>

                  <h2 className="text-base font-extrabold text-gray-900 dark:text-white sm:text-lg">
                    Google Calendar
                  </h2>

                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-300 sm:text-sm">
                    {checkingGoogle
                      ? "Verificando conexão..."
                      : googleConnected
                      ? "Sua conta está conectada e pronta para sincronizar sua agenda."
                      : "Conecte sua conta para sincronizar sua agenda."}
                  </p>

                </div>

              </div>

              {!checkingGoogle &&
                !googleConnected && (
                  <button
                    type="button"
                    disabled={
                      connectingGoogle
                    }
                    onClick={
                      connectGoogleCalendar
                    }
                    className="w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {connectingGoogle
                      ? "⏳ Conectando..."
                      : "📅 Conectar Google"}
                  </button>
                )}

              {!checkingGoogle &&
                googleConnected && (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-extrabold text-green-700 sm:w-auto">

                    <span>
                      ✓
                    </span>

                    <span>
                      Google conectado
                    </span>

                  </div>
                )}

            </div>

          </div>
        )}

        {/* ==================================================== */}
        {/* CALENDÁRIO */}
        {/* ==================================================== */}

        {isAdmin ? (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-black">

            <div className="flex h-1">

              <div className="flex-1 bg-[#e91e8c]" />
              <div className="flex-1 bg-[#ffd21c]" />
              <div className="flex-1 bg-[#1687d9]" />

            </div>

            <div className="p-2 sm:p-4">

              <AdminCalendar />

            </div>

          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-black">

            <div className="flex h-1">

              <div className="flex-1 bg-[#e91e8c]" />
              <div className="flex-1 bg-[#ffd21c]" />
              <div className="flex-1 bg-[#1687d9]" />

            </div>

            <div className="p-2 sm:p-4">

              <Calendar />

            </div>

          </div>
        )}

        {/* ==================================================== */}
        {/* RODAPÉ */}
        {/* ==================================================== */}

        <footer className="mt-12 pb-5 text-center">

          <div className="mb-4 flex justify-center gap-2">

            <span className="h-2 w-8 rounded-full bg-[#e91e8c]" />

            <span className="h-2 w-8 rounded-full bg-[#1687d9]" />

            <span className="h-2 w-8 rounded-full bg-[#ffd21c]" />

          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            © 2026 Way To Know Rio
          </p>

          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Desenvolvido por{" "}
            <span className="font-semibold text-[#e91e8c]">
              Machado's
            </span>
          </p>

        </footer>

      </section>

      {/* ====================================================== */}
      {/* MODAL CENTRAL DE NOTIFICAÇÃO */}
      {/* SOMENTE GUIA */}
      {/* ====================================================== */}

      {!isAdmin &&
        showNotificationModal &&
        activeNotification && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[3px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-modal-title"
          >

            <div className="max-h-[90vh] w-full min-w-0 max-w-[500px] overflow-x-hidden overflow-y-auto rounded-[28px] bg-white shadow-2xl dark:bg-black">

              <div className="h-2 bg-gradient-to-r from-[#e91e8c] via-[#ffd21c] to-[#1687d9]" />

              <div className="min-w-0 px-5 pb-6 pt-7 sm:px-9 sm:pb-9 sm:pt-9">

                <h2
                  id="notification-modal-title"
                  className="break-words text-center text-xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-3xl"
                >
                  {activeNotification.title}
                </h2>

                <div className="mt-5 min-w-0 text-center sm:mt-6">

                  <p className="whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-6 text-gray-600 dark:text-gray-300 sm:text-lg sm:leading-8">
                    {activeNotification.message}
                  </p>

                </div>

                <p className="mt-5 break-words text-center text-xs font-medium text-gray-400 dark:text-gray-500">
                  {formatNotificationDate(
                    activeNotification.created_at
                  )}
                </p>

                <button
                  type="button"
                  onClick={
                    closeNotificationModal
                  }
                  className="mt-6 w-full rounded-2xl bg-[#1687d9] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-[#0f75bd] hover:shadow-xl active:scale-[0.99]"
                >
                  Fechar
                </button>

              </div>

            </div>

          </div>
        )}

    </main>
  );
}