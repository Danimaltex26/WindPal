import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  var _user = null;
  var _session = null;
  const [user, setUser] = useState(_user);
  const [session, setSession] = useState(_session);
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    supabase.auth.getSession().then(function (result) {
      var s = result.data.session;
      setSession(s);
      setUser(s ? s.user : null);
      setLoading(false);
    });

    var sub = supabase.auth.onAuthStateChange(function (_event, s) {
      setSession(s);
      setUser(s ? s.user : null);
      setLoading(false);
    });

    return function () { sub.data.subscription.unsubscribe(); };
  }, []);

  async function signIn(email, password) {
    var result = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signUp(email, password, displayName) {
    var options = displayName ? { data: { display_name: displayName } } : undefined;
    var result = await supabase.auth.signUp({
      email: email,
      password: password,
      options: options,
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signInWithMagicLink(email) {
    var result = await supabase.auth.signInWithOtp({ email: email });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signOut() {
    var result = await supabase.auth.signOut();
    if (result.error) throw result.error;
  }

  return (
    <AuthContext.Provider value={{ user: user, session: session, loading: loading, signIn: signIn, signUp: signUp, signInWithMagicLink: signInWithMagicLink, signOut: signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  var ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
