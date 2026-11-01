import { useRef, useState, type ChangeEvent } from 'react';
import { Button, Modal } from './ui';
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
      // Reset input so re-selecting same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (preset: PresetAvatar) => {
    setError(null);
    onSaveAvatar(preset.url);
    setIsPresetModalOpen(false);
  };

  const handleRemove = () => {
    setError(null);
    onSaveAvatar(null);
  };

  const initial = userName.trim().slice(0, 1).toUpperCase() || 'U';

  return (
    <div className="avatar-upload-container">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Main Avatar Preview circle */}
      <div
        className="avatar-preview-wrap"
        style={{ width: size, height: size }}
        onClick={() => fileInputRef.current?.click()}
        title="Нажмите, чтобы загрузить новое фото"
      >
        {currentAvatarUrl ? (
          <img src={currentAvatarUrl} alt={userName} className="avatar-preview-img" />
        ) : (
          <div className="avatar-placeholder-circle" style={{ fontSize: size * 0.42 }}>
            {initial}
          </div>
        )}

        <div className="avatar-edit-overlay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>

        {busy && <div className="avatar-spinner-overlay">...</div>}
      </div>

      {/* Action Controls */}
      <div className="avatar-actions-wrap">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Загрузить фото
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsPresetModalOpen(true)}
            disabled={busy}
          >
            Выбрать аватар
          </Button>

          {currentAvatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={busy}
              style={{ color: 'var(--danger, #ef4444)' }}
            >
              Удалить
            </Button>
          )}
        </div>

        <p className="avatar-hint-text">
          Поддерживаются форматы JPG, PNG или WebP (до 10 МБ). Автоматически кадрируется в круг.
        </p>

        {error && <p className="avatar-error-text">{error}</p>}
      </div>

      {/* Presets Modal */}
      {isPresetModalOpen && (
        <Modal
          isOpen={isPresetModalOpen}
          onClose={() => setIsPresetModalOpen(false)}
          title="Выберите готовый аватар санатория"
          size="md"
        >
          <div className="avatar-presets-grid">
            {PRESET_AVATARS.map((preset) => (
              <div
                key={preset.id}
                className="avatar-preset-item"
                onClick={() => handleSelectPreset(preset)}
                title={preset.description}
              >
                <img src={preset.url} alt={preset.name} className="avatar-preset-img" />
                <div className="avatar-preset-info">
                  <strong className="avatar-preset-title">{preset.name}</strong>
                  <span className="avatar-preset-desc">{preset.description}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setIsPresetModalOpen(false)}>
              Отмена
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
