// Sends the 1-bit image to the ESP32 over Web Serial (Chrome and Edge on a computer).
// Frame: "INK1", length (2 bytes, little endian), image, 1 byte sum of the image bytes.

export const supported = "serial" in navigator;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function lineReader(reader) {
  const dec = new TextDecoder();
  const queue = [];
  let buf = "", closed = false, wake = null;
  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          queue.push(buf.slice(0, i).trim());
          buf = buf.slice(i + 1);
        }
        if (wake) wake();
      }
    } catch (e) {}
    closed = true;
    if (wake) wake();
  })();

  return async function waitFor(test, ms, timeoutMessage) {
    const end = Date.now() + ms;
    for (;;) {
      while (queue.length) {
        const line = queue.shift();
        if (test(line)) return line;
      }
      if (closed) throw new Error("The card was disconnected.");
      const left = end - Date.now();
      if (left <= 0) throw new Error(timeoutMessage);
      await new Promise(r => { wake = r; setTimeout(r, Math.min(left, 250)); });
      wake = null;
    }
  };
}

export async function send(bitmap, status) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  const reader = port.readable.getReader();
  const waitFor = lineReader(reader);
  try {
    status("Restarting the card… If nothing happens, press its reset (EN) button.");
    // pulse EN through the board's auto-reset circuit, keeping IO0 high so it boots normally
    await port.setSignals({ dataTerminalReady: false, requestToSend: true });
    await sleep(120);
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await waitFor(l => l.startsWith("INKCARD READY"), 10000,
      "The card didn't answer. Check that the inkcard firmware is flashed and try again.");

    status("Sending…");
    let sum = 0;
    for (const b of bitmap) sum = (sum + b) & 255;
    const frame = new Uint8Array(6 + bitmap.length + 1);
    frame.set([0x49, 0x4e, 0x4b, 0x31, bitmap.length & 255, bitmap.length >> 8]);
    frame.set(bitmap, 6);
    frame[frame.length - 1] = sum;
    const writer = port.writable.getWriter();
    await writer.write(frame);
    writer.releaseLock();

    status("Drawing… an e-ink refresh takes a few seconds.");
    const reply = await waitFor(l => l === "OK" || l.startsWith("ERR"), 15000,
      "The card stopped responding while drawing.");
    if (reply !== "OK") throw new Error(`The card reported a problem (${reply.slice(4)}). Try again.`);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
    await port.close().catch(() => {});
  }
}
