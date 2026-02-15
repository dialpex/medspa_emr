interface PatientAvatarProps {
  firstName: string;
  lastName: string;
  size?: "sm" | "md";
  imageUrl?: string | null;
}

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
} as const;

export function PatientAvatar({ firstName, lastName, size = "sm", imageUrl }: PatientAvatarProps) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${firstName} ${lastName}`}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full bg-gradient-to-br from-purple-400 to-indigo-400 text-white font-semibold flex items-center justify-center flex-shrink-0`}
    >
      {initials}
    </div>
  );
}
