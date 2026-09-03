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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          commission_percent: number
          id: string
          name: string
          sort_order: number
          store_id: string
        }
        Insert: {
          commission_percent?: number
          id?: string
          name: string
          sort_order?: number
          store_id: string
        }
        Update: {
          commission_percent?: number
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
          customer_code: string
          geo_lat: number | null
          geo_lng: number | null
          id: string
          ie: string | null
          is_active: boolean
          name: string
          neighborhood: string
          number: string
          price_table: number
          seller_code: string
          store_id: string
          transportadora: string | null
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
          customer_code?: string
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          ie?: string | null
          is_active?: boolean
          name?: string
          neighborhood?: string
          number?: string
          price_table?: number
          seller_code?: string
          store_id: string
          transportadora?: string | null
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
          customer_code?: string
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          ie?: string | null
          is_active?: boolean
          name?: string
          neighborhood?: string
          number?: string
          price_table?: number
          seller_code?: string
          store_id?: string
          transportadora?: string | null
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
      customer_visits: {
        Row: {
          checked_in_at: string
          checked_out_at: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkout_lat: number | null
          checkout_lng: number | null
          created_at: string
          customer_profile_id: string
          distance_meters_at_checkin: number | null
          id: string
          seller_code: string | null
          seller_user_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string
          checked_out_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          created_at?: string
          customer_profile_id: string
          distance_meters_at_checkin?: number | null
          id?: string
          seller_code?: string | null
          seller_user_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string
          checked_out_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          created_at?: string
          customer_profile_id?: string
          distance_meters_at_checkin?: number | null
          id?: string
          seller_code?: string | null
          seller_user_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_visits_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_visits_store_id_fkey"
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
      ingredient_categories: {
        Row: {
          category_id: string
          ingredient_id: string
        }
        Insert: {
          category_id: string
          ingredient_id: string
        }
        Update: {
          category_id?: string
          ingredient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_categories_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          created_at: string
          extra_price: number
          id: string
          is_active: boolean
          name: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_price?: number
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_price?: number
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_create_errors: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string
          id: string
          payload_summary: Json
          store_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string
          id?: string
          payload_summary?: Json
          store_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string
          id?: string
          payload_summary?: Json
          store_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          client_order_id: string | null
          created_at: string
          customer: Json
          delivery_fee: number
          delivery_shift: string
          discount: number
          id: string
          items: Json
          observations: string | null
          order_number: number
          origem: string
          payment_method: string
          status: string
          store_id: string
          subtotal: number
          total: number
          user_id: string | null
        }
        Insert: {
          client_order_id?: string | null
          created_at?: string
          customer?: Json
          delivery_fee?: number
          delivery_shift?: string
          discount?: number
          id?: string
          items?: Json
          observations?: string | null
          order_number?: number
          origem?: string
          payment_method?: string
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Update: {
          client_order_id?: string | null
          created_at?: string
          customer?: Json
          delivery_fee?: number
          delivery_shift?: string
          discount?: number
          id?: string
          items?: Json
          observations?: string | null
          order_number?: number
          origem?: string
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
      pizza_borders: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pizza_flavors: {
        Row: {
          category_id: string | null
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          store_id: string
        }
        Insert: {
          category_id?: string | null
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          store_id: string
        }
        Update: {
          category_id?: string | null
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_flavors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_flavors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_sizes: {
        Row: {
          id: string
          is_active: boolean
          max_flavors: number
          name: string
          price: number
          sort_order: number
          store_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          max_flavors?: number
          name: string
          price?: number
          sort_order?: number
          store_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          max_flavors?: number
          name?: string
          price?: number
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_sizes_store_id_fkey"
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
      product_assembly: {
        Row: {
          allow_border: boolean
          allow_observation: boolean
          created_at: string
          default_ingredient_ids: string[]
          limits_by_variant: Json
          mode: string
          product_id: string
          updated_at: string
        }
        Insert: {
          allow_border?: boolean
          allow_observation?: boolean
          created_at?: string
          default_ingredient_ids?: string[]
          limits_by_variant?: Json
          mode?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          allow_border?: boolean
          allow_observation?: boolean
          created_at?: string
          default_ingredient_ids?: string[]
          limits_by_variant?: Json
          mode?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_assembly_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      product_kit_items: {
        Row: {
          component_product_id: string
          created_at: string
          id: string
          kit_product_id: string
          quantity: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          component_product_id: string
          created_at?: string
          id?: string
          kit_product_id: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          component_product_id?: string
          created_at?: string
          id?: string
          kit_product_id?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_kit_items_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_kit_items_kit_product_id_fkey"
            columns: ["kit_product_id"]
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
          price_table_1: number
          price_table_11: number
          price_table_4: number
          price_table_9: number
          price_table_res: number | null
          product_id: string
          size: string | null
          sku: string
          stock: number
        }
        Insert: {
          color?: string | null
          id?: string
          price?: number
          price_table_1?: number
          price_table_11?: number
          price_table_4?: number
          price_table_9?: number
          price_table_res?: number | null
          product_id: string
          size?: string | null
          sku?: string
          stock?: number
        }
        Update: {
          color?: string | null
          id?: string
          price?: number
          price_table_1?: number
          price_table_11?: number
          price_table_4?: number
          price_table_9?: number
          price_table_res?: number | null
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
          bling_code: string | null
          category_id: string | null
          code: string
          created_at: string
          description: string
          duration_minutes: number
          group_id: string | null
          has_variants: boolean
          id: string
          image_url: string | null
          is_active: boolean
          is_kit: boolean
          name: string
          price_table_1: number
          price_table_11: number
          price_table_4: number
          price_table_9: number
          price_table_res: number | null
          stock: number
          store_id: string
          unit: string
        }
        Insert: {
          base_price?: number
          bling_code?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string
          duration_minutes?: number
          group_id?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_kit?: boolean
          name: string
          price_table_1?: number
          price_table_11?: number
          price_table_4?: number
          price_table_9?: number
          price_table_res?: number | null
          stock?: number
          store_id: string
          unit?: string
        }
        Update: {
          base_price?: number
          bling_code?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string
          duration_minutes?: number
          group_id?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_kit?: boolean
          name?: string
          price_table_1?: number
          price_table_11?: number
          price_table_4?: number
          price_table_9?: number
          price_table_res?: number | null
          stock?: number
          store_id?: string
          unit?: string
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          kind: string
          last_used_at: string
          p256dh: string
          seller_id: string | null
          store_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          kind?: string
          last_used_at?: string
          p256dh: string
          seller_id?: string | null
          store_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_used_at?: string
          p256dh?: string
          seller_id?: string | null
          store_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          number: number
          seats: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          number: number
          seats?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          number?: number
          seats?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      salon_appointments: {
        Row: {
          created_at: string
          customer_name: string
          customer_whatsapp: string | null
          ends_at: string
          id: string
          notes: string | null
          order_id: string | null
          professional_id: string
          service_id: string | null
          starts_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_whatsapp?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          order_id?: string | null
          professional_id: string
          service_id?: string | null
          starts_at: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_whatsapp?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          professional_id?: string
          service_id?: string | null
          starts_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_appointments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "salon_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_appointments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_professionals: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_professionals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_service_professionals: {
        Row: {
          professional_id: string
          service_id: string
        }
        Insert: {
          professional_id: string
          service_id: string
        }
        Update: {
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_service_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "salon_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_service_professionals_service_id_products_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_services_store_id_fkey"
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
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          store_id: string
          whatsapp: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          whatsapp: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      store_users: {
        Row: {
          can_manage_orders: boolean
          can_manage_products: boolean
          can_manage_service_orders: boolean
          can_manage_tables: boolean
          can_view_customers: boolean
          can_view_orders: boolean
          can_view_service_orders: boolean
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          role: string
          seller_codes: string[]
          seller_id: string | null
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_orders?: boolean
          can_manage_products?: boolean
          can_manage_service_orders?: boolean
          can_manage_tables?: boolean
          can_view_customers?: boolean
          can_view_orders?: boolean
          can_view_service_orders?: boolean
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: string
          seller_codes?: string[]
          seller_id?: string | null
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_orders?: boolean
          can_manage_products?: boolean
          can_manage_service_orders?: boolean
          can_manage_tables?: boolean
          can_view_customers?: boolean
          can_view_orders?: boolean
          can_view_service_orders?: boolean
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: string
          seller_codes?: string[]
          seller_id?: string | null
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_users_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "store_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_users_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          license_expires_at: string | null
          logo: string | null
          name: string
          phone: string | null
          settings: Json
          slug: string
          sort_order: number
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
          license_expires_at?: string | null
          logo?: string | null
          name: string
          phone?: string | null
          settings?: Json
          slug: string
          sort_order?: number
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
          license_expires_at?: string | null
          logo?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          slug?: string
          sort_order?: number
          type?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      tab_items: {
        Row: {
          border: Json | null
          code: string
          created_at: string
          id: string
          image: string | null
          ingredients: Json
          name: string
          observation: string | null
          paid_order_id: string | null
          product_id: string | null
          quantity: number
          removed_ingredients: Json
          status: string
          tab_id: string
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          border?: Json | null
          code?: string
          created_at?: string
          id?: string
          image?: string | null
          ingredients?: Json
          name: string
          observation?: string | null
          paid_order_id?: string | null
          product_id?: string | null
          quantity?: number
          removed_ingredients?: Json
          status?: string
          tab_id: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          border?: Json | null
          code?: string
          created_at?: string
          id?: string
          image?: string | null
          ingredients?: Json
          name?: string
          observation?: string | null
          paid_order_id?: string | null
          product_id?: string | null
          quantity?: number
          removed_ingredients?: Json
          status?: string
          tab_id?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          opened_at: string
          opened_by: string | null
          status: string
          store_id: string
          table_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          status?: string
          store_id: string
          table_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          status?: string
          store_id?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      table_tabs: {
        Row: {
          created_at: string
          id: string
          label: string | null
          number: number
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          number: number
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          number?: number
          session_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_order_recipients: {
        Args: { p_seller_code: string; p_store_id: string }
        Returns: {
          id: string
          kind: string
          name: string
          whatsapp: string
        }[]
      }
      has_any_store_access: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      has_store_permission: {
        Args: { _permission: string; _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_store_admin: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      upsert_push_subscription:
        | {
            Args: {
              p_auth: string
              p_endpoint: string
              p_p256dh: string
              p_seller_id: string
              p_store_id: string
              p_user_agent: string
            }
            Returns: string
          }
        | {
            Args: {
              p_auth: string
              p_endpoint: string
              p_kind?: string
              p_p256dh: string
              p_seller_id: string
              p_store_id: string
              p_user_agent: string
            }
            Returns: string
          }
      validate_coupon: {
        Args: { _code: string; _store_id: string; _subtotal: number }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
