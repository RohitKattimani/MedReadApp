from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ================== MODELS ==================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    google_access_token: Optional[str] = None
    google_refresh_token: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Image(BaseModel):
    model_config = ConfigDict(extra="ignore")
    image_id: str = Field(default_factory=lambda: f"img_{uuid.uuid4().hex[:12]}")
    user_id: str
    filename: str
    category: str  # 'cancer', 'normal', 'benign', or custom
    source: str  # 'upload' or 'drive'
    drive_file_id: Optional[str] = None
    drive_folder_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    image_data: Optional[str] = None  # Base64 encoded for uploaded images
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReadingSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: f"session_{uuid.uuid4().hex[:12]}")
    user_id: str
    status: str = "in_progress"  # 'in_progress', 'paused', 'completed', 'quit'
    total_images: int = 0
    images_reviewed: int = 0
    correct_count: int = 0
    total_time_ms: int = 0
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    pause_duration_ms: int = 0

class SessionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    response_id: str = Field(default_factory=lambda: f"resp_{uuid.uuid4().hex[:12]}")
    session_id: str
    image_id: str
    user_diagnosis: str
    actual_category: str
    is_correct: bool
    time_taken_ms: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DriveFolder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    folder_id: str = Field(default_factory=lambda: f"folder_{uuid.uuid4().hex[:12]}")
    user_id: str
    drive_folder_id: str
    folder_name: str
    category: str
    synced_at: Optional[datetime] = None
    image_count: int = 0

# ================== AUTH HELPERS ==================

