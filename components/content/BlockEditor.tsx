"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { enabledBlocks } from "@/config/content-engine";
import type { BlockType } from "@/lib/validators/blocks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BLOCK_LIST, BLOCK_REGISTRY, type BlockEditProps } from "@/components/content/blocks/registry";

/**
 * Modular content editor — add, reorder, and remove blocks.
 *
 * Panel-agnostic: mounted in both /admin (ProcessorForm, CategoryForm, …) and
 * /seoteam (SeoPostForm). It only needs a `<Form>` context and the field name.
 *
 * ⚠️ Rows are keyed by RHF's `field.id`, NEVER by array index.
 *
 * A reorder re-renders the whole array. With index keys, React sees "same key,
 * different props" and REUSES each row's DOM — so the Tiptap editor inside a
 * richtext block gets handed someone else's content, or remounts and drops what
 * the author was mid-way through typing. `field.id` is stable across `move()`, so
 * each row keeps its own editor instance. This is silent when it breaks: nothing
 * errors, the text just vanishes. It's the single most important line in the file.
 */

const blockName = (i: number, name: string) => `${name}.${i}`;

function SortableBlock({
  id,
  index,
  total,
  type,
  fieldName,
  onRemove,
  onMove,
  editProps,
}: {
  id: string;
  index: number;
  total: number;
  type: BlockType;
  fieldName: string;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  editProps: Omit<BlockEditProps, "name">;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const def = BLOCK_REGISTRY[type];

  // A block type that's been removed from the config still has data in the doc.
  // Show it as unknown rather than crashing the whole form.
  if (!def) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="text-small text-muted-foreground">
          Unknown block type &ldquo;{type}&rdquo; — it may have been disabled in the config. Its
          content is preserved.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="mt-2 text-destructive">
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
    );
  }

  const Icon = def.icon;
  const Edit = def.Edit;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border border-border bg-card",
        isDragging && "relative z-10 opacity-90 shadow-lg",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-ink-400 hover:text-foreground active:cursor-grabbing"
          aria-label={`Reorder ${def.label} block`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <Icon className="size-4 text-muted-foreground" />
        <span className="text-label font-medium text-foreground">{def.label}</span>
        {def.schema ? (
          <Badge variant="neutral" className="text-micro">
            {def.schema}
          </Badge>
        ) : null}

        <div className="ml-auto flex items-center gap-0.5">
          {/* Keyboard/AT-friendly reordering. Drag alone is not accessible. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move ${def.label} block up`}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Move ${def.label} block down`}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove ${def.label} block`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <Edit name={fieldName} {...editProps} />
      </div>
    </div>
  );
}

export function BlockEditor({
  name = "blocks",
  uploadEndpoint,
  onPickFromLibrary,
}: {
  name?: string;
} & Omit<BlockEditProps, "name">) {
  const { control } = useFormContext();
  const { fields, append, remove, move } = useFieldArray({ control, name });
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Without a distance threshold, a click on any button inside a block starts
      // a drag instead of firing the click.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const available = BLOCK_LIST.filter((b) => (enabledBlocks as readonly string[]).includes(b.type));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from !== -1 && to !== -1) move(from, to);
  };

  const addBlock = (type: BlockType) => {
    append({
      type,
      // A stable id that survives the round-trip to Mongo — `field.id` is
      // RHF-internal and is regenerated on load, so it can't be the persisted one.
      id: crypto.randomUUID(),
      data: BLOCK_REGISTRY[type].blank(),
    });
    setPickerOpen(false);
  };

  const editProps = {
    ...(uploadEndpoint ? { uploadEndpoint } : {}),
    ...(onPickFromLibrary ? { onPickFromLibrary } : {}),
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-small text-muted-foreground">
          No blocks yet. The page keeps using its existing content until you add one.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <SortableBlock
                  key={field.id}
                  id={field.id}
                  index={index}
                  total={fields.length}
                  type={(field as unknown as { type: BlockType }).type}
                  fieldName={blockName(index, name)}
                  onRemove={() => remove(index)}
                  onMove={(dir) => move(index, index + dir)}
                  editProps={editProps}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="secondary" size="sm">
            <Plus className="size-4" />
            Add block
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a block</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((def) => {
              const Icon = def.icon;
              return (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => addBlock(def.type)}
                  className="rounded-lg border border-border p-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-label font-medium text-foreground">{def.label}</span>
                    {def.schema ? (
                      <Badge variant="neutral" className="ml-auto text-micro">
                        {def.schema}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-micro text-muted-foreground">
                    {def.description}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-micro text-muted-foreground">
            Blocks tagged with a schema type also generate structured data automatically.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BlockEditor;
