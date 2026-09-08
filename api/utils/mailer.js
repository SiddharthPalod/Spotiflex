import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

export function getMailer() {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASSWORD;
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  // 1. Google OAuth2 Mode for Desktop / Web Client IDs (if Refresh Token is present)
  if (user && clientId && clientSecret && refreshToken) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user,
        clientId,
        clientSecret,
        refreshToken,
      },
    });
    console.log('📧 Mailer initialized with Gmail OAuth2 (Desktop Client credentials).');
    return transporter;
  }

  // 2. Standard Gmail Password / App Password Mode
  if (user && pass) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user,
        pass,
      },
    });
    console.log('📧 Mailer initialized with Gmail SSL SMTP.');
    return transporter;
  }

  console.warn('⚠️ Neither Gmail OAuth2 nor GMAIL_PASSWORD set in .env. OTP will only be logged in console.');
  return null;
}

/**
 * Sends a clean, deliverability-optimized OTP verification email
 */
export async function sendOtpEmail(toEmail, otpCode) {
  const mailer = getMailer();

  if (!mailer) {
    console.log(`[Dev Mailer] Simulated sending OTP to ${toEmail}: ${otpCode}`);
    return;
  }

  const senderAddress = process.env.GMAIL_USER || 'goldjain2@gmail.com';
  const senderName = 'Spotiflex';

  // Plain text version (clean, natural, no spam trigger words)
  const textContent = `Hi,

Here is your verification code for Spotiflex:

${otpCode}

This code will expire in 10 minutes.

Thanks,
The Spotiflex Team`;

  // Clean, lightweight, inbox-friendly HTML
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Spotiflex Code</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="480" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #09090b; padding: 20px 28px; text-align: left;">
              <span style="font-size: 20px; font-weight: 800; letter-spacing: 1.5px; color: #1DB954;">SPOTIFLEX</span>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 28px 32px 28px; text-align: left;">
              <h2 style="font-size: 18px; font-weight: 700; color: #09090b; margin: 0 0 12px 0;">Your Verification Code</h2>
              <p style="font-size: 14px; line-height: 1.5; color: #52525b; margin: 0 0 20px 0;">
                Here is your 6-digit code to complete your Spotiflex verification:
              </p>
              
              <!-- Clean Code Box -->
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 20px 0;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #16a34a; font-family: 'Courier New', Courier, monospace;">${otpCode}</span>
              </div>

              <p style="font-size: 12px; line-height: 1.5; color: #71717a; margin: 0;">
                This code expires in 10 minutes. If you did not make this request, you can safely disregard this message.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 14px 28px; border-top: 1px solid #f4f4f5; text-align: center; font-size: 11px; color: #a1a1aa;">
              Spotiflex Team
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const mailOptions = {
    from: senderAddress,
    to: toEmail,
    subject: `Spotiflex Code: ${otpCode}`,
    text: `Your Spotiflex verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.`,
    html: `<div style="font-family: Arial, sans-serif; padding: 20px; color: #111; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #1DB954; margin-top: 0;">Spotiflex</h2>
  <p>Your verification code is:</p>
  <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #111; background-color: #f1f5f9; padding: 12px 20px; border-radius: 6px; display: inline-block; margin: 10px 0;">
    ${otpCode}
  </div>
  <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
    This code is valid for 10 minutes. If you did not request this, please ignore this message.
  </p>
</div>`,
  };

  try {
    const info = await mailer.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send OTP email to ${toEmail}:`, error.message);
  }
}
