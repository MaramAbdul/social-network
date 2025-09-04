export async function uploadImage(file) {
  const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(API + "/api/upload", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  if (!res.ok)
    throw new Error((await res.text().catch(() => "")) || "upload failed");
  return res.json(); // { url: "/uploads/xxx.jpg" }
}
