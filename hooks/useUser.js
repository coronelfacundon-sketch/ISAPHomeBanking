import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * React hook that returns the current authenticated user along with their
 * extended profile from the `users` table. When the auth state changes
 * (login or logout) the hook automatically updates. During initial
 * loading the user is null and a loading flag is provided.
 */
export default function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Helper to fetch the extended profile from the `users` table
    const fetchProfile = async (sessionUser) => {
      if (!sessionUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('company_name,type,role,status')
        .eq('id', sessionUser.id)
        .single();
      if (error) {
        console.error('Error fetching user profile:', error.message);
        setUser({ ...sessionUser });
      } else {
        setUser({ ...sessionUser, ...data });
      }
      setLoading(false);
    };

    // Get the current user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchProfile(session?.user || null);
    });

    // Listen for changes in authentication state
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      fetchProfile(session?.user || null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}