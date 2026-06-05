/**
 * Receives a chat message from the frontend and forwards it to the site owner
 * via a Telegram bot.
 *
 * POST /chat/send
 * Body: { message: string, phone?: string, email?: string }
 *
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to be set as secrets.
 */
export async function onRequest(context) {
  // Only accept POST
  if (context.request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const botToken = context.env.TELEGRAM_BOT_TOKEN;
  const chatId = context.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return Response.json(
      { error: "Telegram not configured on the server." },
      { status: 200 },
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message || message.length > 2000) {
    return Response.json(
      { error: "Message must be between 1 and 2000 characters." },
      { status: 400 },
    );
  }

  const phone = body.phone?.trim();
  const email = body.email?.trim();

  // Build the notification text
  const parts = [`📩 *New message from your portfolio!*`, ``];

  if (phone) {
    parts.push(`*Phone:* ${escapeMarkdown(phone)}`);
  }
  if (email) {
    parts.push(`*Email:* ${escapeMarkdown(email)}`);
  }
  if (phone || email) {
    parts.push(``);
  }

  parts.push(`*Message:*`);
  parts.push(`${escapeMarkdown(message)}`);
  parts.push(``);
  parts.push(`_Received at ${new Date().toISOString()}_`);

  const text = parts.join("\n");

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const result = await resp.json();

    if (!result.ok) {
      console.error("Telegram API error:", result);
      return Response.json(
        { error: "Failed to send message via Telegram." },
        { status: 502 },
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Telegram fetch error:", err);
    return Response.json(
      { error: "Could not reach Telegram API." },
      { status: 502 },
    );
  }
}

function escapeMarkdown(str) {
  return str.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
