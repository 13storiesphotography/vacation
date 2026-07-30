import type { Database } from "@/lib/database.types";

export type MemberRow = Database["public"]["Tables"]["vacation_members"]["Row"];
export type MemberRole = MemberRow["role"];

export type PermissionKey =
  | "can_manage_team"
  | "can_edit_vacation"
  | "can_edit_spots"
  | "can_edit_plan";

export type PermissionSet = Pick<MemberRow, PermissionKey>;

export const permissionLabels: Record<PermissionKey, string> = {
  can_manage_team: "Team verwalten",
  can_edit_vacation: "Urlaub bearbeiten",
  can_edit_spots: "Spots bearbeiten",
  can_edit_plan: "Plan bearbeiten",
};

export const permissionShortLabels: Record<PermissionKey, string> = {
  can_manage_team: "Team",
  can_edit_vacation: "Urlaub",
  can_edit_spots: "Spots",
  can_edit_plan: "Plan",
};

export const rolePresets: Record<MemberRole, PermissionSet> = {
  viewer: {
    can_manage_team: false,
    can_edit_vacation: false,
    can_edit_spots: false,
    can_edit_plan: false,
  },
  editor: {
    can_manage_team: false,
    can_edit_vacation: false,
    can_edit_spots: true,
    can_edit_plan: true,
  },
  admin: {
    can_manage_team: true,
    can_edit_vacation: true,
    can_edit_spots: true,
    can_edit_plan: true,
  },
  custom: {
    can_manage_team: false,
    can_edit_vacation: false,
    can_edit_spots: false,
    can_edit_plan: false,
  },
};

export const inviteRoleOptions: Array<{
  value: Exclude<MemberRole, "custom">;
  label: string;
  description: string;
}> = [
  { value: "viewer", label: "Betrachter", description: "Nur ansehen" },
  { value: "editor", label: "Bearbeiter", description: "Spots & Plan" },
  { value: "admin", label: "Admin", description: "Vollzugriff inkl. Team" },
];

export function permissionSetForRole(role: Exclude<MemberRole, "custom">): PermissionSet {
  return { ...rolePresets[role] };
}

export function pickPermissions(member: PermissionSet): PermissionSet {
  return {
    can_manage_team: Boolean(member.can_manage_team),
    can_edit_vacation: Boolean(member.can_edit_vacation),
    can_edit_spots: Boolean(member.can_edit_spots),
    can_edit_plan: Boolean(member.can_edit_plan),
  };
}

export function roleForPermissions(input: PermissionSet): MemberRole {
  const permissions = pickPermissions(input);
  if (matchesPreset(permissions, "viewer")) return "viewer";
  if (matchesPreset(permissions, "editor")) return "editor";
  if (matchesPreset(permissions, "admin")) return "admin";
  return "custom";
}

export function matchesPreset(
  input: PermissionSet,
  role: Exclude<MemberRole, "custom">,
): boolean {
  const preset = rolePresets[role];
  return (
    input.can_manage_team === preset.can_manage_team &&
    input.can_edit_vacation === preset.can_edit_vacation &&
    input.can_edit_spots === preset.can_edit_spots &&
    input.can_edit_plan === preset.can_edit_plan
  );
}

export function roleLabel(role: MemberRole): string {
  switch (role) {
    case "viewer":
      return "Betrachter";
    case "editor":
      return "Bearbeiter";
    case "admin":
      return "Admin";
    case "custom":
      return "Angepasst";
  }
}
