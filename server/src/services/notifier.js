/**
 * Notification service — email (SMTP) and WhatsApp hooks.
 *
 * Configure via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL_TO
 *   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TO
 *
 * When credentials are absent the service logs to stdout and resolves,
 * so the API stays usable in local development.
 */

async function sendEmail(subject, lines) {
    const host = process.env.SMTP_HOST;
    if (!host) {
        // Do not dump names, emails, or phone numbers into server logs.
        console.log('[notifier:email] (dry run) ' + subject + ' · ' + lines.length + ' fields');
        if (process.env.NOTIFIER_DEBUG === 'true') lines.forEach((line) => console.log('    ' + line));
        return { delivered: false, channel: 'email', reason: 'SMTP not configured' };
    }

    // Lazy require so the dependency is optional in dev.
    let nodemailer;
    try {
        nodemailer = require('nodemailer');
    } catch (_e) {
        console.warn('[notifier:email] nodemailer not installed; skipping send.');
        return { delivered: false, channel: 'email', reason: 'nodemailer missing' };
    }

    const transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined
    });

    await transport.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@ardsonmaritime.com',
        to: process.env.NOTIFY_EMAIL_TO || 'ardsonmaritime@outlook.com',
        subject: '[Ardson Maritime] ' + subject,
        text: lines.join('\n')
    });

    return { delivered: true, channel: 'email' };
}

async function sendWhatsApp(subject, lines) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const to = process.env.WHATSAPP_TO;

    if (!token || !phoneId || !to) {
        console.log('[notifier:whatsapp] (dry run) ' + subject);
        return { delivered: false, channel: 'whatsapp', reason: 'WhatsApp API not configured' };
    }

    const response = await fetch(
        'https://graph.facebook.com/v19.0/' + phoneId + '/messages',
        {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: '*[Ardson Maritime] ' + subject + '*\n\n' + lines.join('\n') }
            })
        }
    );

    if (!response.ok) {
        const detail = await response.text();
        throw new Error('WhatsApp send failed: ' + response.status + ' ' + detail);
    }
    return { delivered: true, channel: 'whatsapp' };
}

/**
 * Fan out a notification to every configured channel.
 * Failures on one channel never reject the whole promise.
 */
async function sendNotification({ subject, lines }) {
    const results = await Promise.allSettled([
        sendEmail(subject, lines),
        sendWhatsApp(subject, lines)
    ]);
    return results.map((r) => (r.status === 'fulfilled' ? r.value : { delivered: false, error: String(r.reason) }));
}

module.exports = { sendNotification, sendEmail, sendWhatsApp };