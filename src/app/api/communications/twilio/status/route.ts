import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const expected = process.env.TWILIO_WEBHOOK_SECRET;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const sid = String(form.get("MessageSid") || "");
  const twilioStatus = String(form.get("MessageStatus") || "");
  const errorMessage = String(form.get("ErrorMessage") || "") || null;

  if (!sid) {
    return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
  }

  const mappedStatus =
    twilioStatus === "delivered" || twilioStatus === "read"
      ? "delivered"
      : twilioStatus === "failed" || twilioStatus === "undelivered"
      ? "failed"
      : twilioStatus === "sent"
      ? "sent"
      : "queued";

  const { error } = await supabaseAdmin
    .from("client_messages")
    .update({
      status: mappedStatus,
      error_message: errorMessage,
      delivered_at: mappedStatus === "delivered" ? new Date().toISOString() : null,
      metadata: { twilio_status: twilioStatus },
    })
    .eq("provider_message_id", sid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
