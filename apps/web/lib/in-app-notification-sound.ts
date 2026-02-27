const SOUND_ENABLED_KEY = 'hostea:in-app-sound-enabled';
const SOUND_UNLOCKED_KEY = 'hostea:in-app-sound-unlocked';
const EVENT_NAME = 'hostea:inapp-alert';
const SOUND_SRC = '/sounds/ping.wav';

let audioElement: HTMLAudioElement | null = null;

const getAudioElement = () => {
  if (typeof window === 'undefined') return null;
  if (!audioElement) {
    audioElement = new Audio(SOUND_SRC);
    audioElement.preload = 'auto';
  }
  return audioElement;
};

export const inAppSoundEventName = EVENT_NAME;

export const isInAppSoundEnabled = () => {
  if (typeof window === 'undefined') return false;
  const value = window.localStorage.getItem(SOUND_ENABLED_KEY);
  return value !== '0';
};

export const setInAppSoundEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_ENABLED_KEY, enabled ? '1' : '0');
};

export const markInAppSoundUnlocked = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_UNLOCKED_KEY, '1');
};

export const isInAppSoundUnlocked = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SOUND_UNLOCKED_KEY) === '1';
};

export const playInAppNotificationSound = async () => {
  if (typeof window === 'undefined') return false;
  if (!isInAppSoundEnabled() || !isInAppSoundUnlocked()) return false;
  const audio = getAudioElement();
  if (!audio) return false;
  try {
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    return false;
  }
};

export const emitInAppNotificationSound = (type: 'message' | 'reservation') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type, at: Date.now() } }));
};
