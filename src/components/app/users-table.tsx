"use client";

import { useState } from "react";
import { UsersTableProps } from "@/lib/admin/types";
import { InviteUserDialog } from "@/components/app/invite-user-dialog";
import { UserEditDialog } from "@/components/app/user-edit-dialog";
import { Badge } from "@/components/core/ui/badge";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { UserPlus } from "lucide-react";

export function UsersTable({ profiles, isSuperAdmin }: UsersTableProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<UsersTableProps["profiles"][number] | null>(null);

  function roleLabel(role: string): string {
    switch (role) {
      case "super_admin": return "Super Admin";
      case "admin": return "Admin";
      case "staff": return "Staff";
      default: return role;
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Team Members</CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-medium text-muted-foreground pb-3 pr-4">Name</th>
                  <th className="text-left text-sm font-medium text-muted-foreground pb-3 pr-4 hidden sm:table-cell">Email</th>
                  <th className="text-left text-sm font-medium text-muted-foreground pb-3 pr-4">Role</th>
                  <th className="text-left text-sm font-medium text-muted-foreground pb-3 pr-4 hidden md:table-cell">Briitely User</th>
                  <th className="text-left text-sm font-medium text-muted-foreground pb-3 pr-4">Status</th>
                  <th className="text-right text-sm font-medium text-muted-foreground pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
                      <div className="text-sm font-medium text-foreground">
                        {p.fullName || "—"}
                        {p.isSelf && <span className="ml-2 text-xs text-muted-foreground">(You)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground sm:hidden">{p.email}</div>
                    </td>
                    <td className="py-3 pr-4 text-sm text-muted-foreground hidden sm:table-cell">{p.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={p.role === "super_admin" ? "default" : p.role === "admin" ? "secondary" : "outline"}>
                        {roleLabel(p.role)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-sm text-muted-foreground hidden md:table-cell">{p.ghlLabel}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={p.isActive ? "secondary" : "destructive"} className="text-xs">
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      {p.canEdit ? (
                        <Button variant="outline" size="sm" onClick={() => setEditProfile(p)}>
                          Manage
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {inviteOpen && (
        <InviteUserDialog
          isSuperAdmin={isSuperAdmin}
          onClose={() => setInviteOpen(false)}
          onInvited={() => { setInviteOpen(false); window.location.reload(); }}
        />
      )}

      {editProfile && (
        <UserEditDialog
          profile={editProfile}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditProfile(null)}
          onSaved={() => { setEditProfile(null); window.location.reload(); }}
        />
      )}
    </>
  );
}
