import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let sessionRevision = 0;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionRevision += 1;
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const requestedRevision = sessionRevision;
    supabase.auth.getUser().then(({ data: { user } }) => {
      // A delayed initial lookup must not undo a later login/logout/account switch.
      if (!active || requestedRevision !== sessionRevision) return;
      setUser(user ?? null);
      setLoading(false);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { user: null, hasSession: false, error };

    // With auto-confirm enabled, session is returned immediately.
    // Wait for onAuthStateChange to propagate.
    if (data?.session) {
      // Give onAuthStateChange time to fire and update the user state
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          // We can't read React state here, so just wait a reasonable time
          clearInterval(checkInterval);
          resolve();
        }, 600);
      });
    }

    return { user: data?.user ?? null, hasSession: !!data?.session, error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signUp, signIn, signOut };
}
