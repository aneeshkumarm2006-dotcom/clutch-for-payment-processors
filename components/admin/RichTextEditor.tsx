"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Rich text editor (PRD §10.3 / §10.4) — Tiptap (chosen over MDX, see NOTES.md).
 * Emits HTML via `onChange`; stored on `Processor.longDescription` /
 * `Category.introContent` and rendered on the public profile/category pages.
 *
 * `immediatelyRender: false` avoids the Next.js SSR hydration warning Tiptap
 * raises in the App Router.
 */
type ToolKey = "bold" | "italic" | "strike" | "h2" | "h3" | "bullet" | "ordered" | "quote";

const TOOLS: { key: ToolKey; icon: LucideIcon; label: string }[] = [
  { key: "bold", icon: Bold, label: "Bold" },
  { key: "italic", icon: Italic, label: "Italic" },
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

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "min-h-44 max-w-none px-3 py-2.5 text-[0.875rem] leading-relaxed text-foreground focus:outline-none",
          "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:tracking-tightish",
          "[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-h4 [&_h3]:font-semibold",
          "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-ink-600",
          "[&_a]:text-accent [&_a]:underline",
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      // Tiptap emits "<p></p>" for an empty doc — normalize to "".
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Keep the editor in sync when the form resets / loads async defaults.
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (next !== current && !(next === "" && current === "<p></p>")) {
      editor.commands.setContent(next, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-44 rounded-lg border border-input bg-muted" aria-hidden />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-subtle">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 p-1">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = isActive(editor, tool.key);
          return (
            <button
              key={tool.key}
              type="button"
              onClick={() => run(editor, tool.key)}
              aria-label={tool.label}
              aria-pressed={active}
              title={tool.label}
              className={cn(
                "flex size-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-accent-subtle text-accent-subtle-foreground"
                  : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo"
          title="Undo"
          className="flex size-8 items-center justify-center rounded text-ink-600 hover:bg-ink-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo"
          title="Redo"
          className="flex size-8 items-center justify-center rounded text-ink-600 hover:bg-ink-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <Redo2 className="size-4" />
        </button>
      </div>
      <div className="relative">
        <EditorContent editor={editor} />
        {placeholder && editor.isEmpty && (
          <p className="pointer-events-none absolute left-3 top-2.5 text-[0.875rem] text-muted-foreground">
            {placeholder}
          </p>
        )}
      </div>
    </div>
  );
}

export default RichTextEditor;
