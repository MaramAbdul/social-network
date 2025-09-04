export function wsURL() {
  const base = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
  return base.replace(/^http/i, "ws") + "/ws";
}

export function joinRoom(room, onMessage) {
  const url = wsURL() + "?room=" + encodeURIComponent(room);
  let ws = new WebSocket(url);
  let timer;

  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {}
  };
  ws.onopen = () => {
    timer = setInterval(() => {
      try {
        ws.send("ping");
      } catch {}
    }, 30000);
  };
  ws.onclose = () => {
    clearInterval(timer); /* optional: reconnect */
  };
  ws.onerror = () => {};

  return ws;
}

export const joinUserChannel = (userId, onMessage) =>
  joinRoom(`user:${userId}`, onMessage);
