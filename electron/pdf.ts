import { BrowserWindow } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Renders a finished invoice or statement page to PDF in an offscreen window.
 *
 * The HTML is written to a temp file rather than a data: URL, because an
 * invoice with a logo and many lines outgrows what a URL can carry. Scripts are
 * off: the pages we print are static markup.
 */
export async function renderHtmlToPdf(html: string, options: { landscape?: boolean; pageSize?: "A4" | "A5" } = {}): Promise<Buffer> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "islamia-printers-pdf-"));
  const htmlPath = path.join(directory, "document.html");
  fs.writeFileSync(htmlPath, html, "utf8");

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      javascript: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await window.loadFile(htmlPath);

    return await window.webContents.printToPDF({
      printBackground: true,
      pageSize: options.pageSize === "A5" ? "A5" : "A4",
      landscape: options.landscape === true,
      // A bill-book page is laid out edge to edge in millimetres, so it gets no margin of its own.
      margins: options.pageSize === "A5" ? { marginType: "none" } : { marginType: "custom", top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });
  } finally {
    window.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/** Adds " (2)", " (3)" and so on rather than writing over a PDF that is already there. */
export function uniqueFilePath(directory: string, fileName: string) {
  const extension = path.extname(fileName);
  const base = path.basename(fileName, extension);
  let candidate = path.join(directory, fileName);

  for (let attempt = 2; fs.existsSync(candidate); attempt += 1) {
    candidate = path.join(directory, `${base} (${attempt})${extension}`);
  }

  return candidate;
}
