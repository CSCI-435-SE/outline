import { debounce } from "es-toolkit/compat";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { findCredentialMatches } from "@shared/utils/credentialPatterns";
import Storage from "@shared/utils/Storage";
import type Document from "~/models/Document";
import type { Editor as TEditor } from "~/editor";

/** How long to wait after the last local edit before scanning. */
const SCAN_DELAY = 2000;

/** Upper bound on remembered dismissals per document. */
const MAX_DISMISSED = 200;

const storageKey = (documentId: string) =>
  `credential-scan-dismissed:${documentId}`;

/**
 * Returns a stable, non-reversible fingerprint for a detected credential so
 * that dismissals can be remembered without storing the secret itself.
 *
 * @param value The matched credential text.
 * @returns A hex SHA-256 digest, or a 53-bit fallback hash when the Web Crypto
 * API is unavailable (non-secure contexts).
 */
export async function fingerprintCredential(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value)
    );
    return Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
  }

  // cyrb53: fast non-cryptographic fallback, only used to dedupe warnings.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `c53:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}`;
}

/**
 * Reads the fingerprints of credentials the current user has dismissed for a
 * document in this browser.
 *
 * @param documentId The document ID.
 * @returns The set of dismissed fingerprints.
 */
export function getDismissedFingerprints(documentId: string): Set<string> {
  const stored = Storage.get(storageKey(documentId));
  return new Set(
    Array.isArray(stored)
      ? stored.filter((fp): fp is string => typeof fp === "string")
      : []
  );
}

/**
 * Remembers dismissed credential fingerprints for a document, keeping only the
 * most recent entries.
 *
 * @param documentId The document ID.
 * @param fingerprints The fingerprints to add.
 */
export function addDismissedFingerprints(
  documentId: string,
  fingerprints: Iterable<string>
) {
  const merged = new Set(getDismissedFingerprints(documentId));
  for (const fp of fingerprints) {
    merged.delete(fp);
    merged.add(fp);
  }
  Storage.set(storageKey(documentId), [...merged].slice(-MAX_DISMISSED));
}

/**
 * Finds credentials in the text that have not been dismissed, keyed by
 * fingerprint. Identical values are only reported once.
 *
 * @param text The plain text to scan.
 * @param dismissed Fingerprints the user has already dismissed.
 * @returns A map of fingerprint to credential type name.
 */
export async function findUndismissedCredentials(
  text: string,
  dismissed: Set<string>
): Promise<Map<string, string>> {
  const byValue = new Map<string, string>();
  for (const { name, value } of findCredentialMatches(text)) {
    if (!byValue.has(value)) {
      byValue.set(value, name);
    }
  }

  const result = new Map<string, string>();
  for (const [value, name] of byValue) {
    const fp = await fingerprintCredential(value);
    if (!dismissed.has(fp) && !result.has(fp)) {
      result.set(fp, name);
    }
  }
  return result;
}

interface UseCredentialScanOptions {
  /** The document being edited. */
  document: Document;
  /** Ref to the editor instance. */
  editorRef: React.RefObject<TEditor | null>;
  /** Whether the current user is editing; scanning is off otherwise. */
  enabled: boolean;
}

/**
 * Scans the editor content for credentials, client-side, a short time after
 * the user's own edits and warns with a dismissible toast. Remote edits from
 * collaborators do not trigger a scan. Dismissed credentials are remembered
 * per document (as fingerprints, never raw text) and are not warned about
 * again. Scanning never blocks saving.
 *
 * @param options - the document, editor ref, and whether scanning is enabled.
 * @returns handleChange to pass to the editor's onChange, and flush to run any
 * pending scan immediately (e.g. on "Done editing").
 */
export function useCredentialScan({
  document,
  editorRef,
  enabled,
}: UseCredentialScanOptions) {
  const { t } = useTranslation();
  const toastId = `credential-scan-${document.id}`;

  /** Fingerprints currently shown in the warning toast. */
  const shownRef = useRef<Set<string>>(new Set());
  /** Whether there are local edits that have not been scanned yet. */
  const pendingRef = useRef(false);
  /** Incremented per scan so that stale async results are discarded. */
  const scanIdRef = useRef(0);

  const scan = useCallback(async () => {
    pendingRef.current = false;
    const scanId = ++scanIdRef.current;

    let text: string;
    try {
      const editor = editorRef.current;
      if (!editor?.view) {
        return;
      }
      text = editor.getPlainText();
    } catch (_err) {
      // The editor view may already be destroyed when flushing on unmount.
      return;
    }

    const found = await findUndismissedCredentials(
      text,
      getDismissedFingerprints(document.id)
    );
    if (scanId !== scanIdRef.current) {
      return;
    }

    const shown = shownRef.current;
    if (found.size === 0) {
      if (shown.size > 0) {
        // The flagged credentials were removed, so the warning is obsolete.
        // Programmatic dismissal does not fire onDismiss, so nothing is saved.
        toast.dismiss(toastId);
        shownRef.current = new Set();
      }
      return;
    }

    const unchanged =
      found.size === shown.size &&
      [...found.keys()].every((fp) => shown.has(fp));
    if (unchanged) {
      return;
    }

    const fingerprints = [...found.keys()];
    shownRef.current = new Set(fingerprints);

    const dismiss = () => {
      addDismissedFingerprints(document.id, fingerprints);
      shownRef.current = new Set();
    };

    toast.warning(t("Possible credential detected"), {
      id: toastId,
      description: t(
        "“{{ documentTitle }}” may contain: {{ credentialTypes }}. Anyone with access to the document can see it, consider removing it.",
        {
          documentTitle: document.titleWithDefault,
          credentialTypes: [...new Set(found.values())].join(", "),
          interpolation: { escapeValue: false },
        }
      ),
      duration: Infinity,
      action: { label: t("Dismiss"), onClick: dismiss },
      onDismiss: dismiss,
    });
  }, [document, editorRef, t, toastId]);

  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  });

  const debouncedScan = useMemo(
    () => debounce(() => void scanRef.current(), SCAN_DELAY),
    []
  );

  const flush = useCallback(() => {
    debouncedScan.cancel();
    if (pendingRef.current) {
      void scanRef.current();
    }
  }, [debouncedScan]);

  const handleChange = useCallback(
    (_value: unknown, event?: { remote: boolean }) => {
      if (!enabled || event?.remote) {
        return;
      }
      pendingRef.current = true;
      debouncedScan();
    },
    [enabled, debouncedScan]
  );

  // Scan pending edits when the user stops editing (e.g. "Done editing").
  useEffect(() => {
    if (!enabled) {
      flush();
    }
  }, [enabled, flush]);

  // Scan pending edits when leaving the document. A layout effect is used
  // because its cleanup runs before the child editor's ref is detached, while
  // a passive effect cleanup would see editorRef.current as null.
  useLayoutEffect(() => () => flush(), [flush]);

  return { handleChange, flush };
}
