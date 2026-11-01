import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EmptyState } from './ui';
import { Icon } from './icons';
import type { Role } from '../types';

/** Скрывает страницу от неподходящих ролей. Это удобство интерфейса, а не защита: права проверяют сервисы. */
export default function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, hasRole } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) {
    return (
      <div className="card access-denied" role="alert">
        <EmptyState
          icon={<Icon name="lock" size={40} />}
          title="Раздел недоступен для вашей роли."
          description="Обратитесь к системному администратору, если доступ нужен для работы."
        />
      </div>
    );
  }
  return <>{children}</>;
}
