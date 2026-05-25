import { cn } from "@/lib/utils";
import type { IconType } from "react-icons";
import { FaAmazon, FaApple, FaAws, FaDiscord, FaGamepad, FaGithub, FaGitlab, FaGoogle, FaMicrosoft, FaXbox } from "react-icons/fa6";
import { MdApps, MdCardGiftcard, MdCloud, MdCode, MdConfirmationNumber, MdDesktopWindows, MdKey, MdStorefront, MdSubscriptions, MdVpnKey } from "react-icons/md";
import {
  Si1Password,
  SiAnthropic,
  SiAutodesk,
  SiBattledotnet,
  SiBitwarden,
  SiCanva,
  SiCloudflare,
  SiDigitalocean,
  SiDocker,
  SiEa,
  SiEpicgames,
  SiFigma,
  SiFirebase,
  SiGogdotcom,
  SiGooglecloud,
  SiHeroku,
  SiItchdotio,
  SiJetbrains,
  SiMailgun,
  SiNetflix,
  SiNetlify,
  SiNpm,
  SiNordvpn,
  SiNotion,
  SiOpenai,
  SiPlaystation,
  SiProton,
  SiResend,
  SiRiotgames,
  SiRockstargames,
  SiSendgrid,
  SiSlack,
  SiSpotify,
  SiSteam,
  SiStripe,
  SiSupabase,
  SiTwilio,
  SiUbisoft,
  SiVercel,
  SiYoutube
} from "react-icons/si";

type PlatformIconKind =
  | "steam"
  | "epic"
  | "gog"
  | "playstation"
  | "xbox"
  | "itch"
  | "battlenet"
  | "ubisoft"
  | "ea"
  | "rockstar"
  | "riot"
  | "nintendo"
  | "openai"
  | "anthropic"
  | "github"
  | "gitlab"
  | "docker"
  | "npm"
  | "stripe"
  | "twilio"
  | "sendgrid"
  | "mailgun"
  | "resend"
  | "aws"
  | "azure"
  | "googlecloud"
  | "cloudflare"
  | "vercel"
  | "netlify"
  | "supabase"
  | "firebase"
  | "digitalocean"
  | "heroku"
  | "microsoft"
  | "windows"
  | "apple"
  | "google"
  | "amazon"
  | "adobe"
  | "jetbrains"
  | "autodesk"
  | "canva"
  | "figma"
  | "notion"
  | "slack"
  | "discord"
  | "onepassword"
  | "bitwarden"
  | "nordvpn"
  | "proton"
  | "vpn"
  | "spotify"
  | "netflix"
  | "youtube"
  | "api"
  | "cloud"
  | "gift"
  | "coupon"
  | "subscription"
  | "license"
  | "other";

