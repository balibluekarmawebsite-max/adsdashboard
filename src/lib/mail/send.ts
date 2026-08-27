import nodemailer, { type Transporter } from "nodemailer";

// Thin SMTP mailer. Reads SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS and
// MAIL_FROM from the environment (cPanel gives you these for any mailbox).
// When it isn't configured, sends are a logged no-op instead of a crash.

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}

let cached: Transporter | null = null;

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function mailFrom(): string {
  return process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "no-reply@localhost";
}

function transporter(): Transporter | null {
  if (cached) return cached;
  if (!mailConfigured()) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587/25 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

/** Parse a comma/semicolon/whitespace-separated recipient string into emails. */
export function parseRecipients(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    ),
  );
}

export async function sendMail(opts: MailOptions): Promise<{ ok: boolean; error?: string }> {
  const t = transporter();
  if (!t) {
    console.warn(
      "[mail] SMTP not configured — skipping send. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS and MAIL_FROM.",
    );
    return { ok: false, error: "Email isn't configured on the server (SMTP_* environment variables)." };
  }
  const to = opts.to.map((e) => e.trim()).filter(Boolean);
  if (to.length === 0) return { ok: false, error: "No valid recipients." };

  try {
    await t.sendMail({
      from: mailFrom(),
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[mail] send failed:", error);
    return { ok: false, error };
  }
}
