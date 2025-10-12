import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  name: string;
  department: string;
  id: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      // Mock authentication for local development
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userData = localStorage.getItem('user');
      
      if (isAuthenticated === 'true' && userData) {
        const parsedUser = JSON.parse(userData);
        const userDetails: User = {
          username: parsedUser.username,
          email: parsedUser.email,
          role: parsedUser.role || 'employee',
          name: parsedUser.username, // Use username as name for mock
          department: 'Development',
          id: parsedUser.id
        };
        setUser(userDetails);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.log('Not authenticated');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Mock sign out for local development
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshUser = async () => {
    setLoading(true);
    await fetchUser();
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    signOut: handleSignOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
