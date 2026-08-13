export interface DisplayProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: "super_admin" | "admin" | "staff";
  isActive: boolean;
  ghlLabel: string;
  isSelf: boolean;
  canEdit: boolean;
  canToggleActive: boolean;
  canChangeRole: boolean;
}

export interface UsersTableProps {
  profiles: DisplayProfile[];
  isSuperAdmin: boolean;
}

export interface InviteUserDialogProps {
  isSuperAdmin: boolean;
  onClose: () => void;
  onInvited: () => void;
}

export interface UserEditDialogProps {
  profile: DisplayProfile;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}
