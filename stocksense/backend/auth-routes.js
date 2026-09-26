import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { isEmailConfigured, sendAuthCode } from "./email.js";

const COOKIE_NAME = "stocksense_session";
const CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const emailCooldowns = new Map();

function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function setSession(res, userId) {
    const token = jwt.sign({ userId }, process.env.SESSION_SECRET, { expiresIn: "7d" });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
    });
}

export function auth(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Please sign in." });

    try {
        const payload = jwt.verify(token, process.env.SESSION_SECRET);
        if (typeof payload.userId !== "string") throw new Error("Invalid session.");
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
}

function cooldownRemaining(key) {
    const until = emailCooldowns.get(key) || 0;
    return Math.max(0, until - Date.now());
}

function setCooldown(key) {
    emailCooldowns.set(key, Date.now() + RESEND_INTERVAL_MS);
}

async function saveVerificationCode(prisma, user) {
    const code = String(crypto.randomInt(100000, 1000000));
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.emailVerificationToken.create({
        data: {
            userId: user.id,
            codeHash: await bcrypt.hash(code, 10),
            expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
        },
    });
    await sendAuthCode({ to: user.email, code, purpose: "verification" });
    setCooldown(`verify:${user.id}`);
}

async function saveResetCode(prisma, user) {
    const code = String(crypto.randomInt(100000, 1000000));
    await prisma.resetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.resetToken.create({
        data: {
            userId: user.id,
            codeHash: await bcrypt.hash(code, 10),
            expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
        },
    });
    await sendAuthCode({ to: user.email, code, purpose: "reset" });
    setCooldown(`reset:${user.id}`);
}

export function createAuthRouter(prisma) {
    const router = Router();

    router.post("/signup", async (req, res) => {
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
        const email = normalizeEmail(req.body?.email);
        const password = req.body?.password;

        if (!name || !validEmail(email) || typeof password !== "string") {
            return res.status(400).json({ error: "Enter your name, a valid email, and a password." });
        }
        if (name.length > 120 || password.length < 8 || password.length > 128) {
            return res.status(400).json({ error: "Use a name under 120 characters and a password between 8 and 128 characters." });
        }
        if (!isEmailConfigured()) {
            return res.status(503).json({ error: "Email verification is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD." });
        }

        let user;
        try {
            user = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        name,
                        email,
                        passwordHash: await bcrypt.hash(password, 12),
                        role: "WAREHOUSE_STAFF",
                    },
                });
                const warehouse = await tx.warehouse.create({
                    data: { userId: created.id, name: "Main Warehouse", shortCode: "MAIN" },
                });
                await tx.location.create({
                    data: { warehouseId: warehouse.id, name: "Main Store", shortCode: "STORE" },
                });
                return created;
            });
        } catch (error) {
            if (error.code === "P2002") {
                return res.status(409).json({ error: "An account with this email already exists. Sign in or request a verification code." });
            }
            console.error("Account creation failed:", error.message);
            return res.status(500).json({ error: "Could not create your account. Please try again." });
        }

        try {
            await saveVerificationCode(prisma, user);
        } catch (error) {
            console.error("Verification email delivery failed:", error.message);
            return res.status(503).json({
                error: "Your account was created, but the verification email could not be sent. Use resend code to try again.",
                verificationRequired: true,
                email,
            });
        }

        res.status(201).json({ verificationRequired: true, email });
    });

    router.post("/verify-email", async (req, res) => {
        const email = normalizeEmail(req.body?.email);
        const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
        if (!validEmail(email) || !/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: "Enter a valid email and the 6-digit code." });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.emailVerifiedAt) {
            return res.status(400).json({ error: "This verification code is invalid or expired." });
        }

        const verifiedUser = await prisma.$transaction(async (tx) => {
            const token = await tx.emailVerificationToken.findFirst({
                where: { userId: user.id, usedAt: null, attemptCount: { lt: MAX_CODE_ATTEMPTS }, expiresAt: { gt: new Date() } },
                orderBy: { createdAt: "desc" },
            });
            if (!token) return null;
            if (!(await bcrypt.compare(code, token.codeHash))) {
                await tx.emailVerificationToken.updateMany({
                    where: { id: token.id, usedAt: null, attemptCount: { lt: MAX_CODE_ATTEMPTS } },
                    data: { attemptCount: { increment: 1 } },
                });
                return null;
            }

            const consumed = await tx.emailVerificationToken.updateMany({
                where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
                data: { usedAt: new Date() },
            });
            if (consumed.count !== 1) return null;

            return tx.user.update({
                where: { id: user.id },
                data: { emailVerifiedAt: new Date() },
            });
        });

        if (!verifiedUser) return res.status(400).json({ error: "This verification code is invalid or expired." });
        setSession(res, verifiedUser.id);
        res.json({ user: publicUser(verifiedUser) });
    });

    router.post("/resend-verification", async (req, res) => {
        const email = normalizeEmail(req.body?.email);
        if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
        if (!isEmailConfigured()) {
            return res.status(503).json({ error: "Email verification is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD." });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.emailVerifiedAt) {
            return res.json({ message: "If this account needs verification, a code has been emailed." });
        }

        if (cooldownRemaining(`verify:${user.id}`) > 0) {
            return res.status(429).json({ error: "Wait one minute before requesting another code." });
        }

        try {
            await saveVerificationCode(prisma, user);
        } catch (error) {
            console.error("Verification email delivery failed:", error.message);
            return res.status(503).json({ error: "The verification email could not be sent. Please try again." });
        }
        res.json({ message: "If this account needs verification, a code has been emailed." });
    });

    router.post("/login", async (req, res) => {
        const email = normalizeEmail(req.body?.email);
        const password = req.body?.password;
        if (!validEmail(email) || typeof password !== "string") {
            return res.status(400).json({ error: "Email and password are required." });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: "Invalid email or password." });
        }
        if (!user.emailVerifiedAt) {
            return res.status(403).json({ error: "Verify your email before signing in. Request a new code from account creation." });
        }

        setSession(res, user.id);
        res.json({ user: publicUser(user) });
    });

    router.get("/me", auth, async (req, res) => {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user || !user.emailVerifiedAt) {
            res.clearCookie(COOKIE_NAME, { path: "/" });
            return res.status(401).json({ error: "Please sign in." });
        }
        res.json({ user: publicUser(user) });
    });

    router.post("/logout", (_req, res) => {
        res.clearCookie(COOKIE_NAME, { path: "/" });
        res.json({ ok: true });
    });

    router.post("/otp/request", async (req, res) => {
        const email = normalizeEmail(req.body?.email);
        if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
        if (!isEmailConfigured()) {
            return res.status(503).json({ error: "Email delivery is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD." });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.emailVerifiedAt) {
            return res.json({ message: "If the account exists, a reset code has been sent." });
        }
        if (cooldownRemaining(`reset:${user.id}`) > 0) {
            return res.status(429).json({ error: "Wait one minute before requesting another code." });
        }

        try {
            await saveResetCode(prisma, user);
        } catch (error) {
            console.error("Password reset email delivery failed:", error.message);
            return res.status(503).json({ error: "The reset email could not be sent. Please try again." });
        }
        res.json({ message: "If the account exists, a reset code has been sent." });
    });

    router.post("/otp/verify", async (req, res) => {
        const email = normalizeEmail(req.body?.email);
        const code = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
        const user = validEmail(email) ? await prisma.user.findUnique({ where: { email } }) : null;
        const reset = user
            ? await prisma.resetToken.findFirst({
                where: { userId: user.id, usedAt: null, attemptCount: { lt: MAX_CODE_ATTEMPTS }, expiresAt: { gt: new Date() } },
                orderBy: { createdAt: "desc" },
            })
            : null;

        if (!reset) return res.status(400).json({ error: "Invalid or expired OTP." });
        if (!/^\d{6}$/.test(code) || !(await bcrypt.compare(code, reset.codeHash))) {
            await prisma.resetToken.updateMany({
                where: { id: reset.id, usedAt: null, attemptCount: { lt: MAX_CODE_ATTEMPTS } },
                data: { attemptCount: { increment: 1 } },
            });
            return res.status(400).json({ error: "Invalid or expired OTP." });
        }
        res.json({ ok: true });
    });

    router.post("/otp/reset", async (req, res) => {
        const email = normalizeEmail(req.body?.email);
        const code = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
        const newPassword = req.body?.newPassword;
        if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
            return res.status(400).json({ error: "Use a password between 8 and 128 characters." });
        }
        const user = validEmail(email) ? await prisma.user.findUnique({ where: { email } }) : null;
        const reset = user
            ? await prisma.resetToken.findFirst({
                where: { userId: user.id, usedAt: null, attemptCount: { lt: MAX_CODE_ATTEMPTS }, expiresAt: { gt: new Date() } },
                orderBy: { createdAt: "desc" },
            })
            : null;

        if (!reset) return res.status(400).json({ error: "Invalid or expired OTP." });
        if (!/^\d{6}$/.test(code) || !(await bcrypt.compare(code, reset.codeHash))) {
            await prisma.resetToken.updateMany({
                where: { id: reset.id, usedAt: null, attemptCount: { lt: MAX_CODE_ATTEMPTS } },
                data: { attemptCount: { increment: 1 } },
            });
            return res.status(400).json({ error: "Invalid or expired OTP." });
        }

        const changed = await prisma.$transaction(async (tx) => {
            const consumed = await tx.resetToken.updateMany({
                where: { id: reset.id, usedAt: null, attemptCount: { lt: MAX_CODE_ATTEMPTS }, expiresAt: { gt: new Date() } },
                data: { usedAt: new Date() },
            });
            if (consumed.count !== 1) return false;
            await tx.user.update({
                where: { id: user.id },
                data: { passwordHash: await bcrypt.hash(newPassword, 12) },
            });
            return true;
        });

        if (!changed) return res.status(400).json({ error: "Invalid or expired OTP." });
        res.json({ ok: true });
    });

    return router;
}