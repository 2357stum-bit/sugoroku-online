import { useEffect, useState } from "react";
import { isSoundEnabled, toggleSound, onSoundChange, sfxHit } from "./galleryAudio.js";

export default function GallerySoundToggle({ className = "sgr-link-btn" }) {
  const [enabled, setEnabled] = useState(isSoundEnabled());

  useEffect(() => onSoundChange(setEnabled), []);

  return (
    <button
      className={className}
      onClick={() => {
        const next = toggleSound();
        if (next) sfxHit();
      }}
    >
      {enabled ? "🔊" : "🔇"}
    </button>
  );
}
