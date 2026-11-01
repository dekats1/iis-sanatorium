import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';

/** Скрывает страницу от неподходящих ролей. Это удобство интерфейса, а не защита: права проверяют сервисы. */
export default function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, hasRole } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) {
    return <p className="error">Раздел недоступен для вашей роли.</p>;
  }
  return <>{children}</>;
}
