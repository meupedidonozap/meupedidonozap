export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          sort_order: number
          store_id: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          store_id: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          discount_percent: number | null
          discount_value: number | null
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number
          min_order_value: number
          store_id: string
          used_count: number
        }
        Insert: {
          code: string
          discount_percent?: number | null
          discount_value?: number | null
          expires_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number
          min_order_value?: number
          store_id: string
          used_count?: number
        }
        Update: {
          code?: string
          discount_percent?: number | null
          discount_value?: number | null
          expires_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number
          min_order_value?: number
          store_id?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          address: string
          cep: string
          city: string
          complement: string | null
          cpf_cnpj: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          neighborhood: string
          number: string
          store_id: string
          uf: string
          updated_at: string
          user_id: string | null
          whatsapp: string
        }
        Insert: {
          address?: string
          cep?: string
          city?: string
          complement?: string | null
          cpf_cnpj?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          neighborhood?: string
          number?: string
          store_id: string
          uf?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string
        }
        Update: {
          address?: string
          cep?: string
          city?: string
          complement?: string | null
          cpf_cnpj?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          neighborhood?: string
          number?: string
          store_id?: string
          uf?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      food_items: {
        Row: {
          category_id: string | null
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          preparation_time: number
          price: number
          store_id: string
        }
        Insert: {
          category_id?: string | null
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          preparation_time?: number
          price?: number
          store_id: string
        }
        Update: {
          category_id?: string | null
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          preparation_time?: number
          price?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer: Json
          delivery_fee: number
          delivery_shift: string
          discount: number
          id: string
          items: Json
          observations: string | null
          order_number: number
          payment_method: string
          status: string
          store_id: string
          subtotal: number
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer?: Json
          delivery_fee?: number
          delivery_shift?: string
          discount?: number
          id?: string
          items?: Json
          observations?: string | null
          order_number?: number
          payment_method?: string
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer?: Json
          delivery_fee?: number
          delivery_shift?: string
          discount?: number
          id?: string
          items?: Json
          observations?: string | null
          order_number?: number
          payment_method?: string
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          id: string
          image_url: string
          label: string | null
          product_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          image_url: string
          label?: string | null
          product_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          image_url?: string
          label?: string | null
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          id: string
          price: number
          product_id: string
          size: string | null
          sku: string
          stock: number
        }
        Insert: {
          color?: string | null
          id?: string
          price?: number
          product_id: string
          size?: string | null
          sku?: string
          stock?: number
        }
        Update: {
          color?: string | null
          id?: string
          price?: number
          product_id?: string
          size?: string | null
          sku?: string
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          code: string
          created_at: string
          description: string
          group_id: string | null
          has_variants: boolean
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          store_id: string
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string
          group_id?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          store_id: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string
          group_id?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          created_at: string
          customer: Json
          discount: number
          extra_items: Json
          id: string
          items: Json
          observations: string | null
          order_id: string | null
          os_number: number
          paid_at: string | null
          status: string
          store_id: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer?: Json
          discount?: number
          extra_items?: Json
          id?: string
          items?: Json
          observations?: string | null
          order_id?: string | null
          os_number?: number
          paid_at?: string | null
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer?: Json
          discount?: number
          extra_items?: Json
          id?: string
          items?: Json
          observations?: string | null
          order_id?: string | null
          os_number?: number
          paid_at?: string | null
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_admins: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_admins_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_sellers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          store_id: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      store_visits: {
        Row: {
          id: string
          ip_hash: string | null
          page: string | null
          store_id: string
          user_agent: string | null
          visited_at: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          page?: string | null
          store_id: string
          user_agent?: string | null
          visited_at?: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          page?: string | null
          store_id?: string
          user_agent?: string | null
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          banner: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo: string | null
          name: string
          phone: string | null
          settings: Json
          slug: string
          type: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          banner?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo?: string | null
          name: string
          phone?: string | null
          settings?: Json
          slug: string
          type?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          banner?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          slug?: string
          type?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_store_admin: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
