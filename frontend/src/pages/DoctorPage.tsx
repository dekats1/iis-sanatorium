import { useEffect, useState } from 'react';
import { directory } from '../api/endpoints';
import { ErrorBox, Tabs } from '../components/ui';
import { AssignmentPanel } from '../components/doctor/AssignmentPanel';
import { DaySchedule } from '../components/doctor/DaySchedule';
import { DoctorEhr } from '../components/doctor/DoctorEhr';
import type { Procedure } from '../types';

type DoctorTab = 'assignments' | 'daily' | 'ehr';

export default function DoctorPage() {
  const [activeTab, setActiveTab] = useState<DoctorTab>('assignments');
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [proceduresLoading, setProceduresLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    directory
      .procedures()
      .then(setProcedures)
      .catch(setError)
      .finally(() => setProceduresLoading(false));
  }, []);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Рабочее место врача</h1>
          <p className="page-subtitle">
            Назначение процедур с контролем противопоказаний, расписание сеансов и электронные медкарты
          </p>
        </div>
        <Tabs<DoctorTab>
          label="Разделы рабочего места врача"
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'assignments', label: 'Назначения', icon: 'clipboard' },
            { id: 'daily', label: 'Расписание на день', icon: 'calendar' },
            { id: 'ehr', label: 'Медкарта', icon: 'stethoscope' },
          ]}
        />
      </div>

      <ErrorBox error={error} />

      {activeTab === 'assignments' && <AssignmentPanel procedures={procedures} proceduresLoading={proceduresLoading} />}
      {activeTab === 'daily' && <DaySchedule />}
      {activeTab === 'ehr' && <DoctorEhr />}
    </section>
  );
}
