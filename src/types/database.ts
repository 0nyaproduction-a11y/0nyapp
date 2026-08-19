export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      episodes: {
        Row: {
          id: string;
          series_id: string;
          episode_number: number;
          title: string | null;
          synopsis: string | null;
          duration_seconds: number;
          thumbnail_url: string | null;
          video_asset_id: string | null;
          is_free: boolean;
          coin_price: number;
          status: "draft" | "published" | "archived";
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          episode_number: number;
          title?: string | null;
          synopsis?: string | null;
          duration_seconds?: number;
          thumbnail_url?: string | null;
          video_asset_id?: string | null;
          is_free?: boolean;
          coin_price?: number;
          status?: "draft" | "published" | "archived";
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          episode_number?: number;
          title?: string | null;
          synopsis?: string | null;
          duration_seconds?: number;
          thumbnail_url?: string | null;
          video_asset_id?: string | null;
          is_free?: boolean;
          coin_price?: number;
          status?: "draft" | "published" | "archived";
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "series";
            referencedColumns: ["id"];
          },
        ];
      };
      episode_entitlements: {
        Row: {
          id: string;
          user_id: string;
          episode_id: string;
          source: "purchase" | "rewarded_ad" | "promo" | "admin";
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          episode_id: string;
          source: "purchase" | "rewarded_ad" | "promo" | "admin";
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          episode_id?: string;
          source?: "purchase" | "rewarded_ad" | "promo" | "admin";
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "episode_entitlements_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "episode_entitlements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      coin_transactions: {
        Row: {
          id: string;
          user_id: string | null;
          amount: number;
          transaction_type: "credit" | "episode_purchase" | "refund" | "promo";
          episode_id: string | null;
          payment_order_id: string | null;
          reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          amount: number;
          transaction_type: "credit" | "episode_purchase" | "refund" | "promo";
          episode_id?: string | null;
          payment_order_id?: string | null;
          reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          amount?: number;
          transaction_type?: "credit" | "episode_purchase" | "refund" | "promo";
          episode_id?: string | null;
          payment_order_id?: string | null;
          reference?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coin_transactions_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coin_transactions_payment_order_id_fkey";
            columns: ["payment_order_id"];
            isOneToOne: false;
            referencedRelation: "payment_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coin_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      coin_products: {
        Row: {
          code: string;
          coin_amount: number;
          display_name: string;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          coin_amount: number;
          display_name: string;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          coin_amount?: number;
          display_name?: string;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_orders: {
        Row: {
          id: string;
          user_id: string | null;
          provider: "google_play" | "apple_store" | "web" | "admin_test";
          provider_order_id: string | null;
          provider_transaction_id: string | null;
          product_code: string;
          coin_amount: number;
          amount_minor: number | null;
          currency: string | null;
          status: "pending" | "completed" | "failed" | "refunded" | "cancelled";
          verification_status: "unverified" | "verified" | "rejected";
          verified_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          provider: "google_play" | "apple_store" | "web" | "admin_test";
          provider_order_id?: string | null;
          provider_transaction_id?: string | null;
          product_code: string;
          coin_amount: number;
          amount_minor?: number | null;
          currency?: string | null;
          status?: "pending" | "completed" | "failed" | "refunded" | "cancelled";
          verification_status?: "unverified" | "verified" | "rejected";
          verified_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          provider?: "google_play" | "apple_store" | "web" | "admin_test";
          provider_order_id?: string | null;
          provider_transaction_id?: string | null;
          product_code?: string;
          coin_amount?: number;
          amount_minor?: number | null;
          currency?: string | null;
          status?: "pending" | "completed" | "failed" | "refunded" | "cancelled";
          verification_status?: "unverified" | "verified" | "rejected";
          verified_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_orders_product_code_fkey";
            columns: ["product_code"];
            isOneToOne: false;
            referencedRelation: "coin_products";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "payment_orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      series: {
        Row: {
          id: string;
          slug: string;
          title: string;
          synopsis: string | null;
          genre: string | null;
          language: string | null;
          format: string | null;
          episode_count: number;
          episode_duration_label: string | null;
          poster_url: string | null;
          hero_image_url: string | null;
          status: "draft" | "published" | "archived";
          featured: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          synopsis?: string | null;
          genre?: string | null;
          language?: string | null;
          format?: string | null;
          episode_count?: number;
          episode_duration_label?: string | null;
          poster_url?: string | null;
          hero_image_url?: string | null;
          status?: "draft" | "published" | "archived";
          featured?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          synopsis?: string | null;
          genre?: string | null;
          language?: string | null;
          format?: string | null;
          episode_count?: number;
          episode_duration_label?: string | null;
          poster_url?: string | null;
          hero_image_url?: string | null;
          status?: "draft" | "published" | "archived";
          featured?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          status: "inactive" | "active" | "expired" | "cancelled";
          plan_code: string | null;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: "inactive" | "active" | "expired" | "cancelled";
          plan_code?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: "inactive" | "active" | "expired" | "cancelled";
          plan_code?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      watch_progress: {
        Row: {
          id: string;
          user_id: string;
          series_slug: string;
          episode_number: number;
          position_seconds: number;
          duration_seconds: number;
          completed: boolean;
          last_watched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          series_slug: string;
          episode_number: number;
          position_seconds?: number;
          duration_seconds?: number;
          completed?: boolean;
          last_watched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          series_slug?: string;
          episode_number?: number;
          position_seconds?: number;
          duration_seconds?: number;
          completed?: boolean;
          last_watched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watch_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          user_id: string;
          coin_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          coin_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          coin_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      purchase_episode_with_coins: {
        Args: {
          p_episode_id: string;
        };
        Returns: {
          success: boolean;
          status: string;
          remaining_balance: number | null;
        }[];
      };
      credit_verified_coin_purchase: {
        Args: {
          p_user_id: string;
          p_provider: "google_play" | "apple_store" | "web" | "admin_test";
          p_provider_transaction_id: string;
          p_product_code: string;
          p_reference?: string | null;
        };
        Returns: {
          success: boolean;
          status: string;
          credited_coins: number;
          new_balance: number | null;
          payment_order_id: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