function platformKind(platform: string): PlatformIconKind {
  const value = platform.toLowerCase().trim();

  if (value.includes("steam")) return "steam";
  if (value.includes("epic")) return "epic";
  if (value.includes("gog")) return "gog";
  if (value.includes("playstation") || value.includes("psn") || value === "ps") return "playstation";
  if (value.includes("xbox")) return "xbox";
  if (value.includes("itch")) return "itch";
  if (value.includes("battle")) return "battlenet";
  if (value.includes("ubisoft")) return "ubisoft";
  if (value === "ea" || value.includes("ea app")) return "ea";
  if (value.includes("rockstar")) return "rockstar";
  if (value.includes("riot")) return "riot";
  if (value.includes("nintendo")) return "nintendo";

  if (value.includes("openai")) return "openai";
  if (value.includes("anthropic") || value.includes("claude")) return "anthropic";
  if (value.includes("github")) return "github";
  if (value.includes("gitlab")) return "gitlab";
  if (value.includes("docker")) return "docker";
  if (value === "npm" || value.includes("npm")) return "npm";
  if (value.includes("stripe")) return "stripe";
  if (value.includes("twilio")) return "twilio";
  if (value.includes("sendgrid")) return "sendgrid";
  if (value.includes("mailgun")) return "mailgun";
  if (value.includes("resend")) return "resend";

  if (value === "aws" || value.includes("amazon web services")) return "aws";
  if (value.includes("azure")) return "azure";
  if (value.includes("google cloud") || value === "gcp") return "googlecloud";
  if (value.includes("cloudflare")) return "cloudflare";
  if (value.includes("vercel")) return "vercel";
  if (value.includes("netlify")) return "netlify";
  if (value.includes("supabase")) return "supabase";
  if (value.includes("firebase")) return "firebase";
  if (value.includes("digitalocean")) return "digitalocean";
  if (value.includes("heroku")) return "heroku";

  if (value.includes("microsoft") || value.includes("office")) return "microsoft";
  if (value.includes("windows")) return "windows";
  if (value.includes("apple")) return "apple";
  if (value.includes("google play") || value === "google") return "google";
  if (value.includes("amazon")) return "amazon";
  if (value.includes("adobe")) return "adobe";
  if (value.includes("jetbrains")) return "jetbrains";
  if (value.includes("autodesk")) return "autodesk";
  if (value.includes("canva")) return "canva";
  if (value.includes("figma")) return "figma";
  if (value.includes("notion")) return "notion";
  if (value.includes("slack")) return "slack";
  if (value.includes("discord")) return "discord";

  if (value.includes("1password")) return "onepassword";
  if (value.includes("bitwarden")) return "bitwarden";
  if (value.includes("nordvpn")) return "nordvpn";
  if (value.includes("proton")) return "proton";
  if (value.includes("vpn")) return "vpn";

  if (value.includes("spotify")) return "spotify";
  if (value.includes("netflix")) return "netflix";
  if (value.includes("youtube")) return "youtube";

  if (value.includes("api")) return "api";
  if (value.includes("cloud")) return "cloud";
  if (value.includes("gift") || value.includes("hediye") || value.includes("card") || value.includes("kart")) return "gift";
  if (value.includes("coupon") || value.includes("kupon") || value.includes("promo") || value.includes("indirim")) return "coupon";
  if (value.includes("subscription") || value.includes("abonelik")) return "subscription";
  if (value.includes("license") || value.includes("lisans") || value.includes("serial") || value.includes("seri") || value.includes("ürün anahtarı")) return "license";

  return "other";
}

const platformIcons: Record<PlatformIconKind, IconType> = {
  steam: SiSteam,
  epic: SiEpicgames,
  gog: SiGogdotcom,
  playstation: SiPlaystation,
  xbox: FaXbox,
  itch: SiItchdotio,
  battlenet: SiBattledotnet,
  ubisoft: SiUbisoft,
  ea: SiEa,
  rockstar: SiRockstargames,
  riot: SiRiotgames,
  nintendo: FaGamepad,
  openai: SiOpenai,
  anthropic: SiAnthropic,
  github: FaGithub,
  gitlab: FaGitlab,
  docker: SiDocker,
  npm: SiNpm,
  stripe: SiStripe,
  twilio: SiTwilio,
  sendgrid: SiSendgrid,
  mailgun: SiMailgun,
  resend: SiResend,
  aws: FaAws,
  azure: FaMicrosoft,
  googlecloud: SiGooglecloud,
  cloudflare: SiCloudflare,
  vercel: SiVercel,
  netlify: SiNetlify,
  supabase: SiSupabase,
  firebase: SiFirebase,
  digitalocean: SiDigitalocean,
  heroku: SiHeroku,
  microsoft: FaMicrosoft,
  windows: MdDesktopWindows,
  apple: FaApple,
  google: FaGoogle,
  amazon: FaAmazon,
  adobe: MdApps,
  jetbrains: SiJetbrains,
  autodesk: SiAutodesk,
  canva: SiCanva,
  figma: SiFigma,
  notion: SiNotion,
  slack: SiSlack,
  discord: FaDiscord,
  onepassword: Si1Password,
  bitwarden: SiBitwarden,
  nordvpn: SiNordvpn,
  proton: SiProton,
  vpn: MdVpnKey,
  spotify: SiSpotify,
  netflix: SiNetflix,
  youtube: SiYoutube,
  api: MdCode,
  cloud: MdCloud,
  gift: MdCardGiftcard,
  coupon: MdConfirmationNumber,
  subscription: MdSubscriptions,
  license: MdKey,
  other: MdStorefront
};

export function PlatformLogo({ platform, className }: { platform: string; className?: string }) {
  const Icon = platformIcons[platformKind(platform)];

  return (
    <span className={cn("inline-flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground", className)}>
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
