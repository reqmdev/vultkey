"use client";

import { useEffect, useRef } from "react";

type BotAction = "login" | "signup" | "forgot_password";

export type BotProtectionTokens = {
  turnstileToken?: string;
  recaptchaToken?: string;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove?: (widgetId: string) => void;
};

type GrecaptchaApi = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    grecaptcha?: GrecaptchaApi;
  }
}

const turnstileSiteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

let turnstileScript: Promise<void> | null = null;
let recaptchaScript: Promise<void> | null = null;

function loadScript(id: string, src: string) {
  if (document.getElementById(id)) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Bot doğrulama scripti yüklenemedi."));
    document.head.appendChild(script);
  });
}

function loadTurnstile() {
  turnstileScript ??= loadScript("cloudflare-turnstile-api", "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  return turnstileScript;
}

function loadRecaptcha() {
  if (!recaptchaSiteKey) return Promise.resolve();
  recaptchaScript ??= loadScript("google-recaptcha-v3-api", `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`);
  return recaptchaScript;
}

async function executeRecaptcha(action: BotAction) {
  if (!recaptchaSiteKey) return undefined;

  await loadRecaptcha();
  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) throw new Error("Google reCAPTCHA hazırlanamadı.");

  return new Promise<string>((resolve, reject) => {
    grecaptcha.ready(() => {
      grecaptcha.execute(recaptchaSiteKey, { action }).then(resolve).catch(() => reject(new Error("Google reCAPTCHA doğrulaması alınamadı.")));
    });
  });
}

export async function getBotProtectionTokens(action: BotAction, turnstileToken: string | null): Promise<BotProtectionTokens> {
  const tokens: BotProtectionTokens = {};

  if (turnstileSiteKey) {
    if (!turnstileToken) throw new Error("Cloudflare doğrulaması tamamlanmadı.");
    tokens.turnstileToken = turnstileToken;
  }

  const recaptchaToken = await executeRecaptcha(action);
  if (recaptchaToken) tokens.recaptchaToken = recaptchaToken;

  return tokens;
}

export function BotProtection({ action, resetSignal, onTurnstileTokenChange }: { action: BotAction; resetSignal: number; onTurnstileTokenChange: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const hasTurnstile = Boolean(turnstileSiteKey);

  function resetTurnstile() {
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
  }

  useEffect(() => {
    if (!hasTurnstile || !turnstileSiteKey || !containerRef.current) return;

    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        if (widgetIdRef.current) window.turnstile.remove?.(widgetIdRef.current);

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: turnstileSiteKey,
          action,
          theme: "auto",
          callback: onTurnstileTokenChange,
          "expired-callback": () => onTurnstileTokenChange(null),
          "error-callback": () => onTurnstileTokenChange(null)
        });
      })
      .catch(() => onTurnstileTokenChange(null));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove?.(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [action, hasTurnstile, onTurnstileTokenChange]);

  useEffect(() => {
    resetTurnstile();
  }, [resetSignal]);

  if (!hasTurnstile) return null;

  return (
    <div className="flex min-h-[65px] justify-center">
      <div ref={containerRef} />
    </div>
  );
}

export function RecaptchaNotice() {
  if (!recaptchaSiteKey) return null;

  return (
    <p className="border-t border-border/70 pt-4 text-center text-[11px] leading-5 text-muted-foreground">
      Bu form, otomatik denemeleri azaltmak için Google reCAPTCHA v3 ile korunur.
    </p>
  );
}
