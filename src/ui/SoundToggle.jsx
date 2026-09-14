import { useEffect, useState } from "react";
import { isSoundEnabled, toggleSound, onSoundChange, sfxChoiceClick } from "../audio.js";

export default function SoundToggle({ className = "sgr-link-btn" }) {
  const [enabled, setEnabled] = useState(isSoundEnabled());

  useEffect(() => onSoundChange(setEnabled), []);

  return (
    <button
      className={className}
      onClick={() => {
        const next = toggleSound();
        if (next) sfxChoiceClick();
      }}
    >
      {enabled ? "🔊" : "🔇"}
    </button>
  );
}
