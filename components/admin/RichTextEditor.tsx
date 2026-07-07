"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditorImageDialog } from "@/components/admin/fields/EditorImageDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Rich text editor (PRD §10.3 / §10.4) — Tiptap (chosen over MDX, see NOTES.md).
 * Emits HTML via `onChange`; stored on `BlogPost.content` /
 * `Processor.longDescription` / `Category.introContent` and rendered on the
 * public pages via `RichText`.
 *
 * Shopify-style additions: Underline, Insert link, Insert image (with alt), and a
 * bidirectional Show-HTML (`<>`) source toggle so authors can hand-edit markup or
 * paste embed codes (YouTube/Vimeo `<iframe>`). Editing in the visual view can
 * drop unsupported embeds — use the HTML view for embed-heavy posts.
 *
 * `immediatelyRender: false` avoids the Next.js SSR hydration warning Tiptap
 * raises in the App Router.
 */
type ToolKey =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "h2"
  | "h3"
  | "bullet"
  | "ordered"
  | "quote";

const TOOLS: { key: ToolKey; icon: LucideIcon; label: string }[] = [
  { key: "bold", icon: Bold, label: "Bold" },
  { key: "italic", icon: Italic, label: "Italic" },
  { key: "underline", icon: UnderlineIcon, label: "Underline" },
  { key: "strike", icon: Strikethrough, label: "Strikethrough" },
  { key: "h2", icon: Heading2, label: "Heading 2" },
  { key: "h3", icon: Heading3, label: "Heading 3" },
  { key: "bullet", icon: List, label: "Bullet list" },
  { key: "ordered", icon: ListOrdered, label: "Numbered list" },
  { key: "quote", icon: Quote, label: "Quote" },
];

function isActive(editor: Editor, key: ToolKey): boolean {
  switch (key) {
    case "bold":
      return editor.isActive("bold");
    case "italic":
      return editor.isActive("italic");
    case "underline":
      return editor.isActive("underline");
    case "strike":
      return editor.isActive("strike");
    case "h2":
      return editor.isActive("heading", { level: 2 });
    case "h3":
      return editor.isActive("heading", { level: 3 });
    case "bullet":
      return editor.isActive("bulletList");
    case "ordered":
      return editor.isActive("orderedList");
    case "quote":
      return editor.isActive("blockquote");
  }
}

function run(editor: Editor, key: ToolKey) {
  const chain = editor.chain().focus();
  switch (key) {
    case "bold":
      return chain.toggleBold().run();
    case "italic":
      return chain.toggleItalic().run();
    case "underline":
      return chain.toggleUnderline().run();
    case "strike":
      return chain.toggleStrike().run();
    case "h2":
      return chain.toggleHeading({ level: 2 }).run();
    case "h3":
      return chain.toggleHeading({ level: 3 }).run();
    case "bullet":
      return chain.toggleBulletList().run();
    case "ordered":
      return chain.toggleOrderedList().run();
    case "quote":
      return chain.toggleBlockquote().run();
  }
}

