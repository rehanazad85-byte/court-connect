import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const finish = (session: Session | null) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    };

    const timeout = window.setTimeout(() => finish(null), 4000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      window.clearTimeout(timeout);
      finish(session);
    });
    supabase.auth.getSession()
      .then(({ data }) => {
        window.clearTimeout(timeout);
        finish(data.session);
      })
      .catch(() => {
        window.clearTimeout(timeout);
        finish(null);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, loading, signOut };
}
