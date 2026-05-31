import { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { UserSettings } from '@nts/shared';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '#/components/ui/dialog';
import { Input } from '#/components/ui/input';
import { Button } from '#/components/ui/button';
import { Label } from '#/components/ui/label';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ACCEPT_STRING = '.png,.jpg,.jpeg,.webp,.gif';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const settings = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const r = await fetch('/api/settings');
      if (!r.ok) throw new Error(`settings: ${r.status}`);
      return r.json() as Promise<UserSettings>;
    },
  });

  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cardTilt, setCardTilt] = useState(true);

  useEffect(() => {
    if (open && settings.data) {
      setDisplayName(settings.data.displayName ?? '');
      setAvatar(settings.data.avatar ?? null);
      setCardTilt(settings.data.cardTilt ?? true);
    }
  }, [open, settings.data]);

  const mutation = useMutation({
    mutationFn: async (body: UserSettings) => {
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`save settings: ${r.status}`);
      return r.json() as Promise<UserSettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-settings'], data);
      onOpenChange(false);
    },
  });

  const loadFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleSave = () => {
    mutation.mutate({
      displayName: displayName.trim() || null,
      avatar,
      cardTilt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-ink-300 uppercase">
              Settings
            </p>
            <DialogTitle className="font-display text-lg font-semibold text-ink-900">
              Make it yours.
            </DialogTitle>
          </div>
          <DialogClose className="flex size-7 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-milk-100 hover:text-ink-500">
            <X className="size-4" />
          </DialogClose>
        </div>

        <div className="flex flex-col items-center gap-5">
          <motion.button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative flex size-24 items-center justify-center rounded-full border-2 border-dashed overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${
              dragging
                ? 'border-mint-500 bg-mint-50'
                : 'border-milk-400 bg-milk-100 hover:border-mint-400 hover:bg-mint-50'
            }`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt="Avatar"
                className="size-full object-cover"
              />
            ) : (
              <Camera className="size-6 text-ink-300" />
            )}
            {avatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                <Camera className="size-5 text-white" />
              </div>
            )}
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_STRING}
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={() => setAvatar(null)}
            className={`text-xs cursor-pointer transition-colors ${avatar ? 'text-ink-400 hover:text-ink-600' : 'invisible'}`}
          >
            Remove photo
          </button>

          <div className="w-full space-y-1.5">
            <Label htmlFor="display-name" className="text-ink-600">
              Display name
            </Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we greet you?"
            />
          </div>

          <div className="w-full flex items-center justify-between">
            <Label htmlFor="card-tilt" className="text-ink-600">
              3D card tilt
            </Label>
            <button
              id="card-tilt"
              type="button"
              role="switch"
              aria-checked={cardTilt}
              onClick={() => setCardTilt((v) => !v)}
              className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${cardTilt ? 'bg-mint-500' : 'bg-milk-300'}`}
            >
              <span
                className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform ${cardTilt ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="mt-2 w-full bg-mint-600 text-white hover:bg-mint-700"
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
