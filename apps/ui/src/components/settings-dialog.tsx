import { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, X, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { UserSettings, UserSettingsUpdate } from '@nts/shared';
import { DEFAULT_AI_MODEL } from '@nts/shared';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '#/components/ui/dialog';
import { Input } from '#/components/ui/input';
import { Textarea } from '#/components/ui/textarea';
import { Button } from '#/components/ui/button';
import { Label } from '#/components/ui/label';
import { Separator } from '#/components/ui/separator';

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
  const [soundEffects, setSoundEffects] = useState(true);
  const [dailyProgress, setDailyProgress] = useState(true);
  const [cardTypeBadge, setCardTypeBadge] = useState(true);
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [aiModel, setAiModel] = useState('');
  // The key is write-only: this input is always blank on open. `removeKey`
  // stages clearing a previously-saved key on save.
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [removeKey, setRemoveKey] = useState(false);

  const keyConfigured = settings.data?.hasApiKey ?? false;

  useEffect(() => {
    if (open && settings.data) {
      setDisplayName(settings.data.displayName ?? '');
      setAvatar(settings.data.avatar ?? null);
      setCardTilt(settings.data.cardTilt ?? true);
      setSoundEffects(settings.data.soundEffects ?? true);
      setDailyProgress(settings.data.dailyProgress ?? true);
      setCardTypeBadge(settings.data.cardTypeBadge ?? true);
      setAiSystemPrompt(settings.data.aiSystemPrompt ?? '');
      setAiModel(settings.data.aiModel ?? '');
      setApiKeyInput('');
      setRemoveKey(false);
    }
  }, [open, settings.data]);

  const mutation = useMutation({
    mutationFn: async (body: UserSettingsUpdate) => {
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
      soundEffects,
      dailyProgress,
      cardTypeBadge,
      aiSystemPrompt: aiSystemPrompt.trim() || null,
      aiModel: aiModel.trim() || null,
      apiKey: apiKeyInput.trim() || undefined,
      removeApiKey: removeKey || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-md flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-start justify-between px-6 pb-4 pt-6">
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

        <div className="flex flex-1 flex-col items-center gap-5 overflow-y-auto overscroll-contain scrollbar-hide px-6 pb-5">
          <motion.button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative flex size-24 shrink-0 items-center justify-center rounded-full border-2 border-dashed overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${
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

          <div className="w-full flex items-center justify-between">
            <Label htmlFor="sound-effects" className="text-ink-600">
              Swipe sounds
            </Label>
            <button
              id="sound-effects"
              type="button"
              role="switch"
              aria-checked={soundEffects}
              onClick={() => setSoundEffects((v) => !v)}
              className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${soundEffects ? 'bg-mint-500' : 'bg-milk-300'}`}
            >
              <span
                className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform ${soundEffects ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <div className="w-full flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="daily-progress" className="text-ink-600">
                Daily progress
              </Label>
              <span className="text-xs text-ink-300">
                Count today&rsquo;s earlier reviews in the progress bar
              </span>
            </div>
            <button
              id="daily-progress"
              type="button"
              role="switch"
              aria-checked={dailyProgress}
              onClick={() => setDailyProgress((v) => !v)}
              className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${dailyProgress ? 'bg-mint-500' : 'bg-milk-300'}`}
            >
              <span
                className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform ${dailyProgress ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <div className="w-full flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="card-type-badge" className="text-ink-600">
                Card type badge
              </Label>
              <span className="text-xs text-ink-300">
                Show new / learning / review in the card corner
              </span>
            </div>
            <button
              id="card-type-badge"
              type="button"
              role="switch"
              aria-checked={cardTypeBadge}
              onClick={() => setCardTypeBadge((v) => !v)}
              className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${cardTypeBadge ? 'bg-mint-500' : 'bg-milk-300'}`}
            >
              <span
                className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform ${cardTypeBadge ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <Separator className="my-1" />

          <div className="w-full space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-mint-600 dark:text-mint-500" />
              <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-ink-300 uppercase">
                AI Teacher
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-system-prompt" className="text-ink-600">
                Teacher instructions
              </Label>
              <Textarea
                id="ai-system-prompt"
                value={aiSystemPrompt}
                onChange={(e) => setAiSystemPrompt(e.target.value)}
                placeholder="Act as a patient Korean language teacher for absolute beginners. Your name is 전정국."
                className="min-h-24"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-model" className="text-ink-600">
                Model
              </Label>
              <Input
                id="ai-model"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder={DEFAULT_AI_MODEL}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai-key" className="text-ink-600">
                  OpenRouter API key
                </Label>
                {keyConfigured &&
                  (removeKey ? (
                    <button
                      type="button"
                      onClick={() => setRemoveKey(false)}
                      className="text-xs text-ink-400 transition-colors hover:text-ink-600"
                    >
                      Keep key
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveKey(true);
                        setApiKeyInput('');
                      }}
                      className="text-xs text-terra transition-colors hover:opacity-80"
                    >
                      Remove
                    </button>
                  ))}
              </div>
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  if (e.target.value) setRemoveKey(false);
                }}
                placeholder={
                  keyConfigured && !removeKey
                    ? '•••••••••••• saved — type to replace'
                    : 'sk-or-…'
                }
                className="font-mono text-xs"
              />
              {removeKey && (
                <p className="text-xs text-terra">
                  Key will be removed when you save.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pinned footer — the Save action stays reachable at any scroll
            position. A short gradient lets the form fade under it rather than
            ending in a hard cut. */}
        <div className="relative shrink-0 px-6 pb-6 pt-4">
          <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-linear-to-t from-card to-transparent" />
          <div className="absolute inset-x-6 top-0 h-px bg-milk-200/70" />
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="w-full bg-mint-600 text-white hover:bg-mint-700"
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
