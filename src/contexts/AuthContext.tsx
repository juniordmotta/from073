import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserRole {
  role: 'admin_master' | 'admin' | 'operador';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  isLoading: boolean;
  isExpired: boolean;
  expiresAt: Date | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;
    let roleLoaded = false; // Flag para evitar chamadas duplicadas
    
    const loadUserRole = async (userId: string) => {
      if (roleLoaded || !isMounted) return;
      roleLoaded = true;
      
      try {
        const [roleResult, profileResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('expires_at')
            .eq('id', userId)
            .maybeSingle(),
        ]);
        
        if (!isMounted) return;
        
        if (roleResult.error) {
          console.error('Error fetching user role:', roleResult.error);
          setUserRole(null);
        } else if (roleResult.data) {
          setUserRole(roleResult.data);
        } else {
          setUserRole(null);
        }

        if (profileResult.data?.expires_at) {
          setExpiresAt(new Date(profileResult.data.expires_at));
        } else {
          setExpiresAt(null);
        }
      } catch (err) {
        console.error('Unexpected error loading role:', err);
        if (isMounted) setUserRole(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    // Setup auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Usar setTimeout para evitar deadlock com Supabase
          setTimeout(() => loadUserRole(session.user.id), 0);
        } else {
          setUserRole(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => loadUserRole(session.user.id), 0);
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isExpired = expiresAt ? new Date() > expiresAt : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        isLoading,
        isExpired,
        expiresAt,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