/** A single square toolbar button. */
function ToolButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
        active
          ? "bg-accent-subtle text-accent-subtle-foreground"
          : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800",
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  imageFolder = "blog",
  imageUploadEndpoint,
  onPickImageFromLibrary,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  imageFolder?: string;
  /** Route inline-image uploads through a custom endpoint (e.g. seoteam media). */
  imageUploadEndpoint?: string;
  /** Enables a "Library" button in the insert-image dialog. */
  onPickImageFromLibrary?: (apply: (img: { url: string; alt: string }) => void) => void;
}) {
  const [mode, setMode] = React.useState<"visual" | "html">("visual");
  const [imageOpen, setImageOpen] = React.useState(false);
  // Non-null while editing an already-inserted image (click-to-edit); null for a
  // fresh insert from the toolbar button.
  const [imageInitial, setImageInitial] = React.useState<{ src: string; alt: string } | null>(null);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener", target: "_blank" },
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value || "",
    editorProps: {
      // Click an inserted image to reopen the dialog and edit its src/alt.
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name === "image") {
          setImageInitial({
            src: String(node.attrs.src ?? ""),
            alt: String(node.attrs.alt ?? ""),
          });
          setImageOpen(true);
        }
        return false;
      },
      attributes: {
        class: cn(
          "min-h-44 max-w-none px-3 py-2.5 text-[0.875rem] leading-relaxed text-foreground focus:outline-none",
          "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:tracking-tightish",
          "[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-h4 [&_h3]:font-semibold",
          "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-ink-600",
          "[&_a]:text-accent [&_a]:underline",
          "[&_img]:my-3 [&_img]:max-w-full [&_img]:cursor-pointer [&_img]:rounded-md [&_img]:border [&_img]:border-border",
          "[&_img.ProseMirror-selectednode]:outline [&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-accent",
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      // Tiptap emits "<p></p>" for an empty doc — normalize to "".
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Keep the editor in sync when the form resets / loads async defaults. Skip
  // while in HTML mode (the textarea is the source of truth there).
  React.useEffect(() => {
    if (!editor || mode !== "visual") return;
    const current = editor.getHTML();
    const next = value || "";
    if (next !== current && !(next === "" && current === "<p></p>")) {
      editor.commands.setContent(next, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const toggleMode = () => {
    if (!editor) return;
    if (mode === "html") {
      // Push the edited source back into the visual editor.
      editor.commands.setContent(value || "", false);
      setMode("visual");
    } else {
      setMode("html");
    }
  };

  const openLinkDialog = () => {
    if (!editor) return;
    setLinkUrl((editor.getAttributes("link").href as string) ?? "");
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const href = linkUrl.trim();
    if (href) {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  const openInsertImage = () => {
    setImageInitial(null);
    setImageOpen(true);
  };

  const applyImage = ({ src, alt }: { src: string; alt: string }) => {
    if (!editor) return;
    // Editing an existing (selected) image updates it in place; otherwise insert.
    if (imageInitial) {
      editor.chain().focus().updateAttributes("image", { src, alt }).run();
    } else {
      editor.chain().focus().setImage({ src, alt }).run();
    }
  };

  if (!editor) {
    return <div className="min-h-44 rounded-lg border border-input bg-muted" aria-hidden />;
  }

  const htmlMode = mode === "html";

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-subtle">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 p-1">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <ToolButton
              key={tool.key}
              onClick={() => run(editor, tool.key)}
              active={!htmlMode && isActive(editor, tool.key)}
              disabled={htmlMode}
              label={tool.label}
            >
              <Icon className="size-4" />
            </ToolButton>
          );
        })}

        <div className="mx-1 h-5 w-px bg-border" aria-hidden />

        <ToolButton
          onClick={openLinkDialog}
          active={!htmlMode && editor.isActive("link")}
          disabled={htmlMode}
          label="Insert link"
        >
          <Link2 className="size-4" />
        </ToolButton>
        <ToolButton onClick={openInsertImage} disabled={htmlMode} label="Insert image">
          <ImagePlus className="size-4" />
        </ToolButton>

        <div className="mx-1 h-5 w-px bg-border" aria-hidden />

        <ToolButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={htmlMode || !editor.can().undo()}
          label="Undo"
        >
          <Undo2 className="size-4" />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={htmlMode || !editor.can().redo()}
          label="Redo"
        >
          <Redo2 className="size-4" />
        </ToolButton>

        <div className="ml-auto" />
        <ToolButton onClick={toggleMode} active={htmlMode} label="Show HTML">
          <Code className="size-4" />
        </ToolButton>
      </div>

      {htmlMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder="<p>Edit the raw HTML — paste embed codes here.</p>"
          className="min-h-44 w-full resize-y bg-card px-3 py-2.5 font-mono text-[0.8125rem] leading-relaxed text-foreground focus:outline-none"
        />
      ) : (
        <div className="relative">
          <EditorContent editor={editor} />
          {placeholder && editor.isEmpty && (
            <p className="pointer-events-none absolute left-3 top-2.5 text-[0.875rem] text-muted-foreground">
              {placeholder}
            </p>
          )}
        </div>
      )}

      <EditorImageDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        onInsert={applyImage}
        folder={imageFolder}
        initial={imageInitial}
        uploadEndpoint={imageUploadEndpoint}
        onPickFromLibrary={onPickImageFromLibrary}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
            <DialogDescription>
              Links open in a new tab. Leave blank and apply to remove the link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="editor-link-url">URL</Label>
            <Input
              id="editor-link-url"
              type="url"
              inputMode="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
          </div>
          <DialogFooter>
            {editor.isActive("link") && (
              <Button type="button" variant="ghost" onClick={removeLink}>
                Remove link
              </Button>
            )}
            <Button type="button" variant="accent" onClick={applyLink}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RichTextEditor;
