"use client";

import { useId, useRef, type ReactNode } from "react";
import { AlertTriangle, Smile } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  nowLocalInput,
  toLocalInputValue,
  type AnnouncementFormState,
} from "@/lib/announcements/payload";
import { isKnownAnnouncementType, type Announcement } from "@/types/announcement.types";
import { AnnouncementEditor } from "../editor/announcement-editor";
import { MediaField } from "../editor/media-field";
import { AccentColorPicker } from "../pickers/accent-color-picker";
import { ExpressionPanel } from "../pickers/expression-panel";
import { ANNOUNCEMENT_TYPE_METAS } from "../shared/type-meta";
import {
  TITLE_MAX,
  VERSION_MAX,
  fieldToFormMedia,
  formMediaToField,
  type ComposerField,
} from "./composer-draft";

export type ComposerErrors = Partial<Record<ComposerField, string>>;

export interface ComposerFormProps {
  form: AnnouncementFormState;
  onChange: (patch: Partial<AnnouncementFormState>) => void;
  /** Edit mode: the announcement as loaded (for the media of an existing video). */
  original: Announcement | null;
  /** One message per form field, client or server, already filtered to what is still relevant. */
  errors: ComposerErrors;
  /** "The end is before the start": a hint that does not block saving (the server has the last word). */
  windowWarning: string | null;
  disabled?: boolean;
  /** True while a file is being checked or uploaded. */
  onMediaBusyChange: (busy: boolean) => void;
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs break-words text-destructive">
      {children}
    </p>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-0.5">
        <h3 id={headingId} className="font-heading text-sm font-semibold">
          {title}
        </h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** A switch with its label and a one-line hint, in a bordered row. */
function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const hintId = `${id}-hint`;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="leading-snug">
          {label}
        </Label>
        {hint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        className="mt-0.5"
      />
    </div>
  );
}

/**
 * The composer's form column: Content (title with emoji, rich text), Media,
 * Style, Details. It owns no state: the dialog holds the form and the errors,
 * and every field's wrapper carries `data-field` so the dialog can scroll to
 * and focus the first field with a problem.
 */