async def get_current_user(request: Request) -> dict:
    """Get current user from session token (cookie or header)"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone awareness
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user_doc

# ================== AUTH ENDPOINTS ==================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Get user data from Emergent auth
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        user_data = auth_response.json()
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user data
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": user_data["name"],
                "picture": user_data.get("picture")
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data.get("session_token", str(uuid.uuid4()))
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    # Return user data with session token for frontend storage
    return {
        **user_doc,
        "session_token": session_token
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ================== IMAGE ENDPOINTS ==================

@api_router.get("/images")
async def get_images(request: Request, category: Optional[str] = None):
    """Get all images for current user"""
    user = await get_current_user(request)
    
    query = {"user_id": user["user_id"]}
    if category:
        query["category"] = category
    
    images = await db.images.find(query, {"_id": 0}).to_list(1000)
    return images

@api_router.post("/images/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    category: str = Form(...)
):
    """Upload a medical image"""
    user = await get_current_user(request)
    
    # Read and encode file
    content = await file.read()
    base64_data = base64.b64encode(content).decode('utf-8')
    
    # Determine content type
    content_type = file.content_type or 'image/jpeg'
    
    image_doc = {
        "image_id": f"img_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "filename": file.filename,
        "category": category.lower(),
        "source": "upload",
        "image_data": f"data:{content_type};base64,{base64_data}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.images.insert_one(image_doc)
    del image_doc["_id"]
    
    return image_doc

@api_router.delete("/images/{image_id}")
async def delete_image(image_id: str, request: Request):
    """Delete an image"""
    user = await get_current_user(request)
    
    result = await db.images.delete_one({
        "image_id": image_id,
        "user_id": user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return {"message": "Image deleted"}

@api_router.get("/images/random")
async def get_random_images(request: Request, count: int = 20):
    """Get random images for a reading session"""
    user = await get_current_user(request)
    
    # Use aggregation to get random images
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$sample": {"size": count}},
        {"$project": {"_id": 0}}
    ]
    
    images = await db.images.aggregate(pipeline).to_list(count)
    return images

@api_router.get("/images/stats")
async def get_image_stats(request: Request):
    """Get image statistics by category"""
    user = await get_current_user(request)
    
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$project": {"category": "$_id", "count": 1, "_id": 0}}
    ]
    
    stats = await db.images.aggregate(pipeline).to_list(100)
    total = sum(s["count"] for s in stats)
    
    return {"categories": stats, "total": total}

# ================== DRIVE ENDPOINTS ==================

@api_router.post("/drive/folders")
async def add_drive_folder(request: Request):
    """Add a Google Drive folder for syncing"""
    user = await get_current_user(request)
    body = await request.json()
    
    folder_doc = {
        "folder_id": f"folder_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "drive_folder_id": body["drive_folder_id"],
        "folder_name": body["folder_name"],
        "category": body["category"].lower(),
        "image_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.drive_folders.insert_one(folder_doc)
    del folder_doc["_id"]
    
    return folder_doc

@api_router.get("/drive/folders")
async def get_drive_folders(request: Request):
    """Get all connected Drive folders"""
    user = await get_current_user(request)
    
    folders = await db.drive_folders.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    return folders

@api_router.delete("/drive/folders/{folder_id}")
async def delete_drive_folder(folder_id: str, request: Request):
    """Delete a Drive folder connection"""
    user = await get_current_user(request)
    
    # Get folder info
    folder = await db.drive_folders.find_one({
        "folder_id": folder_id,
        "user_id": user["user_id"]
    })
    
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Delete folder and its images
    await db.drive_folders.delete_one({"folder_id": folder_id})
    await db.images.delete_many({
        "user_id": user["user_id"],
        "drive_folder_id": folder["drive_folder_id"]
    })
    
    return {"message": "Folder and images deleted"}

@api_router.post("/drive/sync/{folder_id}")
async def sync_drive_folder(folder_id: str, request: Request):
    """Sync images from a Drive folder (simulated - would need actual Drive API)"""
    user = await get_current_user(request)
    
    folder = await db.drive_folders.find_one({
        "folder_id": folder_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Note: In production, this would use Google Drive API to fetch actual images
    # For now, we'll return a message indicating the folder is ready for manual upload
    
    await db.drive_folders.update_one(
        {"folder_id": folder_id},
        {"$set": {"synced_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "message": "Folder synced",
        "folder_id": folder_id,
        "note": "Upload images manually or connect Google Drive API for auto-sync"
    }

# ================== READING SESSION ENDPOINTS ==================

@api_router.post("/sessions/start")
async def start_session(request: Request):
    """Start a new reading session"""
    user = await get_current_user(request)
    body = await request.json()
    
    image_count = body.get("image_count", 20)
    
    # Check if user has images
    total_images = await db.images.count_documents({"user_id": user["user_id"]})
    if total_images == 0:
        raise HTTPException(status_code=400, detail="No images available. Please upload images first.")
    
    # Create session
    session_doc = {
        "session_id": f"session_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "status": "in_progress",
        "total_images": min(image_count, total_images),
        "images_reviewed": 0,
        "correct_count": 0,
        "total_time_ms": 0,
        "pause_duration_ms": 0,
        "started_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reading_sessions.insert_one(session_doc)
    del session_doc["_id"]
    
    # Get random images for this session
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$sample": {"size": session_doc["total_images"]}},
        {"$project": {"_id": 0}}
    ]
    
    images = await db.images.aggregate(pipeline).to_list(session_doc["total_images"])
    
    return {
        "session": session_doc,
        "images": images
    }

@api_router.post("/sessions/{session_id}/response")
async def submit_response(session_id: str, request: Request):
    """Submit a diagnosis response for an image"""
    user = await get_current_user(request)
    body = await request.json()
    
    # Get session
    session = await db.reading_sessions.find_one({
        "session_id": session_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] not in ["in_progress", "paused"]:
        raise HTTPException(status_code=400, detail="Session is not active")
    
    # Get image to verify category
    image = await db.images.find_one({"image_id": body["image_id"]}, {"_id": 0})
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Determine if correct
    user_diagnosis = body["diagnosis"].lower()
    actual_category = image["category"].lower()
    is_correct = user_diagnosis == actual_category
    
    # Create response
    response_doc = {
        "response_id": f"resp_{uuid.uuid4().hex[:12]}",
        "session_id": session_id,
        "image_id": body["image_id"],
        "user_diagnosis": user_diagnosis,
        "actual_category": actual_category,
        "is_correct": is_correct,
        "time_taken_ms": body["time_taken_ms"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.session_responses.insert_one(response_doc)
    
    # Update session stats
    update_data = {
        "$inc": {
            "images_reviewed": 1,
            "total_time_ms": body["time_taken_ms"],
            "correct_count": 1 if is_correct else 0
        }
    }
    
    await db.reading_sessions.update_one(
        {"session_id": session_id},
        update_data
    )
    
    return {
        "response_id": response_doc["response_id"],
        "is_correct": is_correct,
        "actual_category": actual_category
    }

@api_router.post("/sessions/{session_id}/pause")
async def pause_session(session_id: str, request: Request):
    """Pause a reading session"""
    user = await get_current_user(request)
    
    session = await db.reading_sessions.find_one({
        "session_id": session_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Session is not in progress")
    
    await db.reading_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": "paused",
            "paused_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Session paused"}

@api_router.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str, request: Request):
    """Resume a paused session"""
    user = await get_current_user(request)
    
    session = await db.reading_sessions.find_one({
        "session_id": session_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] != "paused":
        raise HTTPException(status_code=400, detail="Session is not paused")
    
    # Calculate pause duration
    paused_at = session.get("paused_at")
    if paused_at:
        if isinstance(paused_at, str):
            paused_at = datetime.fromisoformat(paused_at)
        if paused_at.tzinfo is None:
            paused_at = paused_at.replace(tzinfo=timezone.utc)
        
        pause_duration = (datetime.now(timezone.utc) - paused_at).total_seconds() * 1000
        
        await db.reading_sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {"status": "in_progress", "paused_at": None},
                "$inc": {"pause_duration_ms": int(pause_duration)}
            }
        )
    else:
        await db.reading_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "in_progress"}}
        )
    
    return {"message": "Session resumed"}

@api_router.post("/sessions/{session_id}/complete")
async def complete_session(session_id: str, request: Request):
    """Complete a reading session"""
    user = await get_current_user(request)
    
    session = await db.reading_sessions.find_one({
        "session_id": session_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.reading_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get responses for this session
    responses = await db.session_responses.find(
        {"session_id": session_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Get updated session
    updated_session = await db.reading_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    return {
        "session": updated_session,
        "responses": responses
    }

@api_router.post("/sessions/{session_id}/quit")
async def quit_session(session_id: str, request: Request):
    """Quit a reading session"""
    user = await get_current_user(request)
    
    await db.reading_sessions.update_one(
        {"session_id": session_id, "user_id": user["user_id"]},
        {"$set": {
            "status": "quit",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Session quit"}

@api_router.get("/sessions")
async def get_sessions(request: Request):
    """Get all reading sessions for current user"""
    user = await get_current_user(request)
    
    sessions = await db.reading_sessions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("started_at", -1).to_list(100)
    
    return sessions

@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    """Get a specific reading session with responses"""
    user = await get_current_user(request)
    
    session = await db.reading_sessions.find_one({
        "session_id": session_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    responses = await db.session_responses.find(
        {"session_id": session_id},
        {"_id": 0}
    ).to_list(1000)
    
    return {
        "session": session,
        "responses": responses
    }

@api_router.get("/sessions/{session_id}/csv")
async def get_session_csv(session_id: str, request: Request):
    """Get session results as CSV"""
    user = await get_current_user(request)
    
    session = await db.reading_sessions.find_one({
        "session_id": session_id,
        "user_id": user["user_id"]
    }, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    responses = await db.session_responses.find(
        {"session_id": session_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Build CSV
    csv_lines = ["Image ID,Your Diagnosis,Actual Category,Correct,Time (ms)"]
    for r in responses:
        csv_lines.append(f"{r['image_id']},{r['user_diagnosis']},{r['actual_category']},{r['is_correct']},{r['time_taken_ms']}")
    
    # Add summary
    csv_lines.append("")
    csv_lines.append("SUMMARY")
    csv_lines.append(f"Total Images,{session['images_reviewed']}")
    csv_lines.append(f"Correct,{session['correct_count']}")
    accuracy = (session['correct_count'] / session['images_reviewed'] * 100) if session['images_reviewed'] > 0 else 0
    csv_lines.append(f"Accuracy,{accuracy:.1f}%")
    avg_time = session['total_time_ms'] / session['images_reviewed'] if session['images_reviewed'] > 0 else 0
    csv_lines.append(f"Avg Time (ms),{avg_time:.0f}")
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=session_{session_id}.csv"}
    )

# ================== CATEGORIES ENDPOINTS ==================

@api_router.get("/categories")
async def get_categories(request: Request):
    """Get all unique categories used by user"""
    user = await get_current_user(request)
    
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {"_id": "$category"}},
        {"$project": {"category": "$_id", "_id": 0}}
    ]
    
    categories = await db.images.aggregate(pipeline).to_list(100)
    return [c["category"] for c in categories]

# ================== ROOT ENDPOINT ==================

@api_router.get("/")
async def root():
    return {"message": "MedRead API v1.0", "status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
