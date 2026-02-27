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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      arbitrage_history: {
        Row: {
          arbitrage_id: string
          casa: string
          created_at: string
          id: string
          observacao: string | null
          resultado_anterior:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          resultado_novo: Database["public"]["Enums"]["arbitrage_status"]
          user_id: string
        }
        Insert: {
          arbitrage_id: string
          casa: string
          created_at?: string
          id?: string
          observacao?: string | null
          resultado_anterior?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          resultado_novo: Database["public"]["Enums"]["arbitrage_status"]
          user_id: string
        }
        Update: {
          arbitrage_id?: string
          casa?: string
          created_at?: string
          id?: string
          observacao?: string | null
          resultado_anterior?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          resultado_novo?: Database["public"]["Enums"]["arbitrage_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitrage_history_arbitrage_id_fkey"
            columns: ["arbitrage_id"]
            isOneToOne: false
            referencedRelation: "arbitrages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arbitrage_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitrages: {
        Row: {
          casa_01_mercado: string
          casa_01_nome: string
          casa_01_odd: number
          casa_01_parceria_id: string | null
          casa_01_resultado:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_01_valor: number
          casa_01_valor_resultado: number | null
          casa_02_mercado: string
          casa_02_nome: string
          casa_02_odd: number
          casa_02_parceria_id: string | null
          casa_02_resultado:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_02_valor: number
          casa_02_valor_resultado: number | null
          casa_03_mercado: string | null
          casa_03_nome: string | null
          casa_03_odd: number | null
          casa_03_parceria_id: string | null
          casa_03_resultado:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_03_valor: number | null
          casa_03_valor_resultado: number | null
          created_at: string
          data_evento: string
          descricao: string
          esporte_liga: string | null
          id: string
          lucro_projetado: number
          lucro_real: number | null
          porcentagem: number
          retorno_previsto: number
          status: Database["public"]["Enums"]["arbitrage_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          casa_01_mercado?: string
          casa_01_nome: string
          casa_01_odd: number
          casa_01_parceria_id?: string | null
          casa_01_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_01_valor: number
          casa_01_valor_resultado?: number | null
          casa_02_mercado?: string
          casa_02_nome: string
          casa_02_odd: number
          casa_02_parceria_id?: string | null
          casa_02_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_02_valor: number
          casa_02_valor_resultado?: number | null
          casa_03_mercado?: string | null
          casa_03_nome?: string | null
          casa_03_odd?: number | null
          casa_03_parceria_id?: string | null
          casa_03_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_03_valor?: number | null
          casa_03_valor_resultado?: number | null
          created_at?: string
          data_evento?: string
          descricao: string
          esporte_liga?: string | null
          id?: string
          lucro_projetado: number
          lucro_real?: number | null
          porcentagem: number
          retorno_previsto: number
          status?: Database["public"]["Enums"]["arbitrage_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          casa_01_mercado?: string
          casa_01_nome?: string
          casa_01_odd?: number
          casa_01_parceria_id?: string | null
          casa_01_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_01_valor?: number
          casa_01_valor_resultado?: number | null
          casa_02_mercado?: string
          casa_02_nome?: string
          casa_02_odd?: number
          casa_02_parceria_id?: string | null
          casa_02_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_02_valor?: number
          casa_02_valor_resultado?: number | null
          casa_03_mercado?: string | null
          casa_03_nome?: string | null
          casa_03_odd?: number | null
          casa_03_parceria_id?: string | null
          casa_03_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_03_valor?: number | null
          casa_03_valor_resultado?: number | null
          created_at?: string
          data_evento?: string
          descricao?: string
          esporte_liga?: string | null
          id?: string
          lucro_projetado?: number
          lucro_real?: number | null
          porcentagem?: number
          retorno_previsto?: number
          status?: Database["public"]["Enums"]["arbitrage_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitrages_casa_01_parceria_id_fkey"
            columns: ["casa_01_parceria_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arbitrages_casa_02_parceria_id_fkey"
            columns: ["casa_02_parceria_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arbitrages_casa_03_parceria_id_fkey"
            columns: ["casa_03_parceria_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arbitrages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_betting_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_betting_houses: {
        Row: {
          annotation: string | null
          annotation_color: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          name: string
          original_house_id: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          annotation?: string | null
          annotation_color?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          name: string
          original_house_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          annotation?: string | null
          annotation_color?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          name?: string
          original_house_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      hidden_betting_houses: {
        Row: {
          created_at: string
          group_id: string
          hidden_by: string
          house_id: string
          house_name: string
          id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          hidden_by: string
          house_id: string
          house_name: string
          id?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          hidden_by?: string
          house_id?: string
          house_name?: string
          id?: string
        }
        Relationships: []
      }
      house_annotations: {
        Row: {
          annotation: string
          annotation_color: string
          created_at: string
          created_by: string
          house_id: string
          id: string
          updated_at: string
        }
        Insert: {
          annotation: string
          annotation_color?: string
          created_at?: string
          created_by: string
          house_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          annotation?: string
          annotation_color?: string
          created_at?: string
          created_by?: string
          house_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_goals: {
        Row: {
          created_at: string
          goal_value: number
          id: string
          month: string
          partnership_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_value?: number
          id?: string
          month: string
          partnership_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_value?: number
          id?: string
          month?: string
          partnership_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      note_categories: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          category_id: string | null
          conteudo: string | null
          created_at: string
          data: string
          id: string
          titulo: string
          updated_at: string
          user_id: string
          valor: number | null
        }
        Insert: {
          category_id?: string | null
          conteudo?: string | null
          created_at?: string
          data?: string
          id?: string
          titulo: string
          updated_at?: string
          user_id: string
          valor?: number | null
        }
        Update: {
          category_id?: string | null
          conteudo?: string | null
          created_at?: string
          data?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "note_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_costs: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          descricao: string
          id?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      partnership_banks: {
        Row: {
          bank_id: string
          created_at: string
          id: string
          partnership_id: string
        }
        Insert: {
          bank_id: string
          created_at?: string
          id?: string
          partnership_id: string
        }
        Update: {
          bank_id?: string
          created_at?: string
          id?: string
          partnership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_banks_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_banks_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_houses: {
        Row: {
          created_at: string
          house_name: string
          id: string
          partnership_id: string
          saldo: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          house_name: string
          id?: string
          partnership_id: string
          saldo?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          house_name?: string
          id?: string
          partnership_id?: string
          saldo?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_houses_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          bancos_cadastrados: string
          cpf: string
          created_at: string
          data_inicio: string
          endereco: string
          id: string
          nome_completo: string
          status: string
          updated_at: string
          user_id: string
          valor_banca: number
        }
        Insert: {
          bancos_cadastrados: string
          cpf: string
          created_at?: string
          data_inicio: string
          endereco: string
          id?: string
          nome_completo: string
          status?: string
          updated_at?: string
          user_id: string
          valor_banca: number
        }
        Update: {
          bancos_cadastrados?: string
          cpf?: string
          created_at?: string
          data_inicio?: string
          endereco?: string
          id?: string
          nome_completo?: string
          status?: string
          updated_at?: string
          user_id?: string
          valor_banca?: number
        }
        Relationships: []
      }
      partnerships_history: {
        Row: {
          changed_at: string
          changed_by: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          partnership_id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          partnership_id: string
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          partnership_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnerships_history_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_partnership_id: string | null
          email: string
          expires_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_partnership_id?: string | null
          email: string
          expires_at?: string | null
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_partnership_id?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_partnership_id_fkey"
            columns: ["default_partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      push_config: {
        Row: {
          created_at: string
          id: string
          key_name: string
          key_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_name: string
          key_value: string
        }
        Update: {
          created_at?: string
          id?: string
          key_name?: string
          key_value?: string
        }
        Relationships: []
      }
      push_sent_log: {
        Row: {
          arbitrage_id: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          arbitrage_id: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          arbitrage_id?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_sent_log_arbitrage_id_fkey"
            columns: ["arbitrage_id"]
            isOneToOne: false
            referencedRelation: "arbitrages"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users_history: {
        Row: {
          changed_at: string
          changed_by: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_user_profile: { Args: { user_uuid: string }; Returns: undefined }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      arbitrage_status:
        | "aguardando"
        | "green"
        | "red"
        | "parcial_green"
        | "parcial_red"
        | "perda_total"
        | "devolvido"
        | "cashout"
      user_role: "admin_master" | "admin" | "operador"
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
    Enums: {
      arbitrage_status: [
        "aguardando",
        "green",
        "red",
        "parcial_green",
        "parcial_red",
        "perda_total",
        "devolvido",
        "cashout",
      ],
      user_role: ["admin_master", "admin", "operador"],
    },
  },
} as const
