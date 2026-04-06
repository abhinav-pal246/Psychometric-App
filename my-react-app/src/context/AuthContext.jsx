import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);
const API_URL = "http://localhost:3000";

// useState is a hook we use in react
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check session on moun , Immediately asks your Express server: "is there already a session cookie in this browser?"
  //
  useEffect(() => {
    fetch(`${API_URL}/api/user`, { credentials: "include" }) //The browser itself doesn't know if you're logged in. Only the server knows, because only the server has the RAM data. The cookie is just the key to find that data.
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Listen for popup messages
  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== API_URL) return;
      const data = event.data;
      if (data.success) {
        setUser({ email: data.email, name: data.name });
        setError(null);
        // Re-fetch full user data from session
        fetch(`${API_URL}/api/user`, { credentials: "include" })
          .then((res) => res.json())
          .then((d) => {
            if (d.authenticated) setUser(d.user);
          });
      } else {
        setError(data.message);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const openPopup = (url) => {
    const w = 500, h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(url, "google-auth", `width=${w},height=${h},left=${left},top=${top}`); //simple 
  };

  const signup = () => { //Clears old errors. Calls openPopup with the URL.
    setError(null);
    openPopup(`${API_URL}/auth/google/signup`);
  };

  const login = () => {
    setError(null);
    openPopup(`${API_URL}/auth/google/login`);
  };

  const logout = async () => {
    await fetch(`${API_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setError(null);
  };

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, error, signup, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
 