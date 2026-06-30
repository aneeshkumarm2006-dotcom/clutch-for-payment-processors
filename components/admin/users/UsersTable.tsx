"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, MoreHorizontal, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import type { AdminUserData } from "@/lib/serialize";
import { USER_ROLES, type UserRole } from "@/lib/enums";
import { humanizeEnum } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROLE_VARIANT: Record<UserRole, "premier" | "neutral"> = {
  admin: "premier",
  editor: "neutral",
};

export function UsersTable({
  rows,
  currentUserId,
}: {
  rows: AdminUserData[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<AdminUserData | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminUserData | null>(null);

  const patch = async (row: AdminUserData, body: Record<string, unknown>, ok: string) => {
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/users/${row.id}`, body);
      toast.success(ok);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update the user.");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiClient.delete(`/api/users/${deleteTarget.id}`);
      toast.success("User deleted.");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the user.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<AdminUserData>[] = [
    {
      key: "name",
      header: "Name",
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-foreground">
            {r.name}
            {r.id === currentUserId && (
              <span className="ml-1.5 text-micro font-normal text-muted-foreground">(you)</span>
            )}
          </span>
          <span className="block truncate text-micro text-muted-foreground">{r.email}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortAccessor: (r) => r.role,
      cell: (r) => (
        <Badge variant={ROLE_VARIANT[r.role]} className="capitalize">
          {r.role}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortAccessor: (r) => (r.isActive ? "active" : "inactive"),
      cell: (r) =>
        r.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="neutral">Deactivated</Badge>
        ),
    },
    {
      key: "lastLoginAt",
      header: "Last login",
      sortAccessor: (r) => r.lastLoginAt ?? "",
      cell: (r) => (
        <span className="text-micro text-muted-foreground">
          {r.lastLoginAt ? formatDate(r.lastLoginAt) : "Never"}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New user
        </Button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.id}
        searchAccessor={(r) => `${r.name} ${r.email} ${r.role}`}
        searchPlaceholder="Search users…"
        initialSort={{ key: "name", dir: "asc" }}
        emptyState="No users yet."
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${r.name}`}
                disabled={busyId === r.id}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setEditTarget(r)}>
                <Pencil className="size-4" />
                Edit role
              </DropdownMenuItem>
              {r.isActive ? (
                <DropdownMenuItem
                  onSelect={() => void patch(r, { isActive: false }, "User deactivated.")}
                >
                  <Ban className="size-4" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => void patch(r, { isActive: true }, "User activated.")}
                >
                  <CheckCircle2 className="size-4" />
                  Activate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteTarget(r);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => router.refresh()} />

      <EditRoleDialog
        target={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        busy={!!busyId}
        onSave={async (role) => {
          if (!editTarget) return;
          const ok = await patch(editTarget, { role }, "Role updated.");
          if (ok) setEditTarget(null);
        }}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This permanently removes {deleteTarget?.name}’s account ({deleteTarget?.email}). This
              can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={!!busyId}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={!!busyId}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Create-account dialog: name, email, temp password, role. */
function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("editor");
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  // Reset the form each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPassword("");
      setRole("editor");
      setErrors({});
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      await apiClient.post("/api/users", { name, email, password, role });
      toast.success("User created.");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors ?? {});
        toast.error(err.message);
      } else {
        toast.error("Could not create the user.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-accent" />
            New user
          </DialogTitle>
          <DialogDescription>
            Create an account with a temporary password. Share it securely; they can change it
            later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Name" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </Field>
          <Field label="Temporary password" error={errors.password}>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="off"
            />
          </Field>
          <Field label="Role" error={errors.role}>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {humanizeEnum(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-micro text-muted-foreground">
              Editors manage content; admins also manage users and settings.
            </p>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit-role dialog (a focused role switch for an existing account). */
function EditRoleDialog({
  target,
  onOpenChange,
  onSave,
  busy,
}: {
  target: AdminUserData | null;
  onOpenChange: (open: boolean) => void;
  onSave: (role: UserRole) => void;
  busy: boolean;
}) {
  const [role, setRole] = React.useState<UserRole>("editor");

  React.useEffect(() => {
    if (target) setRole(target.role);
  }, [target]);

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit role</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>

        <Field label="Role">
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {humanizeEnum(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(role)} disabled={busy}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error?.length ? <p className="text-micro text-destructive">{error[0]}</p> : null}
    </div>
  );
}

export default UsersTable;
