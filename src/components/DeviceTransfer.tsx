import { useEffect, useState } from "react";
import { Copy, QrCode } from "lucide-react";
import type { TimetableProject } from "../domain/model";
import { encodeTransfer } from "../domain/transfer";
import { Field, Modal, Notice } from "./ui";

// Version 40, medium error correction, a single UTF-8 byte segment.
const QR_BYTE_LIMIT = 2331;

function TransferCode({ url }: { url: string }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void import("qrcode")
      .then((qr) =>
        qr.toDataURL([{ data: new TextEncoder().encode(url), mode: "byte" }], {
          errorCorrectionLevel: "M",
          margin: 4,
          scale: 8,
          color: { dark: "#000000", light: "#ffffff" },
        }),
      )
      .then((image) => {
        if (!cancelled) setImage(image);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (error)
    return (
      <Notice kind="error">
        The QR code could not be created. Copy the transfer link or download a
        backup instead.
      </Notice>
    );
  if (!image) return <p role="status">Creating your QR code…</p>;
  return (
    <img
      className="transfer-qr"
      src={image}
      alt="Scan to open this timetable in SchoolCal on another device"
    />
  );
}

export function DeviceTransfer({
  project,
  notify,
  onBackup,
}: {
  project: TimetableProject;
  notify: (message: string) => void;
  onBackup: () => void;
}) {
  const [result, setResult] = useState<{
    project: TimetableProject;
    url: string;
    error: string;
  }>();
  const [dialog, setDialog] = useState<"qr" | "link" | null>(null);
  const [manualCopy, setManualCopy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (typeof CompressionStream === "undefined")
          throw new Error(
            "This browser cannot create transfer links. Update your browser or download a backup instead.",
          );
        const hash = await encodeTransfer(project);
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = hash;
        if (!cancelled) setResult({ project, url: url.href, error: "" });
      } catch (error) {
        if (!cancelled)
          setResult({
            project,
            url: "",
            error:
              error instanceof Error
                ? error.message
                : "The transfer could not be created. Download a backup instead.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);
  // Never offer a link from an earlier version while a new one is preparing.
  const current = result?.project === project ? result : undefined;
  const url = current?.url || "";
  const tooLarge = new TextEncoder().encode(url).length > QR_BYTE_LIMIT;
  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      notify("Transfer link copied. Open it on your other device.");
    } catch {
      setManualCopy(true);
      setDialog("link");
    }
  }
  return (
    <section className="panel transfer-card">
      <div className="section-heading">
        <div>
          <h2>Copy on another device</h2>
          <p className="muted">
            Take your editable timetable and settings with you. Scan a QR code
            with your other device’s camera, then confirm the import in
            SchoolCal.
          </p>
        </div>
        <QrCode size={20} className="muted" />
      </div>
      <div className="page-actions">
        <button
          className="button secondary"
          disabled={!url || tooLarge}
          onClick={() => setDialog("qr")}
        >
          <QrCode size={16} />
          Show QR code
        </button>
        <button
          className="button secondary"
          disabled={!url}
          onClick={() => void copyLink()}
        >
          <Copy size={16} />
          Copy transfer link
        </button>
      </div>
      {!current && (
        <p className="muted small" role="status">
          Preparing your transfer…
        </p>
      )}
      {current?.error && (
        <Notice>
          {current.error}{" "}
          <button className="inline-link" onClick={onBackup}>
            Download backup (.json)
          </button>
        </Notice>
      )}
      {tooLarge && (
        <Notice>
          This timetable is too large for a single QR code. Copy the transfer
          link, or{" "}
          <button className="inline-link" onClick={onBackup}>
            download a backup
          </button>{" "}
          to move it to another device.
        </Notice>
      )}
      <p className="muted small">
        This creates a copy. Later edits stay on the device where you make them.
        Your devices do not need to be on the same network.
      </p>
      {dialog && url && (
        <Modal
          title={
            dialog === "qr"
              ? "Scan to continue on another device"
              : "Your transfer link"
          }
          onClose={() => {
            setDialog(null);
            setManualCopy(false);
          }}
          className="transfer-modal"
        >
          <p>
            <strong>{project.name || "Untitled timetable"}</strong>
          </p>
          {dialog === "qr" && !tooLarge && <TransferCode key={url} url={url} />}
          <p>
            {dialog === "qr"
              ? "Open your other device’s camera, scan the code, and open the link in SchoolCal."
              : "Send this link to your other device and open it in SchoolCal."}{" "}
            Choose “Use this timetable” to continue editing there.
          </p>
          {manualCopy && (
            <Notice>
              Automatic copying is unavailable. Select and copy the link below.
            </Notice>
          )}
          {dialog === "link" && (
            <Field label="Transfer link">
              <textarea
                className="transfer-link"
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                rows={3}
              />
            </Field>
          )}
          <div className="page-actions">
            <button
              className="button secondary"
              onClick={() => void copyLink()}
            >
              <Copy size={16} />
              Copy transfer link
            </button>
            <button className="button secondary" onClick={onBackup}>
              Download backup (.json)
            </button>
          </div>
          <p className="muted small">
            The code and link contain your timetable. Share them only with
            someone you want to have a copy.
          </p>
        </Modal>
      )}
    </section>
  );
}
