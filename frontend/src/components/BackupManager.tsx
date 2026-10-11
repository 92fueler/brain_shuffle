import React, { useState, useEffect } from "react";
import {
  exportBackup,
  importBackup,
  fetchSnapshotStatus,
  createSnapshotNow,
  restoreSnapshot,
  type SnapshotStatus,
} from "../api";
import {
  HardDrive,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Calendar,
  FileText,
} from "lucide-react";

interface BackupManagerProps {
  onRefresh: () => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ onRefresh }) => {
  const [snapshot, setSnapshot] = useState<SnapshotStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Confirmation modal state for restore
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);

  // Advanced JSON portability drawer state (collapsed by default)
  const [showJsonPortability, setShowJsonPortability] = useState<boolean>(false);

  const loadSnapshotInfo = async () => {
    try {
      const data = await fetchSnapshotStatus();
      setSnapshot(data);
    } catch (err) {
      console.error("Failed to load snapshot status", err);
    }
  };

  useEffect(() => {
    loadSnapshotInfo();
  }, []);

  const handleTakeSnapshot = async () => {
    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await createSnapshotNow();
      setSnapshot(res.snapshot);
      const sizeKb = (res.snapshot.size_bytes / 1024).toFixed(1);
      setStatusMessage(
        `Snapshot created successfully (${sizeKb} KB, ${res.snapshot.problem_count} problems stored).`
      );
    } catch (err) {
      setErrorMessage("Failed to create native SQLite snapshot.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    setShowRestoreModal(false);
    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await restoreSnapshot();
      setStatusMessage(
        `Database restored successfully from snapshot (${res.restored_problems} problems synchronized).`
      );
      await loadSnapshotInfo();
      onRefresh();
    } catch (err) {
      setErrorMessage("Failed to restore database from snapshot.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // JSON Portability Handlers (Collapsed by default)
  const handleExportJson = async () => {
    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const payload = await exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brain_shuffle_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage("Export complete. Serialized JSON backup downloaded to your machine.");
    } catch (err) {
      setErrorMessage("Failed to export JSON backup.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importBackup(json);
      setStatusMessage(`JSON import complete: ${res.imported_problems} problems synced.`);
      await loadSnapshotInfo();
      onRefresh();
    } catch (err) {
      setErrorMessage("Failed to parse or restore JSON backup file.");
      console.error(err);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Never";
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="backup-manager">
      <div className="backup-card unified-snapshot-card">
        <div className="backup-header-row">
          <div>
            <h2>Database Snapshot & Recovery</h2>
            <p className="backup-desc">
              Deterministic, zero-friction snapshots using native SQLite compaction (<code>VACUUM INTO</code>).
              Always reads and writes to a designated canonical path without file dialogs.
            </p>
          </div>
          <div className="auto-backup-pill">
            <ShieldCheck size={16} />
            <span>WAL Mode Protected</span>
          </div>
        </div>

        {statusMessage && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} /> {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="alert alert-error">
            <AlertCircle size={18} /> {errorMessage}
          </div>
        )}

        {/* Canonical Snapshot Status Display */}
        <div className="canonical-snapshot-box">
          <div className="snapshot-box-left">
            <div className={`snapshot-status-icon ${snapshot?.exists ? "icon-ready" : "icon-missing"}`}>
              <HardDrive size={28} />
            </div>
            <div className="snapshot-box-details">
              <div className="snapshot-status-line">
                <span className={`status-indicator-dot ${snapshot?.exists ? "dot-ready" : "dot-missing"}`}></span>
                <strong className="snapshot-status-text">
                  {snapshot?.exists ? "Snapshot Ready" : "No Snapshot Found"}
                </strong>
                <span className="canonical-path-chip">
                  <code>./data/backups/brain_shuffle_snapshot.db</code>
                </span>
              </div>

              <div className="snapshot-meta-metrics">
                <span className="meta-metric-item">
                  <Calendar size={13} /> Last Saved: <strong>{formatDate(snapshot?.last_modified || null)}</strong>
                </span>
                <span className="dot-divider">•</span>
                <span className="meta-metric-item">
                  Size: <strong>{formatFileSize(snapshot?.size_bytes || 0)}</strong>
                </span>
                <span className="dot-divider">•</span>
                <span className="meta-metric-item">
                  <FileText size={13} /> <strong>{snapshot?.problem_count || 0}</strong> Problems
                </span>
              </div>
            </div>
          </div>

          <div className="snapshot-box-actions">
            <button
              type="button"
              className="primary-action-btn take-snapshot-btn"
              onClick={handleTakeSnapshot}
              disabled={loading}
              title="Capture instantaneous defragmented SQLite snapshot"
            >
              <HardDrive size={16} /> {loading ? "Snapshotting..." : "Take Snapshot Now"}
            </button>

            <button
              type="button"
              className="secondary-action-btn restore-snapshot-btn"
              onClick={() => setShowRestoreModal(true)}
              disabled={loading || !snapshot?.exists}
              title={snapshot?.exists ? "Restore database from canonical snapshot" : "No snapshot available to restore"}
            >
              <RotateCcw size={16} /> Restore from Snapshot
            </button>
          </div>
        </div>

        {/* Collapsible Advanced JSON Portability Section */}
        <div className="advanced-portability-container">
          <button
            type="button"
            className="advanced-toggle-btn"
            onClick={() => setShowJsonPortability(!showJsonPortability)}
          >
            {showJsonPortability ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Advanced: JSON File Export & Import (Cross-Machine Migration)</span>
          </button>

          {showJsonPortability && (
            <div className="advanced-portability-content">
              <p className="advanced-desc">
                Use JSON files only when transferring problems and study history to a different physical computer or external note vault.
              </p>
              <div className="portability-buttons-row">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={handleExportJson}
                  disabled={loading}
                >
                  <Download size={16} /> Download JSON Backup
                </button>

                <label className="file-upload-btn-inline">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    disabled={loading}
                    style={{ display: "none" }}
                  />
                  <Upload size={16} /> Restore from JSON File
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Database Restore */}
      {showRestoreModal && (
        <div className="modal-overlay" onClick={() => setShowRestoreModal(false)}>
          <div className="modal-content modal-content-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Database Restore</h2>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowRestoreModal(false)}
                title="Cancel"
              >
                ✕
              </button>
            </div>

            <div className="restore-modal-body">
              <div className="warning-banner">
                <AlertCircle size={22} className="warning-icon" />
                <p>
                  You are about to restore the database from the snapshot taken on{" "}
                  <strong>{formatDate(snapshot?.last_modified || null)}</strong>.
                </p>
              </div>
              <p className="restore-consequence-text">
                Live problems and review histories will be synchronized with the {snapshot?.problem_count || 0} problems stored in the snapshot. A safety rollback copy will be automatically created before restoration.
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action-btn"
                onClick={() => setShowRestoreModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action-btn confirm-restore-btn"
                onClick={handleConfirmRestore}
                disabled={loading}
              >
                {loading ? "Restoring..." : "Yes, Restore Database"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
