export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type KeyStatus = "available" | "reserved" | "redeemed" | "archived";
export type CategoryColor = "slate" | "violet" | "blue" | "emerald" | "amber" | "rose" | "cyan";
export type PublicKeyLinkType = "single" | "category";
export type PublicKeyViewMode = "single" | "drop" | "list";
export type PublicKeyLinkAccessMode = "anyone" | "email_allowlist" | "member_allowlist";
export type PublicKeyLinkStatus = "active" | "disabled";
export type PublicKeyClaimStatus = "reserved" | "redeemed" | "cancelled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: never;
          full_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          parent_id: string | null;
          name: string;
          color: CategoryColor;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_id?: string | null;
          name: string;
          color?: CategoryColor;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          parent_id?: string | null;
          name?: string;
          color?: CategoryColor;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      keys: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          title: string;
          platform: string;
          status: KeyStatus;
          encrypted_key: string;
          encryption_iv: string;
          encryption_tag: string;
          key_hash: string;
          key_mask: string;
          source: string | null;
          notes: string | null;
          redeemed_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          title: string;
          platform?: string;
          status?: KeyStatus;
          encrypted_key: string;
          encryption_iv: string;
          encryption_tag: string;
          key_hash: string;
          key_mask: string;
          source?: string | null;
          notes?: string | null;
          redeemed_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          title?: string;
          platform?: string;
          status?: KeyStatus;
          encrypted_key?: string;
          encryption_iv?: string;
          encryption_tag?: string;
          key_hash?: string;
          key_mask?: string;
          source?: string | null;
          notes?: string | null;
          redeemed_at?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      key_tags: {
        Row: {
          key_id: string;
          tag_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          key_id: string;
          tag_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      public_key_links: {
        Row: {
          id: string;
          user_id: string;
          key_id: string | null;
          category_id: string | null;
          link_type: PublicKeyLinkType;
          view_mode: PublicKeyViewMode;
          access_mode: PublicKeyLinkAccessMode;
          require_email_verification: boolean;
          token_hash: string;
          token_ciphertext: string;
          token_iv: string;
          token_tag: string;
          title: string | null;
          message: string | null;
          status: PublicKeyLinkStatus;
          expires_at: string | null;
          max_claims: number;
          claim_count: number;
          include_subcategories: boolean;
          visibility_config: Json;
          permission_config: Json;
          disabled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key_id?: string | null;
          category_id?: string | null;
          link_type?: PublicKeyLinkType;
          view_mode?: PublicKeyViewMode;
          access_mode?: PublicKeyLinkAccessMode;
          require_email_verification?: boolean;
          token_hash: string;
          token_ciphertext: string;
          token_iv: string;
          token_tag: string;
          title?: string | null;
          message?: string | null;
          status?: PublicKeyLinkStatus;
          expires_at?: string | null;
          max_claims?: number;
          claim_count?: number;
          include_subcategories?: boolean;
          visibility_config?: Json;
          permission_config?: Json;
          disabled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key_id?: string | null;
          category_id?: string | null;
          link_type?: PublicKeyLinkType;
          view_mode?: PublicKeyViewMode;
          access_mode?: PublicKeyLinkAccessMode;
          require_email_verification?: boolean;
          token_hash?: string;
          token_ciphertext?: string;
          token_iv?: string;
          token_tag?: string;
          title?: string | null;
          message?: string | null;
          status?: PublicKeyLinkStatus;
          expires_at?: string | null;
          max_claims?: number;
          claim_count?: number;
          include_subcategories?: boolean;
          visibility_config?: Json;
          permission_config?: Json;
          disabled_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_key_link_emails: {
        Row: {
          link_id: string;
          user_id: string;
          email: string;
          recipient_user_id: string | null;
          created_at: string;
        };
        Insert: {
          link_id: string;
          user_id: string;
          email: string;
          recipient_user_id?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      public_key_claims: {
        Row: {
          id: string;
          link_id: string | null;
          key_id: string | null;
          user_id: string;
          claim_token_hash: string;
          status: PublicKeyClaimStatus;
          recipient_email: string | null;
          recipient_label: string | null;
          recipient_user_id: string | null;
          recipient_member_email: string | null;
          ip_hash: string | null;
          user_agent_hash: string | null;
          recipient_device_hash: string | null;
          recipient_browser_hash: string | null;
          recipient_request_hash: string | null;
          country_code: string | null;
          device_type: string | null;
          os_name: string | null;
          os_version: string | null;
          browser_name: string | null;
          browser_version: string | null;
          client_platform: string | null;
          timezone: string | null;
          language: string | null;
          key_title_snapshot: string | null;
          platform_snapshot: string | null;
          key_mask_snapshot: string | null;
          reserved_at: string;
          redeemed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          link_id?: string | null;
          key_id?: string | null;
          user_id: string;
          claim_token_hash: string;
          status?: PublicKeyClaimStatus;
          recipient_email?: string | null;
          recipient_label?: string | null;
          recipient_user_id?: string | null;
          recipient_member_email?: string | null;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
          recipient_device_hash?: string | null;
          recipient_browser_hash?: string | null;
          recipient_request_hash?: string | null;
          country_code?: string | null;
          device_type?: string | null;
          os_name?: string | null;
          os_version?: string | null;
          browser_name?: string | null;
          browser_version?: string | null;
          client_platform?: string | null;
          timezone?: string | null;
          language?: string | null;
          key_title_snapshot?: string | null;
          platform_snapshot?: string | null;
          key_mask_snapshot?: string | null;
          reserved_at?: string;
          redeemed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          link_id?: string | null;
          key_id?: string | null;
          status?: PublicKeyClaimStatus;
          recipient_email?: string | null;
          recipient_label?: string | null;
          recipient_user_id?: string | null;
          recipient_member_email?: string | null;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
          recipient_device_hash?: string | null;
          recipient_browser_hash?: string | null;
          recipient_request_hash?: string | null;
          country_code?: string | null;
          device_type?: string | null;
          os_name?: string | null;
          os_version?: string | null;
          browser_name?: string | null;
          browser_version?: string | null;
          client_platform?: string | null;
          timezone?: string | null;
          language?: string | null;
          key_title_snapshot?: string | null;
          platform_snapshot?: string | null;
          key_mask_snapshot?: string | null;
          reserved_at?: string;
          redeemed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          entity_type: string | null;
          entity_id: string | null;
          ip_hash: string | null;
          user_agent_hash: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          ip_hash?: string | null;
          user_agent_hash?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      public_link_preview: {
        Args: { p_token_hash: string };
        Returns: Array<{
          state: string;
          message: string;
          link_type: string | null;
          view_mode: string | null;
          access_mode: string | null;
          require_email_verification: boolean | null;
          title: string | null;
          link_message: string | null;
          max_claims: number | null;
          claim_count: number | null;
          expires_at: string | null;
          visibility_config: Json | null;
          permission_config: Json | null;
          preview_title: string | null;
          preview_platform: string | null;
          preview_key_mask: string | null;
          items: Json | null;
        }>;
      };
      public_link_recipient_status: {
        Args: {
          p_token_hash: string;
          p_ip_hash?: string | null;
          p_user_agent_hash?: string | null;
          p_recipient_device_hash?: string | null;
          p_recipient_browser_hash?: string | null;
          p_recipient_request_hash?: string | null;
          p_recipient_email?: string | null;
        };
        Returns: Array<{
          blocked: boolean;
          message: string | null;
        }>;
      };
      public_link_member_status: {
        Args: { p_token_hash: string };
        Returns: Array<{
          requires_login: boolean;
          allowed: boolean;
          member_email: string | null;
        }>;
      };
      reserve_public_key: {
        Args: {
          p_token_hash: string;
          p_claim_token_hash: string;
          p_recipient_email: string | null;
          p_recipient_label: string | null;
          p_ip_hash: string | null;
          p_user_agent_hash: string | null;
          p_recipient_device_hash?: string | null;
          p_recipient_browser_hash?: string | null;
          p_recipient_request_hash?: string | null;
          p_key_id?: string | null;
          p_country_code?: string | null;
          p_device_type?: string | null;
          p_os_name?: string | null;
          p_os_version?: string | null;
          p_browser_name?: string | null;
          p_browser_version?: string | null;
          p_client_platform?: string | null;
          p_timezone?: string | null;
          p_language?: string | null;
        };
        Returns: Array<{
          ok: boolean;
          message: string;
          link_id: string | null;
          claim_id: string | null;
          key_id: string | null;
          user_id: string | null;
          key_title: string | null;
          platform: string | null;
          encrypted_key: string | null;
          encryption_iv: string | null;
          encryption_tag: string | null;
          can_reveal: boolean | null;
          can_confirm_redeemed: boolean | null;
          can_copy: boolean | null;
        }>;
      };
      confirm_public_redeemed: {
        Args: { p_claim_token_hash: string };
        Returns: Array<{
          ok: boolean;
          message: string;
          link_id: string | null;
          claim_id: string | null;
          key_id: string | null;
          user_id: string | null;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
