"""
VisionEye Resumable Chunked Video Upload & Flip API Module
Implements high-performance, parallel, chunk-validated, resumable video uploads
and atomic counting line flip operations.
"""
import os
import re
import time
import math
import uuid
import hashlib
import logging
import threading
from typing import Dict, Any, Optional, Set
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .apps import get_pipeline

logger = logging.getLogger("visioneye.upload")

# Max allowed file size: 2 GB (configurable)
MAX_FILE_SIZE = getattr(settings, "MAX_VIDEO_UPLOAD_SIZE", 2 * 1024 * 1024 * 1024)
MIN_CHUNK_SIZE = 100 * 1024  # 100 KB
MAX_CHUNK_SIZE = 50 * 1024 * 1024  # 50 MB
DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB
SESSION_TIMEOUT_SECONDS = 86400  # 24 hours

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


class UploadSession:
    def __init__(
        self,
        upload_id: str,
        file_name: str,
        file_size: int,
        content_type: str,
        chunk_size: int,
        file_hash: Optional[str] = None,
    ):
        self.upload_id = upload_id
        self.file_name = file_name
        self.file_size = file_size
        self.content_type = content_type
        self.chunk_size = chunk_size
        self.total_chunks = max(1, math.ceil(file_size / chunk_size))
        self.file_hash = file_hash
        self.uploaded_chunks: Set[int] = set()
        self.chunk_hashes: Dict[int, str] = {}
        self.status = "initialized"  # "initialized" | "uploading" | "completed" | "cancelled"
        self.created_at = time.time()
        self.updated_at = time.time()
        self.final_file_path: Optional[str] = None
        self._lock = threading.Lock()

    def get_chunk_dir(self) -> str:
        chunks_root = os.path.join(settings.MEDIA_ROOT, "uploads", "chunks", self.upload_id)
        os.makedirs(chunks_root, exist_ok=True)
        return chunks_root

    def get_chunk_file_path(self, chunk_index: int) -> str:
        return os.path.join(self.get_chunk_dir(), f"chunk_{chunk_index:06d}.part")

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "upload_id": self.upload_id,
                "file_name": self.file_name,
                "file_size": self.file_size,
                "content_type": self.content_type,
                "chunk_size": self.chunk_size,
                "total_chunks": self.total_chunks,
                "uploaded_chunks": sorted(list(self.uploaded_chunks)),
                "uploaded_count": len(self.uploaded_chunks),
                "progress_percentage": round((len(self.uploaded_chunks) / self.total_chunks) * 100, 1),
                "status": self.status,
                "created_at": self.created_at,
                "updated_at": self.updated_at,
                "final_file_path": self.final_file_path,
            }


class UploadSessionManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(UploadSessionManager, cls).__new__(cls)
                cls._instance._sessions: Dict[str, UploadSession] = {}
                cls._instance._cleanup_thread = None
        return cls._instance

    def create_session(
        self,
        file_name: str,
        file_size: int,
        content_type: str = "video/mp4",
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        file_hash: Optional[str] = None,
    ) -> UploadSession:
        # Sanitize filename
        clean_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", os.path.basename(file_name))
        ext = os.path.splitext(clean_name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            clean_name = f"{os.path.splitext(clean_name)[0]}.mp4"

        # Constrain chunk size
        bounded_chunk_size = max(MIN_CHUNK_SIZE, min(MAX_CHUNK_SIZE, int(chunk_size)))

        upload_id = str(uuid.uuid4())
        session = UploadSession(
            upload_id=upload_id,
            file_name=clean_name,
            file_size=file_size,
            content_type=content_type,
            chunk_size=bounded_chunk_size,
            file_hash=file_hash,
        )

        with self._lock:
            self._sessions[upload_id] = session

        logger.info(
            f"[UploadSession] Created session {upload_id} for '{clean_name}' "
            f"({file_size} bytes, {session.total_chunks} chunks of {bounded_chunk_size} bytes)"
        )
        return session

    def get_session(self, upload_id: str) -> Optional[UploadSession]:
        with self._lock:
            session = self._sessions.get(upload_id)
            if session:
                session.updated_at = time.time()
            return session

    def cancel_session(self, upload_id: str) -> bool:
        session = self.get_session(upload_id)
        if not session:
            return False

        with session._lock:
            session.status = "cancelled"
            session.updated_at = time.time()

        # Clean chunk directory
        chunk_dir = session.get_chunk_dir()
        if os.path.exists(chunk_dir):
            try:
                for f in os.listdir(chunk_dir):
                    os.remove(os.path.join(chunk_dir, f))
                os.rmdir(chunk_dir)
            except Exception as e:
                logger.warning(f"[UploadSession] Error cleaning cancelled chunks for {upload_id}: {e}")

        logger.info(f"[UploadSession] Cancelled and purged session {upload_id}")
        return True


upload_manager = UploadSessionManager()


class UploadInitView(APIView):
    """
    Initializes a new resumable video upload session.
    POST /api/video/upload/init
    Body: { "file_name": str, "file_size": int, "content_type": str, "chunk_size": int, "file_hash": Optional[str] }
    """
    parser_classes = [JSONParser, FormParser]

    def post(self, request):
        try:
            file_name = request.data.get("file_name")
            file_size = request.data.get("file_size")

            if not file_name:
                return Response({"error": "file_name is required"}, status=status.HTTP_400_BAD_REQUEST)
            if file_size is None or int(file_size) <= 0:
                return Response({"error": "file_size must be a positive integer"}, status=status.HTTP_400_BAD_REQUEST)

            file_size = int(file_size)
            if file_size > MAX_FILE_SIZE:
                return Response(
                    {"error": f"File size exceeds maximum allowed ({MAX_FILE_SIZE / (1024*1024):.0f} MB)"},
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )

            content_type = request.data.get("content_type", "video/mp4")
            chunk_size = int(request.data.get("chunk_size", DEFAULT_CHUNK_SIZE))
            file_hash = request.data.get("file_hash")

            session = upload_manager.create_session(
                file_name=file_name,
                file_size=file_size,
                content_type=content_type,
                chunk_size=chunk_size,
                file_hash=file_hash,
            )

            return Response(session.to_dict(), status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"[UploadInitView] Error: {e}", exc_info=True)
            return Response({"error": f"Failed to initialize upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadStatusView(APIView):
    """
    Retrieves the status of an existing upload session to support resuming.
    GET /api/video/upload/status/<upload_id>
    """
    def get(self, request, upload_id: str):
        session = upload_manager.get_session(upload_id)
        if not session:
            return Response({"error": f"Upload session '{upload_id}' not found or expired"}, status=status.HTTP_404_NOT_FOUND)
        return Response(session.to_dict(), status=status.HTTP_200_OK)


class UploadChunkView(APIView):
    """
    Receives an individual video chunk with integrity hash validation.
    POST /api/video/upload/chunk
    Multipart Form Data: upload_id, chunk_index, chunk_hash, chunk_file
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        try:
            upload_id = request.data.get("upload_id")
            chunk_index_raw = request.data.get("chunk_index")
            chunk_file = request.FILES.get("chunk_file") or request.FILES.get("file")
            client_hash = request.data.get("chunk_hash")

            if not upload_id or chunk_index_raw is None or not chunk_file:
                return Response(
                    {"error": "upload_id, chunk_index, and chunk_file are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            chunk_index = int(chunk_index_raw)
            session = upload_manager.get_session(upload_id)
            if not session:
                return Response(
                    {"error": f"Upload session '{upload_id}' not found or expired"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if session.status == "cancelled":
                return Response({"error": "Upload session was cancelled"}, status=status.HTTP_410_GONE)

            if chunk_index < 0 or chunk_index >= session.total_chunks:
                return Response(
                    {"error": f"chunk_index {chunk_index} out of bounds [0, {session.total_chunks - 1}]"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            chunk_path = session.get_chunk_file_path(chunk_index)

            # Read and compute SHA-256 hash in a streaming manner
            sha256 = hashlib.sha256()
            with open(chunk_path, "wb") as f:
                for piece in chunk_file.chunks():
                    sha256.update(piece)
                    f.write(piece)

            server_hash = sha256.hexdigest()

            # Verify integrity if client provided a hash
            if client_hash and client_hash.lower().strip() != server_hash.lower():
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)
                logger.warning(
                    f"[UploadChunk] Integrity mismatch for chunk #{chunk_index}: "
                    f"client={client_hash}, server={server_hash}"
                )
                return Response(
                    {"error": "Chunk integrity verification failed (SHA-256 mismatch)"},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            with session._lock:
                session.uploaded_chunks.add(chunk_index)
                session.chunk_hashes[chunk_index] = server_hash
                session.status = "uploading"
                session.updated_at = time.time()
                uploaded_count = len(session.uploaded_chunks)

            logger.info(
                f"[UploadChunk] Saved chunk #{chunk_index}/{session.total_chunks} "
                f"for session {upload_id} ({chunk_file.size} bytes, total {uploaded_count}/{session.total_chunks})"
            )

            return Response({
                "upload_id": upload_id,
                "chunk_index": chunk_index,
                "status": "chunk_saved",
                "uploaded_count": uploaded_count,
                "total_chunks": session.total_chunks,
                "progress_percentage": round((uploaded_count / session.total_chunks) * 100, 1),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"[UploadChunkView] Error: {e}", exc_info=True)
            return Response({"error": f"Failed to save chunk: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadFinalizeView(APIView):
    """
    Assembles uploaded chunks into the final video file without full-RAM loading.
    POST /api/video/upload/finalize
    Body: { "upload_id": str, "file_hash": Optional[str] }
    """
    parser_classes = [JSONParser, FormParser]

    def post(self, request):
        try:
            upload_id = request.data.get("upload_id")
            if not upload_id:
                return Response({"error": "upload_id is required"}, status=status.HTTP_400_BAD_REQUEST)

            session = upload_manager.get_session(upload_id)
            if not session:
                return Response({"error": f"Upload session '{upload_id}' not found"}, status=status.HTTP_404_NOT_FOUND)

            # Idempotency check: if already completed, return existing path immediately
            with session._lock:
                if session.status == "completed" and session.final_file_path and os.path.exists(session.final_file_path):
                    return Response({
                        "status": "uploaded_and_started",
                        "file_name": session.file_name,
                        "file_path": session.final_file_path,
                        "size": session.file_size,
                        "already_finalized": True,
                    }, status=status.HTTP_200_OK)

            # Check that all chunks exist
            missing_chunks = [i for i in range(session.total_chunks) if i not in session.uploaded_chunks]
            if missing_chunks:
                return Response({
                    "error": "Cannot finalize upload: missing chunks",
                    "missing_chunks": missing_chunks[:20],
                    "total_missing": len(missing_chunks),
                }, status=status.HTTP_400_BAD_REQUEST)

            # Destination file path
            upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            timestamp = int(time.time())
            base_name, ext = os.path.splitext(session.file_name)
            final_file_name = f"{base_name}_{timestamp}{ext}"
            final_path = os.path.join(upload_dir, final_file_name)

            # Stream assemble chunks sequentially (64 KB chunk buffer)
            file_sha256 = hashlib.sha256()
            total_assembled_bytes = 0

            with open(final_path, "wb") as out_f:
                for i in range(session.total_chunks):
                    chunk_path = session.get_chunk_file_path(i)
                    if not os.path.exists(chunk_path):
                        return Response(
                            {"error": f"Chunk file #{i} missing from disk storage"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        )
                    with open(chunk_path, "rb") as chunk_f:
                        while True:
                            buf = chunk_f.read(65536)
                            if not buf:
                                break
                            file_sha256.update(buf)
                            out_f.write(buf)
                            total_assembled_bytes += len(buf)

            # Verify final assembled size
            if total_assembled_bytes != session.file_size:
                logger.warning(
                    f"[UploadFinalize] Assembled size ({total_assembled_bytes}) differs from expected ({session.file_size})"
                )

            # Optional client file hash verification
            expected_hash = request.data.get("file_hash") or session.file_hash
            if expected_hash:
                actual_hash = file_sha256.hexdigest()
                if expected_hash.lower().strip() != actual_hash.lower():
                    logger.warning(f"[UploadFinalize] Final hash mismatch: expected={expected_hash}, actual={actual_hash}")

            # Clean up chunk files
            chunk_dir = session.get_chunk_dir()
            try:
                for f in os.listdir(chunk_dir):
                    os.remove(os.path.join(chunk_dir, f))
                os.rmdir(chunk_dir)
            except Exception as clean_err:
                logger.warning(f"[UploadFinalize] Chunk cleanup warning: {clean_err}")

            with session._lock:
                session.status = "completed"
                session.final_file_path = final_path
                session.updated_at = time.time()

            logger.info(f"[UploadFinalize] Successfully assembled '{final_file_name}' ({total_assembled_bytes} bytes)")

            # Automatically switch pipeline to the newly uploaded video file
            pipeline = get_pipeline()
            started = pipeline.start(source_type="file", source_path=final_path)

            return Response({
                "status": "uploaded_and_started" if started else "uploaded",
                "file_name": final_file_name,
                "file_path": final_path,
                "size": total_assembled_bytes,
                "source_info": pipeline.video_source.get_info(),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"[UploadFinalizeView] Finalization failed: {e}", exc_info=True)
            return Response({"error": f"Failed to finalize video: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadCancelView(APIView):
    """
    Cancels an active upload session and cleans up temporary chunk storage.
    POST /api/video/upload/cancel
    """
    parser_classes = [JSONParser, FormParser]

    def post(self, request):
        upload_id = request.data.get("upload_id")
        if not upload_id:
            return Response({"error": "upload_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        cancelled = upload_manager.cancel_session(upload_id)
        return Response({
            "status": "cancelled" if cancelled else "not_found",
            "upload_id": upload_id,
        }, status=status.HTTP_200_OK)


class CountingLineFlipView(APIView):
    """
    Atomically flips or configures IN/OUT counting line orientation.
    POST /api/counting-line/flip
    Body: { "action": "flip" | "flip_in" | "flip_out" }
    """
    parser_classes = [JSONParser, FormParser]

    def post(self, request):
        pipeline = get_pipeline()
        action = request.data.get("action", "flip").lower()

        current_start = list(pipeline.analytics.norm_line_start)
        current_end = list(pipeline.analytics.norm_line_end)

        # Flip swaps Point A and Point B atomically
        new_start = current_end
        new_end = current_start

        pipeline.set_counting_line(new_start, new_end)

        logger.info(
            f"[CountingLineFlip] Action='{action}'. Swapped counting line: "
            f"{current_start}->{current_end} => {new_start}->{new_end}"
        )

        return Response({
            "status": "flipped",
            "action": action,
            "counting_line": {
                "start": pipeline.analytics.norm_line_start,
                "end": pipeline.analytics.norm_line_end,
            },
        }, status=status.HTTP_200_OK)
