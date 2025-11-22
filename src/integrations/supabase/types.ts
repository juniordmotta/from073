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
          casa_01_resultado:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_01_valor: number
          casa_01_valor_resultado: number | null
          casa_02_mercado: string
          casa_02_nome: string
          casa_02_odd: number
          casa_02_resultado:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_02_valor: number
          casa_02_valor_resultado: number | null
          casa_03_mercado: string | null
          casa_03_nome: string | null
          casa_03_odd: number | null
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
          casa_01_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_01_valor: number
          casa_01_valor_resultado?: number | null
          casa_02_mercado?: string
          casa_02_nome: string
          casa_02_odd: number
          casa_02_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_02_valor: number
          casa_02_valor_resultado?: number | null
          casa_03_mercado?: string | null
          casa_03_nome?: string | null
          casa_03_odd?: number | null
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
          casa_01_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_01_valor?: number
          casa_01_valor_resultado?: number | null
          casa_02_mercado?: string
          casa_02_nome?: string
          casa_02_odd?: number
          casa_02_resultado?:
            | Database["public"]["Enums"]["arbitrage_status"]
            | null
          casa_02_valor?: number
          casa_02_valor_resultado?: number | null
          casa_03_mercado?: string | null
          casa_03_nome?: string | null
          casa_03_odd?: number | null
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
            foreignKeyName: "arbitrages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
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
      ],
      user_role: ["admin_master", "admin", "operador"],
    },
  },
} as const
