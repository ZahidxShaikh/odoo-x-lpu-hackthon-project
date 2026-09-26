import nodemailer from "nodemailer";

let transporter;

export function isEmailConfigured() {
    return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransporter() {
    if (!isEmailConfigured()) {
        throw new Error("Gmail delivery is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.");
    }

    transporter ??= nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, ""),
        },
    });

    return transporter;
}

export async function sendAuthCode({ to, code, purpose }) {
    const verification = purpose === "verification";
    const action = verification ? "verify your email" : "reset your password";

    await getTransporter().sendMail({
        from: `StockSense <${process.env.GMAIL_USER}>`,
        to,
        subject: verification ? "Verify your StockSense email" : "Your StockSense password reset code",
        text: `Use ${code} to ${action}. This code expires in 10 minutes. If you did not request this, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;color:#24332d;max-width:520px;margin:0 auto;padding:32px"><p style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#52745d">STOCKSENSE</p><h1 style="font-size:24px">${verification ? "Verify your email" : "Reset your password"}</h1><p>Use this one-time code to ${action}:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f1f5ed;padding:16px;text-align:center">${code}</p><p style="font-size:13px;color:#66756b">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p></div>`,
    });
}