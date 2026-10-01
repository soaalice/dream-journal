import React, { useState } from 'react';
import { Dices } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Chip } from './ui/Chip';

interface EmojiAvatarPickerProps {
  initialAvatarUrl?: string;
  onAvatarChange: (avatarUrl: string) => void;
}

const OPTIONS = {
  eyes: [
    'closed', 'closed2', 'crying', 'cute', 'glasses',
    'love', 'pissed', 'plain', 'sad', 'shades',
    'sleepClose', 'stars', 'tearDrop', 'wink', 'wink2'
  ],
  mouth: [
    'cute', 'drip', 'faceMask', 'kissHeart', 'lilSmile',
    'pissed', 'plain', 'sad', 'shout', 'shy',
    'sick', 'smileLol', 'smileTeeth', 'tongueOut', 'wideSmile'
  ],
  color: ['ffadad', 'ffd6a5', 'fdffb6', 'caffbf', '9bf6ff', 'a0c4ff', 'bdb2ff', 'ffc6ff']
};

type Selection = { eyes: string; mouth: string; color: string };

const DEFAULT: Selection = { eyes: 'plain', mouth: 'smileTeeth', color: 'a0c4ff' };

const toUrl = (s: Selection) =>
  `https://api.dicebear.com/8.x/fun-emoji/svg?eyes=${s.eyes}&mouth=${s.mouth}&backgroundColor=${s.color}`;

const fromUrl = (url?: string): Selection => {
  if (!url?.includes('dicebear')) return DEFAULT;
  try {
    const params = new URL(url).searchParams;
    return {
      eyes: params.get('eyes') || DEFAULT.eyes,
      mouth: params.get('mouth') || DEFAULT.mouth,
      color: params.get('backgroundColor')?.replace('#', '') || DEFAULT.color
    };
  } catch {
    return DEFAULT;
  }
};

const random = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const EmojiAvatarPicker: React.FC<EmojiAvatarPickerProps> = ({ initialAvatarUrl, onAvatarChange }) => {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Selection>(() => fromUrl(initialAvatarUrl));
  const [draft, setDraft] = useState<Selection>(saved);

  const openModal = () => {
    setDraft(saved);
    setOpen(true);
  };

  const save = () => {
    setSaved(draft);
    onAvatarChange(toUrl(draft));
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-4">
      <img src={toUrl(saved)} alt="Your current avatar" className="h-16 w-16 rounded-full bg-surface-2 object-cover ring-2 ring-accent" />
      <Button variant="secondary" onClick={openModal}>
        Customize avatar
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Customize your avatar"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save avatar</Button>
          </>
        }
      >
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src={toUrl(draft)} alt="Avatar preview" className="h-28 w-28 rounded-full bg-surface-2 ring-4 ring-accent" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft({ eyes: random(OPTIONS.eyes), mouth: random(OPTIONS.mouth), color: random(OPTIONS.color) })}
          >
            <Dices className="h-4 w-4" aria-hidden />
            Randomize
          </Button>
        </div>

        <div className="space-y-5">
          {(['eyes', 'mouth'] as const).map((group) => (
            <fieldset key={group}>
              <legend className="mb-2 text-sm font-medium capitalize">{group}</legend>
              <div className="flex flex-wrap gap-2">
                {OPTIONS[group].map((value) => (
                  <Chip key={value} selected={draft[group] === value} onClick={() => setDraft({ ...draft, [group]: value })}>
                    {value}
                  </Chip>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Background colour</legend>
            <div className="flex flex-wrap gap-2">
              {OPTIONS.color.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Colour #${color}`}
                  aria-pressed={draft.color === color}
                  onClick={() => setDraft({ ...draft, color })}
                  style={{ backgroundColor: `#${color}` }}
                  className={`h-10 w-10 rounded-full border-2 transition-transform hover:scale-110 ${
                    draft.color === color ? 'scale-110 border-accent' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </Modal>
    </div>
  );
};

export default EmojiAvatarPicker;
