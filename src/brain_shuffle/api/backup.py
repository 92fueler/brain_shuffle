from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from brain_shuffle.db import get_session
from brain_shuffle.schemas.backup import BackupPayload
from brain_shuffle.services.backup_service import BackupService

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/export", response_model=BackupPayload)
def export_backup(session: Session = Depends(get_session)) -> BackupPayload:
    """Serialize all categories, problems, and history to a portable JSON payload."""
    service = BackupService(session)
    return service.export_data()


@router.post("/import")
def import_backup(payload: BackupPayload, session: Session = Depends(get_session)) -> dict:
    """Import and restore serialized data into the persistent store."""
    service = BackupService(session)
    count = service.import_data(payload)
    return {"status": "success", "imported_problems": count}


@router.post("/dump-local")
def dump_local(session: Session = Depends(get_session)) -> dict:
    """Dump current database state to the designated local backup folder."""
    service = BackupService(session)
    dest = Path("./data/backups/brain_shuffle_backup.json")
    saved_path = service.dump_to_file(dest)
    return {"status": "success", "file_path": str(saved_path)}


@router.post("/restore-local")
def restore_local(session: Session = Depends(get_session)) -> dict:
    """Restore database state from the default local backup file."""
    src = Path("./data/backups/brain_shuffle_backup.json")
    if not src.exists():
        raise HTTPException(status_code=404, detail="Default backup file not found")
    service = BackupService(session)
    count = service.load_from_file(src)
    return {"status": "success", "restored_problems": count}


@router.get("/status")
def get_snapshot_status(session: Session = Depends(get_session)) -> dict:
    """Return status and metadata of canonical SQLite snapshot."""
    service = BackupService(session)
    return service.get_snapshot_status()


@router.post("/snapshot-now")
def snapshot_now(session: Session = Depends(get_session)) -> dict:
    """Execute immediate VACUUM INTO snapshot to canonical location."""
    service = BackupService(session)
    saved_path = service.create_sqlite_snapshot()
    status_info = service.get_snapshot_status(saved_path)
    return {"status": "success", "snapshot": status_info}


@router.post("/restore-snapshot")
def restore_snapshot(session: Session = Depends(get_session)) -> dict:
    """Atomically restore live database from canonical SQLite snapshot."""
    service = BackupService(session)
    try:
        count = service.restore_sqlite_snapshot()
        return {"status": "success", "restored_problems": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

