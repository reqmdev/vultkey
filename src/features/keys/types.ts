import type { CategoryColor, KeyStatus, PublicKeyLinkAccessMode, PublicKeyLinkStatus, PublicKeyLinkType, PublicKeyViewMode } from "@/types/database";

export type VaultCategory = {
  id: string;
  parentId: string | null;
  name: string;
  color: CategoryColor;
  sortOrder: number;
  keyCount?: number;
  publicLink?: VaultPublicLink | null;
};

export type VaultTag = {
  id: string;
  name: string;
  keyCount?: number;
};

export type VaultPublicLink = {
  id: string;
  type: PublicKeyLinkType;
  viewMode: PublicKeyViewMode;
  accessMode: PublicKeyLinkAccessMode;
  status: PublicKeyLinkStatus;
  title: string | null;
  claimCount: number;
  maxClaims: number;
  expiresAt: string | null;
  disabledAt: string | null;
};

export type VaultKey = {
  id: string;
  title: string;
  platform: string;
  status: KeyStatus;
  keyMask: string;
  source: string | null;
  notes: string | null;
  categoryId: string | null;
  category: VaultCategory | null;
  tags: VaultTag[];
  redeemedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  publicLink: VaultPublicLink | null;
};

export type AuditLog = {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

export type PublicClaimLog = {
  id: string;
  linkId: string | null;
  keyId: string | null;
  status: string;
  recipientEmail: string | null;
  recipientLabel: string | null;
  recipientUserId: string | null;
  recipientMemberEmail: string | null;
  countryCode: string | null;
  deviceType: string | null;
  osName: string | null;
  osVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  clientPlatform: string | null;
  timezone: string | null;
  language: string | null;
  keyTitle: string | null;
  platform: string | null;
  keyMask: string | null;
  reservedAt: string;
  redeemedAt: string | null;
};
