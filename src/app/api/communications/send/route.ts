import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Channel = "sms" | "whatsapp";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string, defaultCountryCode = "+33") {
  const raw = value.replace(/[^\d+]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`;
  if (raw.startsWith("00")) return `+${raw.slice(2).replace(/\D/g, "")}`;
  if (raw.startsWith("0")) return `${defaultCountryCode}${raw.slice(1)}`;
  return `${defaultCountryCode}${raw}`;
}

async function requirePermission(permission: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Необходима авторизация." }, { status: 401 }), user: null };
  }

  const { data: allowed, error } = await supabase.rpc("has_permission", {
    requested_permission: permission,
  });

  if (error || allowed !== true) {
    return { error: NextResponse.json({ error: "Недостаточно прав." }, { status: 403 }), user: null };
  }

  return { error: null, user };
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission("communications.view");
  if (auth.error) return auth.error;

  const clientId = clean(request.nextUrl.searchParams.get("clientId"));
  if (!clientId) {
    return NextResponse.json({ error: "Не указан клиент." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("client_messages")
    .select("id, created_at, channel, direction, recipient, body, status, error_message, sent_at, delivered_at, sent_by, profiles:sent_by(full_name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("communications.send");
  if (auth.error || !auth.user) return auth.error;

  let body: {
    client_id?: unknown;
    work_order_id?: unknown;
    channel?: unknown;
    message?: unknown;
    default_country_code?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const clientId = clean(body.client_id);
  const workOrderId = clean(body.work_order_id) || null;
  const channel = clean(body.channel) as Channel;
  const message = clean(body.message);
  const defaultCountryCode = clean(body.default_country_code) || "+33";

  if (!clientId || !["sms", "whatsapp"].includes(channel) || !message) {
    return NextResponse.json({ error: "Не заполнены обязательные данные сообщения." }, { status: 400 });
  }

  if (message.length > 1600) {
    return NextResponse.json({ error: "Сообщение слишком длинное (максимум 1600 символов)." }, { status: 400 });
  }

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, phone")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: clientError?.message || "Клиент не найден." }, { status: 404 });
  }

  const recipient = normalizePhone(client.phone || "", defaultCountryCode);
  if (!recipient) {
    return NextResponse.json({ error: "У клиента не указан корректный телефон." }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_SMS_FROM;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      {
        error: "Автоматическая отправка ещё не настроена: добавьте TWILIO_ACCOUNT_SID и TWILIO_AUTH_TOKEN в Vercel/локальный .env.local.",
        provider_not_configured: true,
      },
      { status: 503 }
    );
  }

  if (channel === "sms" && !smsFrom && !messagingServiceSid) {
    return NextResponse.json({ error: "Не указан TWILIO_SMS_FROM или TWILIO_MESSAGING_SERVICE_SID." }, { status: 503 });
  }

  if (channel === "whatsapp" && !whatsappFrom) {
    return NextResponse.json({ error: "Не указан TWILIO_WHATSAPP_FROM." }, { status: 503 });
  }

  const { data: log, error: logError } = await supabaseAdmin
    .from("client_messages")
    .insert({
      client_id: clientId,
      work_order_id: workOrderId,
      channel,
      recipient,
      body: message,
      status: "queued",
      provider: "twilio",
      sent_by: auth.user.id,
    })
    .select("id")
    .single();

  if (logError || !log) {
    return NextResponse.json({ error: logError?.message || "Не удалось создать запись сообщения." }, { status: 500 });
  }

  const params = new URLSearchParams();
  params.set("To", channel === "whatsapp" ? `whatsapp:${recipient}` : recipient);

  if (channel === "whatsapp") {
    params.set("From", whatsappFrom!.startsWith("whatsapp:") ? whatsappFrom! : `whatsapp:${whatsappFrom}`);
    const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
    if (contentSid) {
      params.set("ContentSid", contentSid);
      params.set("ContentVariables", JSON.stringify({ "1": message }));
    } else {
      params.set("Body", message);
    }
  } else {
    params.set("Body", message);
    if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
    else params.set("From", smsFrom!);
  }

  const baseUrl = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const webhookSecret = process.env.TWILIO_WEBHOOK_SECRET;
  if (baseUrl && webhookSecret) {
    params.set(
      "StatusCallback",
      `${baseUrl}/api/communications/twilio/status?token=${encodeURIComponent(webhookSecret)}`
    );
  }

  const twilioResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      cache: "no-store",
    }
  );

  const twilioData = await twilioResponse.json();

  if (!twilioResponse.ok) {
    await supabaseAdmin
      .from("client_messages")
      .update({
        status: "failed",
        error_message: twilioData.message || "Twilio rejected the message",
        metadata: twilioData,
      })
      .eq("id", log.id);

    return NextResponse.json(
      { error: twilioData.message || "Не удалось отправить сообщение." },
      { status: 502 }
    );
  }

  await supabaseAdmin
    .from("client_messages")
    .update({
      status: twilioData.status === "queued" ? "queued" : "sent",
      provider_message_id: twilioData.sid,
      sent_at: new Date().toISOString(),
      metadata: twilioData,
    })
    .eq("id", log.id);

  return NextResponse.json({
    success: true,
    message: {
      id: log.id,
      provider_message_id: twilioData.sid,
      status: twilioData.status,
      channel,
      recipient,
    },
  });
}
