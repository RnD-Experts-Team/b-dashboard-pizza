"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Code,
  ExternalLink,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Palette,
  Pencil,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Smile,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ExpressionPanel } from "../pickers/expression-panel";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Links                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** The only schemes a link may use. The sanitizer enforces the same list on display. */
const ALLOWED_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/** The scheme of a URL-ish string ("https", "mailto", "javascript" …), or null when it has none. */
function schemeOf(value: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  return match ? match[1].toLowerCase() : null;
}

/**
 * What the user typed into the link box, as an href: a bare domain gets
 * `https://`, an e-mail address gets `mailto:`, and anything with a scheme
 * other than http / https / mailto / tel (javascript:, data: …) is refused.
 */
export function normalizeLinkInput(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;

  const scheme = schemeOf(value);
  if (scheme && ALLOWED_SCHEMES.has(scheme)) return value;

  // "localhost:3000" and "example.com:8080/x" look like a scheme but are a host and a port.
  const hostWithPort = !!scheme && /^[^\s:/]+:\d+(?:[/?#]|$)/.test(value);
  if (scheme && !hostWithPort) return null;

  if (!scheme && /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return `mailto:${value}`;

  // "example.com", "www.example.org/path", "localhost:3000"
  if (
    hostWithPort ||
    /^[^\s/]+\.[^\s/]+/.test(value) ||
    /^localhost(?::\d+)?(?:\/|$)/i.test(value)
  ) {
    const href = `https://${value}`;
    try {
      new URL(href);
      return href;
    } catch {
      return null;
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Text colours: a small, deliberate set                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const TEXT_COLORS = [
  { id: "red", value: "#dc2626" },
  { id: "orange", value: "#ea580c" },
  { id: "green", value: "#16a34a" },
  { id: "blue", value: "#2563eb" },
  { id: "gray", value: "#6b7280" },
] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Toolbar state (Tiptap 3 does not re-render on every transaction)         */
/* ────────────────────────────────────────────────────────────────────────── */

type Align = "left" | "center" | "right";

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  highlight: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  h2: boolean;
  h3: boolean;
  paragraph: boolean;
  align: Align;
  color: string | null;
  link: boolean;
  linkHref: string;
  canUndo: boolean;
  canRedo: boolean;
  characters: number;
}

const EMPTY_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  highlight: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  h2: false,
  h3: false,
  paragraph: true,
  align: "left",
  color: null,
  link: false,
  linkHref: "",
  canUndo: false,
  canRedo: false,
  characters: 0,
};

function readState(editor: Editor | null): ToolbarState {
  if (!editor) return EMPTY_STATE;
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    highlight: editor.isActive("highlight"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    blockquote: editor.isActive("blockquote"),
    h2: editor.isActive("heading", { level: 2 }),
    h3: editor.isActive("heading", { level: 3 }),
    paragraph: editor.isActive("paragraph"),
    align: editor.isActive({ textAlign: "center" })
      ? "center"
      : editor.isActive({ textAlign: "right" })
        ? "right"
        : "left",
    color: (editor.getAttributes("textStyle").color as string | undefined) ?? null,
    link: editor.isActive("link"),
    linkHref: (editor.getAttributes("link").href as string | undefined) ?? "",
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    characters: editor.storage.characterCount?.characters?.() ?? 0,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Toolbar pieces                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function usePlatformKeys() {
  return useMemo(() => {
    const mac =
      typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
    return (combo: string) =>
      combo
        .replace("Mod", mac ? "⌘" : "Ctrl")
        .replace("Shift", mac ? "⇧" : "Shift")
        .replace("Alt", mac ? "⌥" : "Alt")
        .replace(/-/g, mac ? "" : "+");
  }, []);
}

interface ToolbarButtonProps extends Omit<ComponentProps<typeof Button>, "children" | "title"> {
  label: string;
  shortcut?: string;
  /** Set for toggles: becomes `aria-pressed` and the "on" look. */
  active?: boolean;
  children: ReactNode;
}

/**
 * An icon button with a tooltip (name + shortcut). It spreads its props (and
 * ref) onto the button so it also works as a `PopoverTrigger asChild` child.
 * `mousedown` is cancelled so clicking never steals the editor's selection.
 */
function ToolbarButton({
  label,
  shortcut,
  active,
  className,
  children,
  ...props
}: ToolbarButtonProps) {
  const keys = usePlatformKeys();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          data-active={active ? "" : undefined}
          onMouseDown={(event) => event.preventDefault()}
          className={cn(
            "shrink-0 text-muted-foreground hover:text-foreground",
            active && "bg-accent text-accent-foreground",
            className,
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ms-2 opacity-70">{keys(shortcut)}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarSeparator() {
  return <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />;
}

/** The link box: validate, apply, open, remove. Mounted only while its popover is open. */
function LinkForm({
  editor,
  initialHref,
  onClose,
}: {
  editor: Editor;
  initialHref: string;
  onClose: () => void;
}) {
  const t = useTranslations("announcements.editor.link");
  const [draft, setDraft] = useState(initialHref);
  const [invalid, setInvalid] = useState(false);
  const editing = initialHref !== "";

  const apply = () => {
    const href = normalizeLinkInput(draft);
    if (!href) {
      setInvalid(true);
      return;
    }
    const chain = editor.chain().focus();
    if (editor.isActive("link")) {
      chain.extendMarkRange("link").setLink({ href }).run();
    } else if (editor.state.selection.empty) {
      // Nothing selected: insert the address itself as the link text.
      chain
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  };

  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <label htmlFor="ann-link-url" className="text-xs font-medium">
          {t("url")}
        </label>
        <input
          id="ann-link-url"
          type="text"
          inputMode="url"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={draft}
          placeholder={t("placeholder")}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "ann-link-error" : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            }
          }}
          className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30"
        />
        {invalid && (
          <p id="ann-link-error" role="alert" className="text-xs text-destructive">
            {t("invalid")}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" onClick={apply} className="gap-1.5">
          <Check aria-hidden />
          {t("apply")}
        </Button>
        {editing && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(initialHref, "_blank", "noopener,noreferrer")}
              className="gap-1.5"
            >
              <ExternalLink aria-hidden />
              {t("open")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={remove}
              className="gap-1.5 text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
            >
              <Link2Off aria-hidden />
              {t("remove")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The editor                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export interface AnnouncementEditorProps {
  /** The body as HTML ("" when empty). */
  value: string;
  /** Called with the new HTML ("" when the document is empty). */
  onChange: (html: string) => void;
  placeholder?: string;
  invalid?: boolean;
  /** Character limit of the TEXT (not the markup). Typing stops at it. */
  maxLength?: number;
  id?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * The announcement body editor (Tiptap 3).
 *
 * Replaces v1's six-button editor: headings, bold / italic / underline /
 * strike / code, a small set of text colours, highlight, alignment, lists,
 * quote, rule, links (a popover with validation plus a bubble menu on a link),
 * emoji from the Emoji picker, and clear formatting. The toolbar sticks to the
 * top and scrolls sideways with fading edges when it does not fit a phone.
 *
 * Links: `autolink` + `linkOnPaste`, `openOnClick: false`, http / https /
 * mailto / tel only (`isAllowedUri`). No custom `protocols` (that mutates
 * linkify's shared instance). Display runs everything through the sanitizer
 * again, so this editor's output is never trusted.
 */
export function AnnouncementEditor({
  value,
  onChange,
  placeholder,
  invalid = false,
  maxLength,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  disabled = false,
  className,
}: AnnouncementEditorProps) {
  const t = useTranslations("announcements.editor");

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /** The last HTML this editor emitted: tells our own echo apart from a real external change. */
  const lastEmitted = useRef(value);
  const [linkOpen, setLinkOpen] = useState(false);
  const setLinkOpenRef = useRef(setLinkOpen);

  const placeholderText = placeholder ?? t("placeholder");
  const label = ariaLabel ?? t("ariaLabel");

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          autolink: true,
          linkOnPaste: true,
          openOnClick: false,
          isAllowedUri: (url, { defaultValidate }) => {
            const scheme = schemeOf(url.trim());
            return (!scheme || ALLOWED_SCHEMES.has(scheme)) && defaultValidate(url);
          },
          HTMLAttributes: {
            class: "ann-link",
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      TextStyle,
      Color,
      CharacterCount.configure({ limit: maxLength }),
      Placeholder.configure({ placeholder: placeholderText }),
    ],
    [maxLength, placeholderText],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: value,
      editable: !disabled,
      editorProps: {
        attributes: {
          ...(id ? { id } : {}),
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": label,
          ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
          ...(invalid ? { "aria-invalid": "true" } : {}),
          class:
            "announcement-body ann-editor min-h-40 max-h-[45dvh] overflow-y-auto px-3 py-2.5 text-sm leading-relaxed break-words outline-none [overflow-wrap:anywhere]",
        },
        // Tiptap's link mark is "inclusive" (autolink needs that), so a space typed
        // at the end of a link stayed INSIDE it. A space after a link leaves it:
        // the space is inserted without the link, and so is whatever comes next.
        handleTextInput: (view, from, to, text) => {
          if (!/^\s+$/.test(text)) return false;
          const linkType = view.state.schema.marks.link;
          if (!linkType) return false;
          const $from = view.state.doc.resolve(from);
          if (!linkType.isInSet($from.marks())) return false;
          // In the middle of a link (it goes on after the cursor): keep editing the link.
          if ($from.nodeAfter && linkType.isInSet($from.nodeAfter.marks)) return false;

          const tr = view.state.tr.insertText(text, from, to);
          tr.removeMark(from, from + text.length, linkType);
          tr.removeStoredMark(linkType);
          view.dispatch(tr);
          return true;
        },
        handleKeyDown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
            event.preventDefault();
            setLinkOpenRef.current(true);
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: current }) => {
        const html = current.isEmpty ? "" : current.getHTML();
        lastEmitted.current = html;
        onChangeRef.current(html);
      },
    },
    [extensions],
  );

  // An outside change (the edit form loading an announcement, a reset) replaces
  // the document; our own echo does not, so the caret is never disturbed.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value === lastEmitted.current) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    lastEmitted.current = value;
    if (value === current) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled);
  }, [editor, disabled]);

  // `useEditor` with a dependency list never re-applies `editorProps`, so these two
  // attributes follow the props by hand (an error on the body must reach screen readers).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    let dom: HTMLElement;
    try {
      dom = editor.view.dom as HTMLElement;
    } catch {
      return; // not mounted yet
    }
    if (invalid) dom.setAttribute("aria-invalid", "true");
    else dom.removeAttribute("aria-invalid");
    if (ariaDescribedBy) dom.setAttribute("aria-describedby", ariaDescribedBy);
    else dom.removeAttribute("aria-describedby");
  }, [editor, invalid, ariaDescribedBy]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => readState(current),
  });
  const s = state ?? EMPTY_STATE;

  /* ── Toolbar scrolling (phones): fade the edges that have more behind them ── */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ start: false, end: false });
  const updateFade = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = Math.abs(el.scrollLeft); // negative in RTL: the distance from the start edge
    const max = el.scrollWidth - el.clientWidth;
    setFade((prev) => {
      const next = { start: distance > 2, end: max - distance > 2 };
      return prev.start === next.start && prev.end === next.end ? prev : next;
    });
  }, []);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateFade();
    const observer = new ResizeObserver(updateFade);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateFade, editor]);

  /** Arrow keys move between the toolbar's buttons. */
  const onToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step =
      event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : index + step;
    const target = buttons[(next + buttons.length) % buttons.length];
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  const disabledAll = disabled || !editor;
  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    if (editor) command(editor.chain().focus()).run();
  };

  const [colorOpen, setColorOpen] = useState(false);

  const limitReached = maxLength !== undefined && s.characters >= maxLength;

  return (
    <div
      data-slot="announcement-editor"
      className={cn(
        "rounded-md border bg-background shadow-xs transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        invalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
        disabled && "opacity-60",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="sticky top-0 z-10 rounded-t-md border-b bg-background">
        {!editor ? (
          <div className="flex gap-1.5 px-2 py-1.5" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="size-7 rounded-md" />
            ))}
          </div>
        ) : (
          <>
            <div
              ref={scrollerRef}
              role="toolbar"
              aria-label={t("toolbar")}
              onScroll={updateFade}
              onKeyDown={onToolbarKeyDown}
              className="flex items-center gap-0.5 overflow-x-auto px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <ToolbarButton
                label={t("undo")}
                shortcut="Mod-Z"
                disabled={disabledAll || !s.canUndo}
                onClick={() => run((c) => c.undo())}
              >
                <Undo2 aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("redo")}
                shortcut="Mod-Shift-Z"
                disabled={disabledAll || !s.canRedo}
                onClick={() => run((c) => c.redo())}
              >
                <Redo2 aria-hidden />
              </ToolbarButton>

              <ToolbarSeparator />

              <ToolbarButton
                label={t("paragraph")}
                shortcut="Mod-Alt-0"
                active={s.paragraph && !s.h2 && !s.h3}
                disabled={disabledAll}
                onClick={() => run((c) => c.setParagraph())}
              >
                <Pilcrow aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("heading2")}
                shortcut="Mod-Alt-2"
                active={s.h2}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleHeading({ level: 2 }))}
              >
                <Heading2 aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("heading3")}
                shortcut="Mod-Alt-3"
                active={s.h3}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleHeading({ level: 3 }))}
              >
                <Heading3 aria-hidden />
              </ToolbarButton>

              <ToolbarSeparator />

              <ToolbarButton
                label={t("bold")}
                shortcut="Mod-B"
                active={s.bold}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleBold())}
              >
                <Bold aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("italic")}
                shortcut="Mod-I"
                active={s.italic}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleItalic())}
              >
                <Italic aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("underline")}
                shortcut="Mod-U"
                active={s.underline}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleUnderline())}
              >
                <Underline aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("strike")}
                shortcut="Mod-Shift-S"
                active={s.strike}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleStrike())}
              >
                <Strikethrough aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("code")}
                shortcut="Mod-E"
                active={s.code}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleCode())}
              >
                <Code aria-hidden />
              </ToolbarButton>

              <ToolbarSeparator />

              <Popover open={colorOpen} onOpenChange={setColorOpen}>
                <PopoverTrigger asChild>
                  <ToolbarButton
                    label={t("textColor")}
                    active={s.color !== null}
                    disabled={disabledAll}
                  >
                    <span className="relative inline-flex">
                      <Palette aria-hidden />
                      {s.color && (
                        <span
                          className="absolute -bottom-0.5 start-0 h-0.5 w-full rounded-full"
                          style={{ backgroundColor: s.color }}
                          aria-hidden
                        />
                      )}
                    </span>
                  </ToolbarButton>
                </PopoverTrigger>
                <PopoverContent align="start" collisionPadding={8} className="w-auto p-2">
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("textColor")}>
                    <button
                      type="button"
                      aria-pressed={s.color === null}
                      aria-label={t("colors.default")}
                      title={t("colors.default")}
                      onClick={() => {
                        run((c) => c.unsetColor());
                        setColorOpen(false);
                      }}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full border bg-foreground text-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                        s.color === null && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                      )}
                    >
                      {s.color === null && <Check className="size-3.5" aria-hidden />}
                    </button>
                    {TEXT_COLORS.map((color) => {
                      const selected = s.color?.toLowerCase() === color.value;
                      return (
                        <button
                          key={color.id}
                          type="button"
                          aria-pressed={selected}
                          aria-label={t(`colors.${color.id}`)}
                          title={t(`colors.${color.id}`)}
                          onClick={() => {
                            run((c) => c.setColor(color.value));
                            setColorOpen(false);
                          }}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full border border-black/10 text-white outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 dark:border-white/15",
                            selected && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                          )}
                          style={{ backgroundColor: color.value }}
                        >
                          {selected && <Check className="size-3.5" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <ToolbarButton
                label={t("highlight")}
                shortcut="Mod-Shift-H"
                active={s.highlight}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleHighlight())}
              >
                <Highlighter aria-hidden />
              </ToolbarButton>

              <ToolbarSeparator />

              <ToolbarButton
                label={t("alignLeft")}
                shortcut="Mod-Shift-L"
                active={s.align === "left"}
                disabled={disabledAll}
                onClick={() => run((c) => c.setTextAlign("left"))}
              >
                <AlignLeft aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("alignCenter")}
                shortcut="Mod-Shift-E"
                active={s.align === "center"}
                disabled={disabledAll}
                onClick={() => run((c) => c.setTextAlign("center"))}
              >
                <AlignCenter aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("alignRight")}
                shortcut="Mod-Shift-R"
                active={s.align === "right"}
                disabled={disabledAll}
                onClick={() => run((c) => c.setTextAlign("right"))}
              >
                <AlignRight aria-hidden />
              </ToolbarButton>

              <ToolbarSeparator />

              <ToolbarButton
                label={t("bulletList")}
                shortcut="Mod-Shift-8"
                active={s.bulletList}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleBulletList())}
              >
                <List aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("orderedList")}
                shortcut="Mod-Shift-7"
                active={s.orderedList}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleOrderedList())}
              >
                <ListOrdered aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("quote")}
                shortcut="Mod-Shift-B"
                active={s.blockquote}
                disabled={disabledAll}
                onClick={() => run((c) => c.toggleBlockquote())}
              >
                <Quote aria-hidden />
              </ToolbarButton>
              <ToolbarButton
                label={t("rule")}
                disabled={disabledAll}
                onClick={() => run((c) => c.setHorizontalRule())}
              >
                <Minus aria-hidden />
              </ToolbarButton>

              <ToolbarSeparator />

              <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                <PopoverTrigger asChild>
                  <ToolbarButton
                    label={t("link.title")}
                    shortcut="Mod-K"
                    active={s.link}
                    disabled={disabledAll}
                  >
                    <Link2 aria-hidden />
                  </ToolbarButton>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  collisionPadding={8}
                  className="w-[min(20rem,calc(100vw-2rem))]"
                  onCloseAutoFocus={(event) => {
                    // Hand focus back to the text, not the toolbar button.
                    event.preventDefault();
                    editor.commands.focus();
                  }}
                >
                  {editor && (
                    <LinkForm
                      editor={editor}
                      initialHref={s.linkHref}
                      onClose={() => setLinkOpen(false)}
                    />
                  )}
                </PopoverContent>
              </Popover>

              <ExpressionPanel
                onEmojiSelect={(emoji) => run((c) => c.insertContent(emoji))}
                closeOnEmoji
                side="bottom"
                align="start"
                trigger={
                  <ToolbarButton label={t("emoji")} disabled={disabledAll}>
                    <Smile aria-hidden />
                  </ToolbarButton>
                }
              />

              <ToolbarSeparator />

              <ToolbarButton
                label={t("clearFormatting")}
                disabled={disabledAll}
                onClick={() => run((c) => c.unsetAllMarks().clearNodes().unsetTextAlign())}
              >
                <RemoveFormatting aria-hidden />
              </ToolbarButton>
            </div>

            {fade.start && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 start-0 w-6 bg-linear-to-r from-background to-transparent rtl:bg-linear-to-l"
              />
            )}
            {fade.end && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 end-0 w-6 bg-linear-to-l from-background to-transparent rtl:bg-linear-to-r"
              />
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="min-h-40 space-y-2 px-3 py-2.5" aria-hidden>
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-8/12" />
          </div>
        )}

        {editor && (
          <BubbleMenu
            editor={editor}
            pluginKey="announcement-link-bubble"
            shouldShow={({ editor: current }) => current.isEditable && current.isActive("link")}
            options={{
              strategy: "fixed",
              placement: "bottom-start",
              offset: 8,
              flip: true,
              shift: { padding: 8 },
            }}
          >
            <div
              role="group"
              aria-label={t("link.title")}
              className="flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            >
              <span className="min-w-0 max-w-48 truncate px-1.5 text-xs text-muted-foreground" dir="ltr">
                {s.linkHref}
              </span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t("link.open")}
                title={t("link.open")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => window.open(s.linkHref, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t("link.edit")}
                title={t("link.edit")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setLinkOpen(true)}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t("link.remove")}
                title={t("link.remove")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run((c) => c.extendMarkRange("link").unsetLink())}
              >
                <Link2Off aria-hidden />
              </Button>
            </div>
          </BubbleMenu>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">{t("linkHint")}</span>
        <span
          className={cn(
            "ms-auto tabular-nums",
            limitReached && "font-medium text-red-600 dark:text-red-400",
          )}
          aria-live={limitReached ? "polite" : "off"}
        >
          {maxLength !== undefined
            ? t("charactersOf", { count: s.characters, max: maxLength })
            : t("characters", { count: s.characters })}
        </span>
      </div>
    </div>
  );
}
