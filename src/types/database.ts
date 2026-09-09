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
          media_asset_id: string | null;
          preview_media_asset_id: string | null;
          is_free: boolean;
          coin_price: number;
          coin_unlock_enabled: boolean;
          rewarded_unlock_enabled: boolean;
          rewarded_access_mode: "permanent" | "session";
          required_rewarded_completions: number;
          plus_access: boolean;
          locked_preview_seconds: number;
          content_rating_override: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors_override: string[];
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
          media_asset_id?: string | null;
          preview_media_asset_id?: string | null;
          is_free?: boolean;
          coin_price?: number;
          coin_unlock_enabled?: boolean;
          rewarded_unlock_enabled?: boolean;
          rewarded_access_mode?: "permanent" | "session";
          required_rewarded_completions?: number;
          plus_access?: boolean;
          locked_preview_seconds?: number;
          content_rating_override?: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors_override?: string[];
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
          media_asset_id?: string | null;
          preview_media_asset_id?: string | null;
          is_free?: boolean;
          coin_price?: number;
          coin_unlock_enabled?: boolean;
          rewarded_unlock_enabled?: boolean;
          rewarded_access_mode?: "permanent" | "session";
          required_rewarded_completions?: number;
          plus_access?: boolean;
          locked_preview_seconds?: number;
          content_rating_override?: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors_override?: string[];
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
          {
            foreignKeyName: "episodes_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "episodes_preview_media_asset_id_fkey";
            columns: ["preview_media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      user_parental_controls: {
        Row: {
          user_id: string;
          pin_salt: string;
          pin_hash: string;
          failed_attempts: number;
          locked_until: string | null;
          restrictions_enabled: boolean;
          restriction_threshold: "U/A 13+" | "U/A 16+" | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          pin_salt: string;
          pin_hash: string;
          failed_attempts?: number;
          locked_until?: string | null;
          restrictions_enabled?: boolean;
          restriction_threshold?: "U/A 13+" | "U/A 16+" | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          pin_salt?: string;
          pin_hash?: string;
          failed_attempts?: number;
          locked_until?: string | null;
          restrictions_enabled?: boolean;
          restriction_threshold?: "U/A 13+" | "U/A 16+" | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "short_films_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
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
      rewarded_ad_attempts: {
        Row: {
          id: string;
          user_id: string;
          episode_id: string;
          provider: string;
          custom_data: string;
          rewarded_access_mode_snapshot: "permanent" | "session";
          required_completions_snapshot: number;
          status: "pending" | "granted" | "expired" | "failed" | "unsupported_pending_policy";
          expires_at: string;
          verified_at: string | null;
          provider_transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          episode_id: string;
          provider?: string;
          custom_data: string;
          rewarded_access_mode_snapshot: "permanent" | "session";
          required_completions_snapshot: number;
          status?: "pending" | "granted" | "expired" | "failed" | "unsupported_pending_policy";
          expires_at: string;
          verified_at?: string | null;
          provider_transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          episode_id?: string;
          provider?: string;
          custom_data?: string;
          rewarded_access_mode_snapshot?: "permanent" | "session";
          required_completions_snapshot?: number;
          status?: "pending" | "granted" | "expired" | "failed" | "unsupported_pending_policy";
          expires_at?: string;
          verified_at?: string | null;
          provider_transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rewarded_ad_attempts_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rewarded_ad_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      rewarded_monetization_events: {
        Row: {
          id: string;
          event_type: string;
          user_id: string | null;
          episode_id: string | null;
          ad_index: number | null;
          required_count: number | null;
          resulting_progress: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          user_id?: string | null;
          episode_id?: string | null;
          ad_index?: number | null;
          required_count?: number | null;
          resulting_progress?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          user_id?: string | null;
          episode_id?: string | null;
          ad_index?: number | null;
          required_count?: number | null;
          resulting_progress?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rewarded_monetization_events_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rewarded_monetization_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ranking_decisions: {
        Row: {
          ranking_decision_id: string;
          decision_schema_version: string;
          created_at: string;
          received_at: string;
          actor_id: string | null;
          session_id: string | null;
          ranking_policy: string;
          ranking_policy_version: string;
          config_version: string;
          config_hash: string | null;
          ranking_engine_version: string | null;
          candidate_set_id: string;
          candidate_set_version: string;
          candidate_count: number;
          eligibility_snapshot_ref: string;
          source_surface: string;
          row_id: string | null;
          deterministic: boolean;
          experiment_id: string | null;
          experiment_variant: string | null;
          propensity_type: string;
          selection_probability: number | null;
          request_context: Json;
          candidate_snapshot: Json;
          ordered_results: Json;
        };
        Insert: {
          ranking_decision_id: string;
          decision_schema_version: string;
          created_at: string;
          received_at?: string;
          actor_id?: string | null;
          session_id?: string | null;
          ranking_policy: string;
          ranking_policy_version: string;
          config_version: string;
          config_hash?: string | null;
          ranking_engine_version?: string | null;
          candidate_set_id: string;
          candidate_set_version: string;
          candidate_count: number;
          eligibility_snapshot_ref: string;
          source_surface: string;
          row_id?: string | null;
          deterministic: boolean;
          experiment_id?: string | null;
          experiment_variant?: string | null;
          propensity_type?: string;
          selection_probability?: number | null;
          request_context?: Json;
          candidate_snapshot: Json;
          ordered_results: Json;
        };
        Update: {
          ranking_decision_id?: string;
          decision_schema_version?: string;
          created_at?: string;
          received_at?: string;
          actor_id?: string | null;
          session_id?: string | null;
          ranking_policy?: string;
          ranking_policy_version?: string;
          config_version?: string;
          config_hash?: string | null;
          ranking_engine_version?: string | null;
          candidate_set_id?: string;
          candidate_set_version?: string;
          candidate_count?: number;
          eligibility_snapshot_ref?: string;
          source_surface?: string;
          row_id?: string | null;
          deterministic?: boolean;
          experiment_id?: string | null;
          experiment_variant?: string | null;
          propensity_type?: string;
          selection_probability?: number | null;
          request_context?: Json;
          candidate_snapshot?: Json;
          ordered_results?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "ranking_decisions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ranking_behavior_events: {
        Row: {
          event_id: string; event_schema_version: string; event_type: string; occurred_at: string;
          actor_id: string | null; session_id: string | null; content_id: string; content_type: string;
          source_surface: string; row_id: string | null; position: number | null;
          search_query_context: string | null; search_result_position: number | null;
          metadata: Json; ranking_decision_id: string | null; recommendation_reason: string | null;
          attribution_source: string | null; attribution_policy: string | null; received_at: string;
        };
        Insert: {
          event_id: string; event_schema_version: string; event_type: string; occurred_at: string;
          actor_id?: string | null; session_id?: string | null; content_id: string; content_type: string;
          source_surface: string; row_id?: string | null; position?: number | null;
          search_query_context?: string | null; search_result_position?: number | null;
          metadata?: Json; ranking_decision_id?: string | null; recommendation_reason?: string | null;
          attribution_source?: string | null; attribution_policy?: string | null; received_at?: string;
        };
        Update: {
          event_id?: string; event_schema_version?: string; event_type?: string; occurred_at?: string;
          actor_id?: string | null; session_id?: string | null; content_id?: string; content_type?: string;
          source_surface?: string; row_id?: string | null; position?: number | null;
          search_query_context?: string | null; search_result_position?: number | null;
          metadata?: Json; ranking_decision_id?: string | null; recommendation_reason?: string | null;
          attribution_source?: string | null; attribution_policy?: string | null; received_at?: string;
        };
        Relationships: [];
      };
      coin_transactions: {
        Row: {
          id: string;
          user_id: string | null;
          amount: number;
          transaction_type:
            | "credit"
            | "episode_purchase"
            | "refund"
            | "promo"
            | "chai_tip"
            | "chai_refund"
            | "chai_adjustment";
          episode_id: string | null;
          payment_order_id: string | null;
          short_film_id: string | null;
          chai_tip_request_id: string | null;
          chai_ledger_entry_id: string | null;
          related_transaction_id: string | null;
          reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          amount: number;
          transaction_type:
            | "credit"
            | "episode_purchase"
            | "refund"
            | "promo"
            | "chai_tip"
            | "chai_refund"
            | "chai_adjustment";
          episode_id?: string | null;
          payment_order_id?: string | null;
          short_film_id?: string | null;
          chai_tip_request_id?: string | null;
          chai_ledger_entry_id?: string | null;
          related_transaction_id?: string | null;
          reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          amount?: number;
          transaction_type?:
            | "credit"
            | "episode_purchase"
            | "refund"
            | "promo"
            | "chai_tip"
            | "chai_refund"
            | "chai_adjustment";
          episode_id?: string | null;
          payment_order_id?: string | null;
          short_film_id?: string | null;
          chai_tip_request_id?: string | null;
          chai_ledger_entry_id?: string | null;
          related_transaction_id?: string | null;
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
            foreignKeyName: "coin_transactions_short_film_id_fkey";
            columns: ["short_film_id"];
            isOneToOne: false;
            referencedRelation: "short_films";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coin_transactions_chai_tip_request_id_fkey";
            columns: ["chai_tip_request_id"];
            isOneToOne: false;
            referencedRelation: "chai_tip_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coin_transactions_chai_ledger_entry_id_fkey";
            columns: ["chai_ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "chai_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coin_transactions_related_transaction_id_fkey";
            columns: ["related_transaction_id"];
            isOneToOne: false;
            referencedRelation: "coin_transactions";
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
      cms_admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
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
          content_rating: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors: string[];
          status: "draft" | "published" | "archived";
          published_at: string | null;
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
          content_rating?: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors?: string[];
          status?: "draft" | "published" | "archived";
          published_at?: string | null;
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
          content_rating?: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors?: string[];
          status?: "draft" | "published" | "archived";
          published_at?: string | null;
          featured?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      home_settings: {
        Row: {
          id: string;
          key: string;
          value: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      home_rows: {
        Row: {
          id: string;
          title: string;
          row_role: "start_here" | "editorial" | "spotlight" | "category";
          enabled: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          row_role: "start_here" | "editorial" | "spotlight" | "category";
          enabled?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          row_role?: "start_here" | "editorial" | "spotlight" | "category";
          enabled?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      home_row_items: {
        Row: {
          id: string;
          row_id: string;
          content_type: "series" | "short_film";
          series_id: string | null;
          short_film_id: string | null;
          sort_order: number;
          show_title: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          row_id: string;
          content_type: "series" | "short_film";
          series_id?: string | null;
          short_film_id?: string | null;
          sort_order?: number;
          show_title?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          row_id?: string;
          content_type?: "series" | "short_film";
          series_id?: string | null;
          short_film_id?: string | null;
          sort_order?: number;
          show_title?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "home_row_items_row_id_fkey";
            columns: ["row_id"];
            isOneToOne: false;
            referencedRelation: "home_rows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "home_row_items_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "series";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "home_row_items_short_film_id_fkey";
            columns: ["short_film_id"];
            isOneToOne: false;
            referencedRelation: "short_films";
            referencedColumns: ["id"];
          },
        ];
      };
      home_editorial_change_events: {
        Row: {
          id: string;
          changed_at: string;
          actor_id: string | null;
          actor_source: "cms_admin" | "system";
          change_type:
            | "ROW_CREATE"
            | "ROW_UPDATE"
            | "ROW_DELETE"
            | "ROW_REORDER"
            | "ITEM_ADD"
            | "ITEM_UPDATE"
            | "ITEM_REMOVE"
            | "ITEM_REORDER"
            | "SPOTLIGHT_TOGGLE"
            | "HOME_SETTING_UPDATE";
          intervention_type:
            | "EDITORIAL_PIN"
            | "EDITORIAL_BOOST"
            | "EDITORIAL_REMOVE"
            | "EDITORIAL_ORDER";
          ranking_policy: "editorial";
          ranking_policy_version: "home_editorial_v1";
          config_version: string;
          config_hash: string | null;
          home_row_id: string | null;
          home_row_item_id: string | null;
          affected_content_type: "series" | "short_film" | null;
          series_id: string | null;
          short_film_id: string | null;
          previous_state: Json | null;
          new_state: Json | null;
        };
        Insert: {
          id?: string;
          changed_at?: string;
          actor_id?: string | null;
          actor_source?: "cms_admin" | "system";
          change_type:
            | "ROW_CREATE"
            | "ROW_UPDATE"
            | "ROW_DELETE"
            | "ROW_REORDER"
            | "ITEM_ADD"
            | "ITEM_UPDATE"
            | "ITEM_REMOVE"
            | "ITEM_REORDER"
            | "SPOTLIGHT_TOGGLE"
            | "HOME_SETTING_UPDATE";
          intervention_type:
            | "EDITORIAL_PIN"
            | "EDITORIAL_BOOST"
            | "EDITORIAL_REMOVE"
            | "EDITORIAL_ORDER";
          ranking_policy?: "editorial";
          ranking_policy_version?: "home_editorial_v1";
          config_version?: string;
          config_hash?: string | null;
          home_row_id?: string | null;
          home_row_item_id?: string | null;
          affected_content_type?: "series" | "short_film" | null;
          series_id?: string | null;
          short_film_id?: string | null;
          previous_state?: Json | null;
          new_state?: Json | null;
        };
        Update: {
          id?: string;
          changed_at?: string;
          actor_id?: string | null;
          actor_source?: "cms_admin" | "system";
          change_type?:
            | "ROW_CREATE"
            | "ROW_UPDATE"
            | "ROW_DELETE"
            | "ROW_REORDER"
            | "ITEM_ADD"
            | "ITEM_UPDATE"
            | "ITEM_REMOVE"
            | "ITEM_REORDER"
            | "SPOTLIGHT_TOGGLE"
            | "HOME_SETTING_UPDATE";
          intervention_type?:
            | "EDITORIAL_PIN"
            | "EDITORIAL_BOOST"
            | "EDITORIAL_REMOVE"
            | "EDITORIAL_ORDER";
          ranking_policy?: "editorial";
          ranking_policy_version?: "home_editorial_v1";
          config_version?: string;
          config_hash?: string | null;
          home_row_id?: string | null;
          home_row_item_id?: string | null;
          affected_content_type?: "series" | "short_film" | null;
          series_id?: string | null;
          short_film_id?: string | null;
          previous_state?: Json | null;
          new_state?: Json | null;
        };
        Relationships: [];
      };
      short_films: {
        Row: {
          id: string;
          slug: string;
          title: string;
          synopsis: string | null;
          poster_url: string | null;
          hero_image_url: string | null;
          creator_reference: string | null;
          duration_seconds: number;
          playback_reference: string | null;
          media_asset_id: string | null;
          language: string | null;
          content_rating: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors: string[];
          status: "draft" | "published" | "archived";
          publish_at: string | null;
          midroll_enabled: boolean;
          midroll_timecodes: number[];
          postroll_enabled: boolean;
          chai_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          synopsis?: string | null;
          poster_url?: string | null;
          hero_image_url?: string | null;
          creator_reference?: string | null;
          duration_seconds?: number;
          playback_reference?: string | null;
          media_asset_id?: string | null;
          language?: string | null;
          content_rating?: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors?: string[];
          status?: "draft" | "published" | "archived";
          publish_at?: string | null;
          midroll_enabled?: boolean;
          midroll_timecodes?: number[];
          postroll_enabled?: boolean;
          chai_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          synopsis?: string | null;
          poster_url?: string | null;
          hero_image_url?: string | null;
          creator_reference?: string | null;
          duration_seconds?: number;
          playback_reference?: string | null;
          media_asset_id?: string | null;
          language?: string | null;
          content_rating?: "U" | "U/A 7+" | "U/A 13+" | "U/A 16+" | "A" | null;
          content_descriptors?: string[];
          status?: "draft" | "published" | "archived";
          publish_at?: string | null;
          midroll_enabled?: boolean;
          midroll_timecodes?: number[];
          postroll_enabled?: boolean;
          chai_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subtitle_tracks: {
        Row: {
          id: string;
          target_type: "SERIES_EPISODE" | "SHORT_FILM";
          episode_id: string | null;
          short_film_id: string | null;
          language_code: string;
          label: string;
          source_format: "srt" | "vtt";
          closed_captions: boolean;
          is_default: boolean;
          source_bucket: string;
          source_object_path: string;
          source_mime_type: string;
          mux_track_reference: string | null;
          status: "pending" | "processing" | "ready" | "failed" | "deleted";
          failure_code: string | null;
          failure_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          target_type: "SERIES_EPISODE" | "SHORT_FILM";
          episode_id?: string | null;
          short_film_id?: string | null;
          language_code: string;
          label: string;
          source_format: "srt" | "vtt";
          closed_captions?: boolean;
          is_default?: boolean;
          source_bucket?: string;
          source_object_path: string;
          source_mime_type: string;
          mux_track_reference?: string | null;
          status?: "pending" | "processing" | "ready" | "failed" | "deleted";
          failure_code?: string | null;
          failure_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          target_type?: "SERIES_EPISODE" | "SHORT_FILM";
          episode_id?: string | null;
          short_film_id?: string | null;
          language_code?: string;
          label?: string;
          source_format?: "srt" | "vtt";
          closed_captions?: boolean;
          is_default?: boolean;
          source_bucket?: string;
          source_object_path?: string;
          source_mime_type?: string;
          mux_track_reference?: string | null;
          status?: "pending" | "processing" | "ready" | "failed" | "deleted";
          failure_code?: string | null;
          failure_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subtitle_tracks_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subtitle_tracks_short_film_id_fkey";
            columns: ["short_film_id"];
            isOneToOne: false;
            referencedRelation: "short_films";
            referencedColumns: ["id"];
          },
        ];
      };
      media_assets: {
        Row: {
          id: string;
          status: "pending" | "processing" | "ready" | "failed";
          provider_name: string | null;
          provider_upload_reference: string | null;
          provider_asset_reference: string | null;
          provider_playback_reference: string | null;
          source_media_asset_id: string | null;
          clip_start_seconds: number | null;
          clip_end_seconds: number | null;
          failure_code: string | null;
          failure_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status?: "pending" | "processing" | "ready" | "failed";
          provider_name?: string | null;
          provider_upload_reference?: string | null;
          provider_asset_reference?: string | null;
          provider_playback_reference?: string | null;
          source_media_asset_id?: string | null;
          clip_start_seconds?: number | null;
          clip_end_seconds?: number | null;
          failure_code?: string | null;
          failure_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          status?: "pending" | "processing" | "ready" | "failed";
          provider_name?: string | null;
          provider_upload_reference?: string | null;
          provider_asset_reference?: string | null;
          provider_playback_reference?: string | null;
          source_media_asset_id?: string | null;
          clip_start_seconds?: number | null;
          clip_end_seconds?: number | null;
          failure_code?: string | null;
          failure_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_assets_source_media_asset_id_fkey";
            columns: ["source_media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      media_quarantine: {
        Row: {
          id: string;
          media_asset_id: string;
          status: "quarantined" | "released";
          reason: string | null;
          requested_by: string | null;
          requested_at: string;
          released_by: string | null;
          released_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          media_asset_id: string;
          status?: "quarantined" | "released";
          reason?: string | null;
          requested_by?: string | null;
          requested_at?: string;
          released_by?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          media_asset_id?: string;
          status?: "quarantined" | "released";
          reason?: string | null;
          requested_by?: string | null;
          requested_at?: string;
          released_by?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_quarantine_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: true;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      media_quarantine_log: {
        Row: {
          id: string;
          media_asset_id: string;
          action: "quarantined" | "released";
          actor_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          media_asset_id: string;
          action: "quarantined" | "released";
          actor_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          media_asset_id?: string;
          action?: "quarantined" | "released";
          actor_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_quarantine_log_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      media_retention_log: {
        Row: {
          id: string;
          media_asset_id: string;
          reason: string;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          media_asset_id: string;
          reason: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          media_asset_id?: string;
          reason?: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_retention_log_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      media_deletion_ledger: {
        Row: {
          id: string;
          media_asset_id: string;
          actor_id: string | null;
          classification_at_execution:
            | "SAFE"
            | "REPLACE_FIRST"
            | "BLOCKED"
            | "SHARED"
            | "RETENTION_PROTECTED"
            | "UNKNOWN";
          result: "attempted" | "succeeded" | "failed" | "blocked";
          supabase_deleted: boolean;
          mux_deleted: boolean;
          mux_asset_reference: string | null;
          error_message: string | null;
          verified_at: string | null;
          verification_result: "verified" | "discrepancy" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          media_asset_id: string;
          actor_id?: string | null;
          classification_at_execution:
            | "SAFE"
            | "REPLACE_FIRST"
            | "BLOCKED"
            | "SHARED"
            | "RETENTION_PROTECTED"
            | "UNKNOWN";
          result?: "attempted" | "succeeded" | "failed" | "blocked";
          supabase_deleted?: boolean;
          mux_deleted?: boolean;
          mux_asset_reference?: string | null;
          error_message?: string | null;
          verified_at?: string | null;
          verification_result?: "verified" | "discrepancy" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          media_asset_id?: string;
          actor_id?: string | null;
          classification_at_execution?:
            | "SAFE"
            | "REPLACE_FIRST"
            | "BLOCKED"
            | "SHARED"
            | "RETENTION_PROTECTED"
            | "UNKNOWN";
          result?: "attempted" | "succeeded" | "failed" | "blocked";
          supabase_deleted?: boolean;
          mux_deleted?: boolean;
          mux_asset_reference?: string | null;
          error_message?: string | null;
          verified_at?: string | null;
          verification_result?: "verified" | "discrepancy" | null;
          created_at?: string;
        };
        Relationships: [];
      };
      guest_parental_controls: {
        Row: {
          id: string;
          credential_hash: string;
          pin_salt: string;
          pin_hash: string;
          failed_attempts: number;
          locked_until: string | null;
          restrictions_enabled: boolean;
          restriction_threshold: "U/A 13+" | "U/A 16+" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          credential_hash: string;
          pin_salt: string;
          pin_hash: string;
          failed_attempts?: number;
          locked_until?: string | null;
          restrictions_enabled?: boolean;
          restriction_threshold?: "U/A 13+" | "U/A 16+" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          credential_hash?: string;
          pin_salt?: string;
          pin_hash?: string;
          failed_attempts?: number;
          locked_until?: string | null;
          restrictions_enabled?: boolean;
          restriction_threshold?: "U/A 13+" | "U/A 16+" | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_accounting_destinations: {
        Row: {
          id: string;
          display_name: string | null;
          accounting_reference: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          display_name?: string | null;
          accounting_reference?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          accounting_reference?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      parental_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          guest_parental_control_id: string | null;
          token_hash: string;
          issued_at: string;
          expires_at: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          guest_parental_control_id?: string | null;
          token_hash: string;
          issued_at?: string;
          expires_at: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          guest_parental_control_id?: string | null;
          token_hash?: string;
          issued_at?: string;
          expires_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parental_sessions_guest_parental_control_id_fkey";
            columns: ["guest_parental_control_id"];
            isOneToOne: false;
            referencedRelation: "guest_parental_controls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parental_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      short_film_chai_destinations: {
        Row: {
          short_film_id: string;
          creator_destination_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          short_film_id: string;
          creator_destination_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          short_film_id?: string;
          creator_destination_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "short_film_chai_destinations_short_film_id_fkey";
            columns: ["short_film_id"];
            isOneToOne: true;
            referencedRelation: "short_films";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "short_film_chai_destinations_creator_destination_id_fkey";
            columns: ["creator_destination_id"];
            isOneToOne: false;
            referencedRelation: "creator_accounting_destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      chai_allowed_coin_amounts: {
        Row: {
          id: string;
          coin_amount: number;
          enabled: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coin_amount: number;
          enabled?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coin_amount?: number;
          enabled?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chai_tip_requests: {
        Row: {
          id: string;
          viewer_user_id: string;
          short_film_id: string;
          creator_destination_id: string;
          coin_amount: number;
          idempotency_key: string;
          status: "pending" | "completed" | "insufficient_balance" | "failed";
          remaining_balance: number | null;
          coin_transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          viewer_user_id: string;
          short_film_id: string;
          creator_destination_id: string;
          coin_amount: number;
          idempotency_key: string;
          status?: "pending" | "completed" | "insufficient_balance" | "failed";
          remaining_balance?: number | null;
          coin_transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          viewer_user_id?: string;
          short_film_id?: string;
          creator_destination_id?: string;
          coin_amount?: number;
          idempotency_key?: string;
          status?: "pending" | "completed" | "insufficient_balance" | "failed";
          remaining_balance?: number | null;
          coin_transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chai_tip_requests_viewer_user_id_fkey";
            columns: ["viewer_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_tip_requests_short_film_id_fkey";
            columns: ["short_film_id"];
            isOneToOne: false;
            referencedRelation: "short_films";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_tip_requests_creator_destination_id_fkey";
            columns: ["creator_destination_id"];
            isOneToOne: false;
            referencedRelation: "creator_accounting_destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_tip_requests_coin_transaction_id_fkey";
            columns: ["coin_transaction_id"];
            isOneToOne: false;
            referencedRelation: "coin_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      chai_ledger_entries: {
        Row: {
          id: string;
          chai_tip_request_id: string | null;
          viewer_user_id: string | null;
          short_film_id: string;
          creator_destination_id: string;
          viewer_coin_transaction_id: string | null;
          coin_amount: number;
          entry_type: "credit" | "reversal" | "adjustment";
          status: "posted" | "reversed" | "adjusted" | "voided";
          original_tip_entry_id: string | null;
          related_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chai_tip_request_id?: string | null;
          viewer_user_id?: string | null;
          short_film_id: string;
          creator_destination_id: string;
          viewer_coin_transaction_id?: string | null;
          coin_amount: number;
          entry_type: "credit" | "reversal" | "adjustment";
          status?: "posted" | "reversed" | "adjusted" | "voided";
          original_tip_entry_id?: string | null;
          related_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chai_tip_request_id?: string | null;
          viewer_user_id?: string | null;
          short_film_id?: string;
          creator_destination_id?: string;
          viewer_coin_transaction_id?: string | null;
          coin_amount?: number;
          entry_type?: "credit" | "reversal" | "adjustment";
          status?: "posted" | "reversed" | "adjusted" | "voided";
          original_tip_entry_id?: string | null;
          related_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chai_ledger_entries_chai_tip_request_id_fkey";
            columns: ["chai_tip_request_id"];
            isOneToOne: true;
            referencedRelation: "chai_tip_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_ledger_entries_viewer_user_id_fkey";
            columns: ["viewer_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_ledger_entries_short_film_id_fkey";
            columns: ["short_film_id"];
            isOneToOne: false;
            referencedRelation: "short_films";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_ledger_entries_creator_destination_id_fkey";
            columns: ["creator_destination_id"];
            isOneToOne: false;
            referencedRelation: "creator_accounting_destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_ledger_entries_viewer_coin_transaction_id_fkey";
            columns: ["viewer_coin_transaction_id"];
            isOneToOne: true;
            referencedRelation: "coin_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_ledger_entries_original_tip_entry_id_fkey";
            columns: ["original_tip_entry_id"];
            isOneToOne: false;
            referencedRelation: "chai_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chai_ledger_entries_related_entry_id_fkey";
            columns: ["related_entry_id"];
            isOneToOne: false;
            referencedRelation: "chai_ledger_entries";
            referencedColumns: ["id"];
          },
        ];
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
          content_type: "series_episode" | "short_film";
          series_slug: string | null;
          episode_number: number | null;
          short_film_slug: string | null;
          position_seconds: number;
          duration_seconds: number;
          completed: boolean;
          ad_break_state: Json;
          last_watched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_type?: "series_episode" | "short_film";
          series_slug?: string | null;
          episode_number?: number | null;
          short_film_slug?: string | null;
          position_seconds?: number;
          duration_seconds?: number;
          completed?: boolean;
          ad_break_state?: Json;
          last_watched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content_type?: "series_episode" | "short_film";
          series_slug?: string | null;
          episode_number?: number | null;
          short_film_slug?: string | null;
          position_seconds?: number;
          duration_seconds?: number;
          completed?: boolean;
          ad_break_state?: Json;
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
      },
      notification_deliveries: {
        Row: {
          attempted_at: string;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          notification_id: string;
          provider: string;
          provider_ticket_id: string | null;
          push_device_id: string | null;
          receipt_checked_at: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attempted_at?: string;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          notification_id: string;
          provider?: string;
          provider_ticket_id?: string | null;
          push_device_id?: string | null;
          receipt_checked_at?: string | null;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempted_at?: string;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          notification_id?: string;
          provider?: string;
          provider_ticket_id?: string | null;
          push_device_id?: string | null;
          receipt_checked_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_deliveries_push_device_id_fkey";
            columns: ["push_device_id"];
            isOneToOne: false;
            referencedRelation: "push_devices";
            referencedColumns: ["id"];
          },
        ];
      },
      notification_preferences: {
        Row: {
          account_security: boolean;
          new_releases: boolean;
          promotions: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_security?: boolean;
          new_releases?: boolean;
          promotions?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_security?: boolean;
          new_releases?: boolean;
          promotions?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      },
      notifications: {
        Row: {
          body: string;
          created_at: string;
          deep_link: string | null;
          expires_at: string | null;
          id: string;
          image_url: string | null;
          payload: Json;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          deep_link?: string | null;
          expires_at?: string | null;
          id?: string;
          image_url?: string | null;
          payload?: Json;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          deep_link?: string | null;
          expires_at?: string | null;
          id?: string;
          image_url?: string | null;
          payload?: Json;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      },
      push_devices: {
        Row: {
          active: boolean;
          created_at: string;
          device_id: string;
          expo_push_token: string | null;
          id: string;
          last_seen_at: string;
          native_push_token: string | null;
          platform: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          device_id: string;
          expo_push_token?: string | null;
          id?: string;
          last_seen_at?: string;
          native_push_token?: string | null;
          platform: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          device_id?: string;
          expo_push_token?: string | null;
          id?: string;
          last_seen_at?: string;
          native_push_token?: string | null;
          platform?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      },
    };
    Views: Record<string, never>;
    Functions: {
      is_cms_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_short_film_chai_details: {
        Args: {
          p_short_film_slug: string;
        };
        Returns: {
          available: boolean;
          allowed_coin_amounts: number[];
        }[];
      };
      submit_short_film_chai_tip: {
        Args: {
          p_short_film_slug: string;
          p_coin_amount: number;
          p_idempotency_key: string;
        };
        Returns: {
          success: boolean;
          status: string;
          remaining_balance: number | null;
        }[];
      };
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
      create_rewarded_ad_attempt: {
        Args: {
          p_episode_id: string;
        };
        Returns: {
          status: string;
          custom_data: string | null;
          expires_at: string | null;
          verified_progress: number;
          required_completions: number;
        }[];
      };
      get_rewarded_ad_attempt_status: {
        Args: {
          p_custom_data: string;
        };
        Returns: {
          status: string;
          custom_data: string | null;
          expires_at: string | null;
          verified_progress: number;
          required_completions: number;
        }[];
      };
      finalize_rewarded_ad_callback: {
        Args: {
          p_custom_data: string;
          p_provider_transaction_id: string;
        };
        Returns: {
          success: boolean;
          status: string;
          custom_data: string | null;
          expires_at: string | null;
          verified_progress: number;
          required_completions: number;
        }[];
      };
      get_rewarded_progress: {
        Args: {
          p_episode_id: string;
        };
        Returns: {
          verified_progress: number;
          required_completions: number;
          state: string;
        }[];
      };
      record_rewarded_event: {
        Args: {
          p_event_type: string;
          p_user_id: string;
          p_episode_id?: string | null;
          p_ad_index?: number | null;
          p_required_count?: number | null;
          p_resulting_progress?: number | null;
          p_metadata?: Json | null;
        };
        Returns: {
          id: string;
        }[];
      };
      publish_series_with_episodes: {
        Args: {
          p_series_id: string;
        };
        Returns: {
          blockers: string[] | null;
          message: string;
          published_episode_numbers: number[] | null;
          series_slug: string | null;
          status: string;
          success: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
