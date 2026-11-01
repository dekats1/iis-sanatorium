import { describe, expect, it, vi } from 'vitest';
import { getUserAvatar, onAvatarChange, PRESET_AVATARS, setUserAvatar } from './avatar';

describe('Avatar utilities and presets', () => {
  it('provides rich themed sanatorium presets', () => {
    expect(PRESET_AVATARS.length).toBeGreaterThanOrEqual(6);
    expect(PRESET_AVATARS[0].id).toBe('pine');
    expect(PRESET_AVATARS[0].url).toContain('data:image/svg+xml');
  });

  it('stores and retrieves user avatar from localStorage and dispatches change events', () => {
    const username = 'test_guest_1';
    expect(getUserAvatar(username)).toBeNull();

    const listener = vi.fn();
    const unsubscribe = onAvatarChange(listener);

    const fakeAvatarData = 'data:image/webp;base64,UklGRk...';
    setUserAvatar(username, fakeAvatarData);

    expect(getUserAvatar(username)).toBe(fakeAvatarData);
    expect(listener).toHaveBeenCalled();

    // Clear avatar
    setUserAvatar(username, null);
    expect(getUserAvatar(username)).toBeNull();

    unsubscribe();
  });
});
