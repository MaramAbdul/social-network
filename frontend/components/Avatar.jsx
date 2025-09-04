export default function Avatar({ src, label, size = 56 }) {
  const s = { width: size, height: size, fontSize: Math.max(12, size / 3) };
  const initials = (label || "").slice(0, 2).toUpperCase();
  return src ? (
    <><img
          src={src}
          alt={label || "avatar"}
          style={s}
          className="rounded-full border" /></>
  ) : (
    <div
      style={s}
      className="rounded-full border flex items-center justify-center bg-white text-gray-700"
      aria-label={label || "avatar"}
    >
      {initials || "☺"}
    </div>
  );
}