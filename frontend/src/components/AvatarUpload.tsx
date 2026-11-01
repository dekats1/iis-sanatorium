import { useRef, useState, type ChangeEvent } from 'react';
import { Button, ErrorBox, Modal, Spinner, useConfirm } from './ui';
import { Icon } from './icons';
import { compressImage, PRESET_AVATARS, type PresetAvatar } from '../utils/avatar';

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  userName?: string;
  onSaveAvatar: (newUrl: string | null) => void;
  size?: number;
}

export default function AvatarUpload({
  currentAvatarUrl,
  userName = 'Пользователь',
  onSaveAvatar,
  size = 96,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, confirmDialog] = useConfirm();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      const dataUrl = await compressImage(file, 256, 0.85);
      onSaveAvatar(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить изображение');
    } finally {
      setBusy(false);
      // Сбрасываем input, чтобы повторный выбор того же файла снова вызвал onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (preset: PresetAvatar) => {
    setError(null);
    onSaveAvatar(preset.url);
    setIsPresetModalOpen(false);
  };

  const handleRemove = async () => {
    const ok = await ask({
      title: 'Удалить фото профиля?',
      message: 'Вместо фото будет показана первая буква имени. Загрузить новое фото можно в любой момент.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    onSaveAvatar(null);
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const initial = userName.trim().slice(0, 1).toUpperCase() || 'U';

  return (
    <div className="gx-avatar">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="gx-visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      <button
        type="button"
        className="gx-avatar-circle"
        style={{ width: size, height: size }}
        onClick={openFilePicker}
        disabled={busy}
        aria-label={`Загрузить новое фото профиля (${userName})`}
        title="Нажмите, чтобы загрузить новое фото"
      >
        {currentAvatarUrl ? (
          <img src={currentAvatarUrl} alt="" className="gx-avatar-img" />
        ) : (
          <span className="gx-avatar-initial" style={{ fontSize: size * 0.42 }} aria-hidden="true">
            {initial}
          </span>
        )}

        <span className="gx-avatar-overlay" aria-hidden="true">
          <Icon name="camera" size={20} />
        </span>

        {busy && (
          <span className="gx-avatar-busy">
            <Spinner label="Обработка изображения" />
          </span>
        )}
      </button>

      <div className="gx-avatar-side">
        <div className="u-flex-wrap u-inline-gap">
          <Button type="button" variant="outline" size="sm" onClick={openFilePicker} disabled={busy} icon={<Icon name="camera" size={16} />}>
            Загрузить фото
          </Button>

          <Button type="button" variant="ghost" size="sm" onClick={() => setIsPresetModalOpen(true)} disabled={busy} icon={<Icon name="image" size={16} />}>
            Выбрать аватар
          </Button>

          {currentAvatarUrl && (
            <Button type="button" variant="ghost" size="sm" className="gx-text-danger" onClick={() => void handleRemove()} disabled={busy} icon={<Icon name="trash" size={16} />}>
              Удалить
            </Button>
          )}
        </div>

        <p className="u-muted-sm u-m0">
          Поддерживаются форматы JPG, PNG или WebP (до 10 МБ). Автоматически кадрируется в круг.
        </p>

        <ErrorBox error={error} />
      </div>

      <Modal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        title="Выберите готовый аватар санатория"
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setIsPresetModalOpen(false)}>
            Отмена
          </Button>
        }
      >
        <div className="gx-presets">
          {PRESET_AVATARS.map((preset) => {
            const selected = preset.url === currentAvatarUrl;
            return (
              <button
                key={preset.id}
                type="button"
                className="gx-preset"
                aria-pressed={selected}
                onClick={() => handleSelectPreset(preset)}
                title={preset.description}
              >
                <img src={preset.url} alt="" className="gx-preset-img" />
                <span className="gx-preset-info">
                  <strong className="gx-preset-title">{preset.name}</strong>
                  <span className="gx-preset-desc">{preset.description}</span>
                </span>
                {selected && (
                  <span className="gx-preset-check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Modal>

      {confirmDialog}
    </div>
  );
}