export function ComposerForm({
  form,
  onChange,
  original,
  errors,
  windowWarning,
  disabled = false,
  onMediaBusyChange,
}: ComposerFormProps) {
  const t = useTranslations("announcements");
  const tc = useTranslations("announcements.composer");
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const titleRef = useRef<HTMLInputElement>(null);

  /** Insert at the caret (or replace the selection) without taking focus away from the panel. */
  const insertTitleEmoji = (emoji: string) => {
    const el = titleRef.current;
    const value = form.title;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const next = value.slice(0, start) + emoji + value.slice(end);
    if (next.length > TITLE_MAX) return;
    onChange({ title: next });
    const caret = start + emoji.length;
    requestAnimationFrame(() => el?.setSelectionRange(caret, caret));
  };

  const startNow = form.startsAt === "";
  const noEnd = form.endsAt === "";

  const changeStartNow = (checked: boolean) =>
    onChange({ startsAt: checked ? "" : nowLocalInput() });

  const changeNoEnd = (checked: boolean) => {
    if (checked) {
      onChange({ endsAt: "" });
      return;
    }
    // A week after the start (or after now), as a starting point to edit.
    const from = form.startsAt ? new Date(form.startsAt).getTime() : Date.now();
    onChange({
      endsAt: toLocalInputValue(new Date((Number.isNaN(from) ? Date.now() : from) + 7 * 86_400_000)),
    });
  };

  const mediaValue = formMediaToField(form.media, original);
  const knownType = isKnownAnnouncementType(form.type);

  return (
    <div data-slot="composer-form" className="space-y-8">
      {/* ── Content ─────────────────────────────────────────────────────── */}
      <Section title={tc("sections.content")}>
        <div data-field="title" className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor={id("title")}>{tc("fields.title")}</Label>
            <span
              className={cn(
                "text-xs tabular-nums text-muted-foreground",
                form.title.length >= TITLE_MAX && "font-medium text-red-600 dark:text-red-400",
              )}
            >
              {tc("fields.titleCounter", { count: form.title.length, max: TITLE_MAX })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              ref={titleRef}
              id={id("title")}
              value={form.title}
              onChange={(event) => onChange({ title: event.target.value })}
              maxLength={TITLE_MAX}
              placeholder={tc("fields.titlePlaceholder")}
              disabled={disabled}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? id("title-error") : undefined}
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            <ExpressionPanel
              onEmojiSelect={insertTitleEmoji}
              side="bottom"
              align="end"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={disabled}
                  className="shrink-0"
                >
                  <Smile aria-hidden />
                  <span className="sr-only">{tc("fields.emoji")}</span>
                </Button>
              }
            />
          </div>
          {errors.title && <FieldError id={id("title-error")}>{errors.title}</FieldError>}
        </div>

        <div data-field="body" className="space-y-1.5">
          <Label htmlFor={id("body")}>{tc("fields.body")}</Label>
          <AnnouncementEditor
            id={id("body")}
            value={form.body}
            onChange={(html) => onChange({ body: html })}
            invalid={!!errors.body}
            disabled={disabled}
            aria-describedby={errors.body ? id("body-error") : undefined}
          />
          {errors.body && <FieldError id={id("body-error")}>{errors.body}</FieldError>}
        </div>
      </Section>

      {/* ── Media ───────────────────────────────────────────────────────── */}
      <Section title={tc("sections.media")} description={tc("fields.mediaHint")}>
        <div data-field="media">
          <MediaField
            id={id("media")}
            value={mediaValue}
            onChange={(next) => onChange({ media: next ? fieldToFormMedia(next) : null })}
            onBusyChange={onMediaBusyChange}
            error={errors.media ?? null}
            disabled={disabled}
          />
        </div>
      </Section>

      {/* ── Style ───────────────────────────────────────────────────────── */}
      <Section title={tc("sections.style")} description={tc("fields.styleHint")}>
        <div data-field="color">
          <AccentColorPicker
            id={id("color")}
            value={{ start: form.colorStart || null, end: form.colorEnd || null }}
            onChange={(next) => onChange({ colorStart: next.start ?? "", colorEnd: next.end ?? "" })}
            error={errors.color ?? null}
            disabled={disabled}
            previewTitle={form.title.trim() || undefined}
          />
        </div>
      </Section>

      {/* ── Details ─────────────────────────────────────────────────────── */}
      <Section title={tc("sections.details")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-field="type" className="min-w-0 space-y-1.5">
            <Label htmlFor={id("type")}>{tc("fields.type")}</Label>
            <Select
              value={form.type}
              onValueChange={(value) => onChange({ type: value })}
              disabled={disabled}
            >
              <SelectTrigger
                id={id("type")}
                className="w-full"
                aria-invalid={errors.type ? true : undefined}
                aria-describedby={errors.type ? id("type-error") : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANNOUNCEMENT_TYPE_METAS.map((meta) => (
                  <SelectItem key={meta.type} value={meta.type}>
                    <meta.icon className={meta.text} aria-hidden />
                    {t(meta.labelKey)}
                  </SelectItem>
                ))}
                {/* A type the backend invented: keep it selectable so editing never silently changes it. */}
                {!knownType && form.type && <SelectItem value={form.type}>{form.type}</SelectItem>}
              </SelectContent>
            </Select>
            {errors.type && <FieldError id={id("type-error")}>{errors.type}</FieldError>}
          </div>

          <div data-field="version" className="min-w-0 space-y-1.5">
            <Label htmlFor={id("version")}>{tc("fields.version")}</Label>
            <Input
              id={id("version")}
              value={form.version}
              onChange={(event) => onChange({ version: event.target.value })}
              maxLength={VERSION_MAX}
              placeholder={tc("fields.versionPlaceholder")}
              disabled={disabled}
              autoComplete="off"
              aria-invalid={errors.version ? true : undefined}
              aria-describedby={errors.version ? id("version-error") : undefined}
            />
            {errors.version && <FieldError id={id("version-error")}>{errors.version}</FieldError>}
          </div>
        </div>

        {/* Schedule: no start / no end are real nulls on the server */}
        <fieldset className="min-w-0 space-y-4 rounded-lg border p-3 sm:p-4">
          <legend className="px-1 text-sm font-medium">{tc("fields.schedule")}</legend>

          <div data-field="starts_at" className="space-y-3">
            <SwitchRow
              id={id("start-now")}
              label={tc("fields.startNow")}
              hint={tc("fields.startNowHint")}
              checked={startNow}
              onCheckedChange={changeStartNow}
              disabled={disabled}
            />
            {!startNow && (
              <div className="space-y-1.5">
                <Label htmlFor={id("starts-at")} className="text-xs text-muted-foreground">
                  {tc("fields.startsAt")}
                </Label>
                <Input
                  id={id("starts-at")}
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => onChange({ startsAt: event.target.value })}
                  disabled={disabled}
                  aria-invalid={errors.starts_at ? true : undefined}
                  aria-describedby={errors.starts_at ? id("starts-error") : undefined}
                  className="sm:max-w-64"
                />
              </div>
            )}
            {errors.starts_at && <FieldError id={id("starts-error")}>{errors.starts_at}</FieldError>}
          </div>

          <div className="border-t" />

          <div data-field="ends_at" className="space-y-3">
            <SwitchRow
              id={id("no-end")}
              label={tc("fields.noEnd")}
              hint={tc("fields.noEndHint")}
              checked={noEnd}
              onCheckedChange={changeNoEnd}
              disabled={disabled}
            />
            {!noEnd && (
              <div className="space-y-1.5">
                <Label htmlFor={id("ends-at")} className="text-xs text-muted-foreground">
                  {tc("fields.endsAt")}
                </Label>
                <Input
                  id={id("ends-at")}
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => onChange({ endsAt: event.target.value })}
                  disabled={disabled}
                  aria-invalid={errors.ends_at ? true : undefined}
                  aria-describedby={errors.ends_at ? id("ends-error") : undefined}
                  className="sm:max-w-64"
                />
              </div>
            )}
            {errors.ends_at && <FieldError id={id("ends-error")}>{errors.ends_at}</FieldError>}
            {!errors.ends_at && windowWarning && (
              <p
                role="status"
                className="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">{windowWarning}</span>
              </p>
            )}
          </div>
        </fieldset>

        <div className="space-y-4 rounded-lg border p-3 sm:p-4">
          <SwitchRow
            id={id("active")}
            label={tc("fields.active")}
            hint={tc("fields.activeHint")}
            checked={form.isActive}
            onCheckedChange={(checked) => onChange({ isActive: checked })}
            disabled={disabled}
          />
          <div className="border-t" />
          <SwitchRow
            id={id("pinned")}
            label={tc("fields.pinned")}
            hint={tc("fields.pinnedHint")}
            checked={form.isPinned}
            onCheckedChange={(checked) => onChange({ isPinned: checked })}
            disabled={disabled}
          />
        </div>
      </Section>
    </div>
  );
}
