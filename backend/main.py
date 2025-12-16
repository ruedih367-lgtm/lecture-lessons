from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import tempfile
import shutil
from datetime import datetime
from PyPDF2 import PdfReader
import io
import json
from typing import Optional, List
import random
import string
import re
import subprocess

load_dotenv()

# Initialize
app = FastAPI()

# Groq client (free!) - used for both Whisper transcription AND LLaMA chat
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# CORS for frontend
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://lecture-lessons.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
)

# ============================================
# CONSTANTS
# ============================================
LIKES_BEFORE_ANALYSIS = 5  # Analyze after this many new likes
MAX_CONTEXT_CHARS = 48000
MAX_AUDIO_SIZE_MB = 25  # Groq's limit
CHUNK_SIZE_MB = 20  # Split into chunks smaller than limit
CHUNK_DURATION_MINUTES = 10  # Target chunk duration for splitting


# ============================================
# AUTHENTICATION HELPERS
# ============================================

def generate_class_code():
    """Generate a 6-character class code"""
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(chars, k=6))


async def get_current_user(authorization: Optional[str] = Header(None)):
    """Extract user from JWT token"""
    if not authorization:
        return None
    try:
        token = authorization.replace('Bearer ', '')
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return user_response.user.id
        return None
    except Exception as e:
        print(f"Auth error: {e}")
        return None


async def require_auth(authorization: Optional[str] = Header(None)):
    """Require authentication"""
    user_id = await get_current_user(authorization)
    if not user_id:
        raise HTTPException(401, "Authentication required")
    return user_id


async def check_class_membership(user_id: str, class_id: str):
    """Check if user is a member of the class"""
    result = supabase.table('class_members')\
        .select('id')\
        .eq('user_id', user_id)\
        .eq('class_id', class_id)\
        .execute()
    return len(result.data) > 0


# ============================================
# AUDIO PROCESSING HELPERS
# ============================================

def get_audio_duration(file_path: str) -> float:
    """Get audio duration in seconds using ffprobe"""
    try:
        result = subprocess.run(
            [
                'ffprobe', '-v', 'error', '-show_entries', 
                'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1',
                file_path
            ],
            capture_output=True, text=True, timeout=30
        )
        return float(result.stdout.strip())
    except Exception as e:
        print(f"Error getting duration: {e}")
        return 0


def split_audio_file(input_path: str, chunk_duration_seconds: int = 600) -> List[str]:
    """
    Split audio file into chunks using ffmpeg.
    Returns list of chunk file paths.
    """
    chunk_paths = []
    
    try:
        # Get total duration
        total_duration = get_audio_duration(input_path)
        if total_duration == 0:
            return [input_path]  # Return original if can't determine duration
        
        # Calculate number of chunks needed
        num_chunks = max(1, int(total_duration / chunk_duration_seconds) + 1)
        
        if num_chunks == 1:
            return [input_path]  # No need to split
        
        # Get file extension
        _, ext = os.path.splitext(input_path)
        
        # Split into chunks
        for i in range(num_chunks):
            start_time = i * chunk_duration_seconds
            
            # Create temp file for chunk
            chunk_path = tempfile.NamedTemporaryFile(
                delete=False, suffix=ext
            ).name
            
            # Use ffmpeg to extract chunk
            result = subprocess.run(
                [
                    'ffmpeg', '-y', '-i', input_path,
                    '-ss', str(start_time),
                    '-t', str(chunk_duration_seconds),
                    '-c', 'copy',  # Fast copy without re-encoding
                    chunk_path
                ],
                capture_output=True, text=True, timeout=120
            )
            
            # Check if chunk has content (file exists and has size)
            if os.path.exists(chunk_path) and os.path.getsize(chunk_path) > 1000:
                chunk_paths.append(chunk_path)
            else:
                # Clean up empty chunk
                try:
                    os.unlink(chunk_path)
                except:
                    pass
        
        return chunk_paths if chunk_paths else [input_path]
        
    except Exception as e:
        print(f"Error splitting audio: {e}")
        return [input_path]  # Return original on error


def transcribe_audio_chunk(file_path: str, language: str = "en") -> dict:
    """Transcribe a single audio chunk"""
    try:
        with open(file_path, "rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                file=(os.path.basename(file_path), audio_file.read()),
                model="whisper-large-v3",
                response_format="verbose_json",
                language=language
            )
        
        # Get duration
        duration_seconds = 0
        if hasattr(transcription, 'duration'):
            duration_seconds = int(transcription.duration)
        elif hasattr(transcription, 'segments') and transcription.segments:
            last_segment = transcription.segments[-1]
            if hasattr(last_segment, 'end'):
                duration_seconds = int(last_segment.end)
        
        return {
            'text': transcription.text,
            'duration': duration_seconds
        }
    except Exception as e:
        print(f"Transcription error for chunk: {e}")
        raise


# ============================================
# SELF-LEARNING PERSONALIZATION SYSTEM
# ============================================

def analyze_response_content(content: str) -> dict:
    """Analyze a response to extract learning style indicators (NO AI needed!)"""
    
    # Check for bullet points
    has_bullet_points = bool(re.search(r'^[\s]*[-•*]', content, re.MULTILINE))
    
    # Check for numbered steps
    has_numbered_steps = bool(re.search(r'^[\s]*\d+[.)]', content, re.MULTILINE))
    step_count = len(re.findall(r'^[\s]*\d+[.)]', content, re.MULTILINE))
    
    # Check for examples (keywords)
    example_patterns = [
        r'\bfor example\b', r'\bfor instance\b', r'\bsuch as\b',
        r'\blike when\b', r'\bimagine\b', r'\bconsider\b',
        r'\blet\'s say\b', r'\bsuppose\b'
    ]
    example_count = sum(len(re.findall(p, content, re.IGNORECASE)) for p in example_patterns)
    has_examples = example_count > 0
    
    # Check for analogies
    analogy_patterns = [
        r'\blike a\b', r'\bjust like\b', r'\bsimilar to\b',
        r'\bthink of it as\b', r'\bimagine a\b', r'\bpicture\b',
        r'\banalog', r'\bmetaphor'
    ]
    has_analogies = any(re.search(p, content, re.IGNORECASE) for p in analogy_patterns)
    
    # Check for definitions
    definition_patterns = [
        r'\bis defined as\b', r'\bmeans that\b', r'\brefers to\b',
        r'\bin other words\b', r'\bsimply put\b', r'\bdefinition\b'
    ]
    has_definitions = any(re.search(p, content, re.IGNORECASE) for p in definition_patterns)
    
    return {
        'response_length': len(content),
        'has_bullet_points': has_bullet_points,
        'has_numbered_steps': has_numbered_steps,
        'has_examples': has_examples,
        'has_analogies': has_analogies,
        'has_definitions': has_definitions,
        'step_count': step_count,
        'example_count': example_count
    }


def calculate_learning_profile(liked_responses: list) -> dict:
    """Calculate learning type scores from liked responses (NO AI needed!)"""
    
    if not liked_responses:
        return None
    
    n = len(liked_responses)
    
    # Aggregate metrics
    total_length = sum(r['response_length'] for r in liked_responses)
    avg_length = total_length / n
    
    bullet_count = sum(1 for r in liked_responses if r['has_bullet_points'])
    step_count = sum(1 for r in liked_responses if r['has_numbered_steps'])
    example_count = sum(1 for r in liked_responses if r['has_examples'])
    analogy_count = sum(1 for r in liked_responses if r['has_analogies'])
    definition_count = sum(1 for r in liked_responses if r['has_definitions'])
    
    total_steps = sum(r['step_count'] for r in liked_responses)
    total_examples = sum(r['example_count'] for r in liked_responses)
    
    # Calculate scores (0-100)
    
    # Visual score: analogies + spatial descriptions
    visual_score = min(100, int((analogy_count / n) * 100 + 20))
    
    # Verbal score: conversational, fewer structures
    structure_density = (bullet_count + step_count) / n
    verbal_score = min(100, int((1 - structure_density) * 60 + 20))
    
    # Reading/Writing score: definitions + structured content
    reading_writing_score = min(100, int(
        (definition_count / n) * 40 +
        (bullet_count / n) * 30 +
        (step_count / n) * 30
    ))
    
    # Theory vs Example (0=theory-first, 100=example-first)
    theory_vs_example = min(100, int((example_count / n) * 70 + (total_examples / max(1, n)) * 10))
    
    # Detail level (based on average length)
    # Short: <500, Medium: 500-1500, Long: >1500
    if avg_length < 500:
        detail_level = 25
    elif avg_length < 1000:
        detail_level = 50
    elif avg_length < 1500:
        detail_level = 70
    else:
        detail_level = 90
    
    # Structure preference (0=prose, 100=structured)
    structure_preference = min(100, int(
        (bullet_count / n) * 50 +
        (step_count / n) * 50
    ))
    
    return {
        'visual_score': visual_score,
        'verbal_score': verbal_score,
        'reading_writing_score': reading_writing_score,
        'theory_vs_example': theory_vs_example,
        'detail_level': detail_level,
        'structure_preference': structure_preference
    }


def get_learned_profile(user_id: str) -> dict:
    """Get user's learned profile"""
    try:
        result = supabase.table('learned_profiles')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()
        
        if result.data:
            return result.data[0]
        return None
    except:
        return None


def build_personalization_from_profile(profile: dict) -> str:
    """Build AI prompt instructions from learned profile"""
    
    if not profile or profile.get('total_likes', 0) < LIKES_BEFORE_ANALYSIS:
        return ""  # Not enough data yet
    
    parts = ["\n\nPERSONALIZATION (adapt your response based on learned preferences):"]
    
    # Visual vs Verbal vs Reading/Writing
    scores = {
        'visual': profile.get('visual_score', 50),
        'verbal': profile.get('verbal_score', 50),
        'reading_writing': profile.get('reading_writing_score', 50)
    }
    dominant = max(scores, key=scores.get)
    
    if dominant == 'visual' and scores['visual'] > 60:
        parts.append("- Use VISUAL descriptions and ANALOGIES. Describe things spatially. Paint mental pictures.")
    elif dominant == 'verbal' and scores['verbal'] > 60:
        parts.append("- Use CONVERSATIONAL tone. Explain as if talking to a friend. Less structure, more flow.")
    elif dominant == 'reading_writing' and scores['reading_writing'] > 60:
        parts.append("- Use STRUCTURED FORMAT with clear definitions. Lists and organized points work well.")
    
    # Theory vs Example
    theory_example = profile.get('theory_vs_example', 50)
    if theory_example < 35:
        parts.append("- Start with the CONCEPT/THEORY first, then provide examples to illustrate.")
    elif theory_example > 65:
        parts.append("- Start with CONCRETE EXAMPLES first, then explain the underlying concept.")
    
    # Detail level
    detail = profile.get('detail_level', 50)
    if detail < 35:
        parts.append("- Keep responses CONCISE and to-the-point. Avoid unnecessary detail.")
    elif detail > 65:
        parts.append("- Provide COMPREHENSIVE explanations with full context and background.")
    
    # Structure preference
    structure = profile.get('structure_preference', 50)
    if structure > 65:
        parts.append("- Use BULLET POINTS and NUMBERED STEPS. Organize information clearly.")
    elif structure < 35:
        parts.append("- Use flowing PROSE paragraphs. Avoid excessive bullet points.")
    
    if len(parts) == 1:
        return ""  # No strong preferences detected
    
    return "\n".join(parts)


async def maybe_analyze_and_update_profile(user_id: str):
    """Check if we have enough new likes to update the profile"""
    
    # Get unprocessed liked responses
    liked_result = supabase.table('liked_responses')\
        .select('*')\
        .eq('user_id', user_id)\
        .execute()
    
    if len(liked_result.data) < LIKES_BEFORE_ANALYSIS:
        return  # Not enough data yet
    
    # Get or create profile
    profile = get_learned_profile(user_id)
    
    # Calculate new scores from liked responses
    new_scores = calculate_learning_profile(liked_result.data)
    
    if not new_scores:
        return
    
    if profile:
        # Blend old and new scores (weighted average)
        old_weight = min(0.7, profile['total_likes'] / 50)  # Old data gets more weight as it grows
        new_weight = 1 - old_weight
        
        updated_scores = {
            'visual_score': int(profile['visual_score'] * old_weight + new_scores['visual_score'] * new_weight),
            'verbal_score': int(profile['verbal_score'] * old_weight + new_scores['verbal_score'] * new_weight),
            'reading_writing_score': int(profile['reading_writing_score'] * old_weight + new_scores['reading_writing_score'] * new_weight),
            'theory_vs_example': int(profile['theory_vs_example'] * old_weight + new_scores['theory_vs_example'] * new_weight),
            'detail_level': int(profile['detail_level'] * old_weight + new_scores['detail_level'] * new_weight),
            'structure_preference': int(profile['structure_preference'] * old_weight + new_scores['structure_preference'] * new_weight),
            'total_likes': profile['total_likes'] + len(liked_result.data),
            'last_analyzed_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        supabase.table('learned_profiles')\
            .update(updated_scores)\
            .eq('user_id', user_id)\
            .execute()
    else:
        # Create new profile
        new_scores['user_id'] = user_id
        new_scores['total_likes'] = len(liked_result.data)
        new_scores['last_analyzed_at'] = datetime.now().isoformat()
        
        supabase.table('learned_profiles').insert(new_scores).execute()
    
    # Delete processed liked responses to save space
    supabase.table('liked_responses')\
        .delete()\
        .eq('user_id', user_id)\
        .execute()
    
    print(f"✨ Updated learning profile for user {user_id[:8]}... ({len(liked_result.data)} likes processed)")


# ============================================
# LIKE/LEARNING ENDPOINTS
# ============================================

@app.post("/responses/like")
async def like_response(
    response_content: str = Form(...),
    question_asked: str = Form(...),
    mode: str = Form("tutor"),
    user_id: str = Depends(require_auth)
):
    """Like a response - triggers learning system"""
    try:
        # Analyze content (no AI needed!)
        analysis = analyze_response_content(response_content)
        
        # Store liked response
        supabase.table('liked_responses').insert({
            'user_id': user_id,
            'response_content': response_content[:5000],  # Truncate to save space
            'response_length': analysis['response_length'],
            'question_asked': question_asked[:500],
            'mode': mode,
            'has_bullet_points': analysis['has_bullet_points'],
            'has_numbered_steps': analysis['has_numbered_steps'],
            'has_examples': analysis['has_examples'],
            'has_analogies': analysis['has_analogies'],
            'has_definitions': analysis['has_definitions'],
            'step_count': analysis['step_count'],
            'example_count': analysis['example_count']
        }).execute()
        
        # Check if we should update profile
        await maybe_analyze_and_update_profile(user_id)
        
        # Get current like count
        likes_result = supabase.table('liked_responses')\
            .select('id', count='exact')\
            .eq('user_id', user_id)\
            .execute()
        
        profile = get_learned_profile(user_id)
        total_processed = profile['total_likes'] if profile else 0
        pending_likes = likes_result.count
        
        return {
            'success': True,
            'message': 'Response liked! Learning from your preferences.',
            'pending_likes': pending_likes,
            'total_processed': total_processed,
            'next_analysis_at': LIKES_BEFORE_ANALYSIS - pending_likes if pending_likes < LIKES_BEFORE_ANALYSIS else 0
        }
        
    except Exception as e:
        print(f"Like error: {e}")
        raise HTTPException(500, f"Failed to like response: {str(e)}")


@app.get("/learning/status")
async def get_learning_status(user_id: str = Depends(require_auth)):
    """Get learning system status (minimal info - no details shown)"""
    try:
        # Count pending likes
        likes_result = supabase.table('liked_responses')\
            .select('id', count='exact')\
            .eq('user_id', user_id)\
            .execute()
        
        profile = get_learned_profile(user_id)
        
        if profile and profile['total_likes'] >= LIKES_BEFORE_ANALYSIS:
            status = "active"
            message = "AI is personalized to your learning style"
        elif profile or likes_result.count > 0:
            status = "learning"
            remaining = LIKES_BEFORE_ANALYSIS - likes_result.count
            message = f"Like {remaining} more responses to activate personalization"
        else:
            status = "inactive"
            message = "Like responses you find helpful to activate personalization"
        
        return {
            'status': status,
            'message': message,
            'total_likes': (profile['total_likes'] if profile else 0) + likes_result.count
        }
        
    except Exception as e:
        return {'status': 'inactive', 'message': 'Like responses to activate personalization', 'total_likes': 0}


@app.post("/learning/reset")
async def reset_learning(user_id: str = Depends(require_auth)):
    """Reset all learned preferences"""
    try:
        # Delete learned profile
        supabase.table('learned_profiles')\
            .delete()\
            .eq('user_id', user_id)\
            .execute()
        
        # Delete pending likes
        supabase.table('liked_responses')\
            .delete()\
            .eq('user_id', user_id)\
            .execute()
        
        return {
            'success': True,
            'message': 'Learning reset. AI will start fresh with your preferences.'
        }
        
    except Exception as e:
        raise HTTPException(500, f"Failed to reset: {str(e)}")


# ============================================
# AUTH ENDPOINTS
# ============================================

@app.post("/auth/signup")
async def signup(
    email: str = Form(...),
    password: str = Form(...),
    name: str = Form("")
):
    """Create a new user account"""
    try:
        result = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"name": name}}
        })
        
        if result.user:
            return {
                "success": True,
                "user_id": result.user.id,
                "email": result.user.email,
                "message": "Account created!"
            }
        else:
            raise HTTPException(400, "Signup failed")
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(400, f"Signup failed: {str(e)}")


@app.post("/auth/login")
async def login(
    email: str = Form(...),
    password: str = Form(...)
):
    """Log in and get access token"""
    try:
        result = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        if result.user and result.session:
            return {
                "success": True,
                "user_id": result.user.id,
                "email": result.user.email,
                "name": result.user.user_metadata.get("name", ""),
                "access_token": result.session.access_token,
                "refresh_token": result.session.refresh_token
            }
        else:
            raise HTTPException(401, "Invalid credentials")
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(401, f"Login failed: {str(e)}")


@app.post("/auth/logout")
async def logout(user_id: str = Depends(require_auth)):
    """Log out"""
    try:
        supabase.auth.sign_out()
        return {"success": True, "message": "Logged out"}
    except:
        return {"success": True, "message": "Logged out"}


@app.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    """Get current user info"""
    user_id = await get_current_user(authorization)
    
    if not user_id:
        return {"authenticated": False}
    
    classes_result = supabase.table('class_members')\
        .select('class_id, role, classes(id, name, class_code)')\
        .eq('user_id', user_id)\
        .execute()
    
    return {
        "authenticated": True,
        "user_id": user_id,
        "classes": classes_result.data
    }


# ============================================
# CLASS MANAGEMENT
# ============================================

@app.post("/classes")
async def create_class(
    name: str = Form(...),
    description: str = Form(""),
    user_id: str = Depends(require_auth)
):
    """Create a new class"""
    try:
        class_code = generate_class_code()
        
        while True:
            existing = supabase.table('classes').select('id').eq('class_code', class_code).execute()
            if not existing.data:
                break
            class_code = generate_class_code()
        
        class_result = supabase.table('classes').insert({
            'name': name,
            'description': description,
            'class_code': class_code,
            'created_by': user_id
        }).execute()
        
        class_data = class_result.data[0]
        
        supabase.table('class_members').insert({
            'user_id': user_id,
            'class_id': class_data['id'],
            'role': 'teacher'
        }).execute()
        
        return {
            "success": True,
            "class_id": class_data['id'],
            "class_code": class_code,
            "name": name
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to create class: {str(e)}")


@app.post("/classes/join")
async def join_class(
    class_code: str = Form(...),
    display_name: str = Form(""),
    user_id: str = Depends(require_auth)
):
    """Join a class"""
    try:
        class_result = supabase.table('classes')\
            .select('id, name')\
            .eq('class_code', class_code.upper())\
            .execute()
        
        if not class_result.data:
            raise HTTPException(404, "Invalid class code")
        
        class_data = class_result.data[0]
        
        existing = supabase.table('class_members')\
            .select('id')\
            .eq('user_id', user_id)\
            .eq('class_id', class_data['id'])\
            .execute()
        
        if existing.data:
            return {"success": True, "already_member": True, "class_id": class_data['id']}
        
        supabase.table('class_members').insert({
            'user_id': user_id,
            'class_id': class_data['id'],
            'role': 'student',
            'display_name': display_name or None
        }).execute()
        
        return {"success": True, "class_id": class_data['id'], "class_name": class_data['name']}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to join class: {str(e)}")


@app.get("/classes")
async def list_my_classes(user_id: str = Depends(require_auth)):
    """List user's classes"""
    try:
        result = supabase.table('class_members')\
            .select('role, display_name, joined_at, classes(id, name, description, class_code, created_at)')\
            .eq('user_id', user_id)\
            .execute()
        
        classes = []
        for membership in result.data:
            class_data = membership['classes']
            class_data['role'] = membership['role']
            
            subjects_count = supabase.table('subjects')\
                .select('id', count='exact')\
                .eq('class_id', class_data['id'])\
                .execute()
            class_data['subject_count'] = subjects_count.count
            
            classes.append(class_data)
        
        return classes
    except Exception as e:
        raise HTTPException(500, f"Failed to list classes: {str(e)}")


@app.get("/classes/{class_id}")
async def get_class(class_id: str, user_id: str = Depends(require_auth)):
    """Get class details"""
    if not await check_class_membership(user_id, class_id):
        raise HTTPException(403, "Not a member of this class")
    
    result = supabase.table('classes').select('*').eq('id', class_id).execute()
    if not result.data:
        raise HTTPException(404, "Class not found")
    return result.data[0]


@app.delete("/classes/{class_id}/leave")
async def leave_class(class_id: str, user_id: str = Depends(require_auth)):
    """Leave a class"""
    supabase.table('class_members').delete().eq('user_id', user_id).eq('class_id', class_id).execute()
    return {"success": True}


# ============================================
# SUBJECTS
# ============================================

@app.post("/classes/{class_id}/subjects")
async def create_subject_in_class(
    class_id: str,
    name: str = Form(...),
    description: str = Form(""),
    user_id: str = Depends(require_auth)
):
    """Create a subject in a class"""
    if not await check_class_membership(user_id, class_id):
        raise HTTPException(403, "Not a member of this class")
    
    result = supabase.table('subjects').insert({
        'name': name, 'description': description, 'class_id': class_id
    }).execute()
    return result.data[0]


@app.get("/classes/{class_id}/subjects")
async def list_class_subjects(class_id: str, user_id: str = Depends(require_auth)):
    """List subjects in a class"""
    if not await check_class_membership(user_id, class_id):
        raise HTTPException(403, "Not a member of this class")
    
    subjects = supabase.table('subjects').select('*').eq('class_id', class_id).order('name').execute().data
    
    for subject in subjects:
        topics = supabase.table('topics').select('id', count='exact').eq('subject_id', subject['id']).execute()
        subject['topic_count'] = topics.count
    
    return subjects


@app.get("/classes/{class_id}/lectures")
async def list_class_lectures(class_id: str, user_id: str = Depends(require_auth)):
    """List all lectures in a class (through subjects -> topics -> lectures)"""
    if not await check_class_membership(user_id, class_id):
        raise HTTPException(403, "Not a member of this class")
    
    # Get all subjects for this class
    subjects = supabase.table('subjects').select('id').eq('class_id', class_id).execute()
    if not subjects.data:
        return []
    
    subject_ids = [s['id'] for s in subjects.data]
    
    # Get all topics for these subjects
    topics = supabase.table('topics').select('id').in_('subject_id', subject_ids).execute()
    if not topics.data:
        return []
    
    topic_ids = [t['id'] for t in topics.data]
    
    # Get all lectures for these topics
    lectures = supabase.table('lectures')\
        .select('id, title, recording_date, audio_duration_seconds, created_at, topic_id')\
        .in_('topic_id', topic_ids)\
        .order('created_at', desc=True)\
        .execute()
    
    return lectures.data


@app.post("/subjects")
async def create_subject(
    name: str = Form(...),
    description: str = Form(""),
    class_id: str = Form(None)
):
    """Create a subject (legacy)"""
    data = {'name': name, 'description': description}
    if class_id:
        data['class_id'] = class_id
    result = supabase.table('subjects').insert(data).execute()
    return result.data[0]


@app.get("/subjects")
async def list_subjects(class_id: str = None):
    """List subjects"""
    query = supabase.table('subjects').select('*')
    if class_id:
        query = query.eq('class_id', class_id)
    
    subjects = query.order('name').execute().data
    
    for subject in subjects:
        topics = supabase.table('topics').select('id', count='exact').eq('subject_id', subject['id']).execute()
        subject['topic_count'] = topics.count
    
    return subjects


# ============================================
# TOPICS
# ============================================

@app.post("/subjects/{subject_id}/topics")
async def create_topic(subject_id: str, name: str = Form(...), description: str = Form("")):
    """Create a topic"""
    result = supabase.table('topics').insert({
        'subject_id': subject_id, 'name': name, 'description': description
    }).execute()
    return result.data[0]


@app.get("/subjects/{subject_id}/topics")
async def list_topics(subject_id: str):
    """List topics in a subject"""
    topics = supabase.table('topics').select('*').eq('subject_id', subject_id).order('name').execute().data
    
    for topic in topics:
        lectures = supabase.table('lectures').select('id', count='exact').eq('topic_id', topic['id']).execute()
        topic['lecture_count'] = lectures.count
    
    return topics


@app.get("/topics/{topic_id}/lectures")
async def list_topic_lectures(topic_id: str):
    """List lectures in a topic"""
    return supabase.table('lectures')\
        .select('id, title, recording_date, audio_duration_seconds, created_at')\
        .eq('topic_id', topic_id)\
        .order('created_at', desc=False)\
        .execute().data


@app.get("/topics/{topic_id}")
async def get_topic(topic_id: str):
    """Get a single topic"""
    result = supabase.table('topics').select('*').eq('id', topic_id).execute()
    if not result.data:
        raise HTTPException(404, "Topic not found")
    return result.data[0]


@app.get("/subjects/{subject_id}")
async def get_subject(subject_id: str):
    """Get a single subject"""
    result = supabase.table('subjects').select('*').eq('id', subject_id).execute()
    if not result.data:
        raise HTTPException(404, "Subject not found")
    return result.data[0]


# ============================================
# LECTURES
# ============================================

@app.get("/lectures")
async def list_lectures():
    """List all lectures"""
    return supabase.table('lectures')\
        .select('id, title, recording_date, audio_duration_seconds, created_at')\
        .order('created_at', desc=True)\
        .execute().data


@app.get("/lectures/{lecture_id}")
async def get_lecture(lecture_id: str):
    """Get a lecture"""
    result = supabase.table('lectures').select('*').eq('id', lecture_id).execute()
    if not result.data:
        raise HTTPException(404, "Lecture not found")
    return result.data[0]


@app.post("/transcribe")
async def transcribe_lecture(
    audio: UploadFile = File(...),
    title: str = Form("Untitled Lecture"),
    topic_id: str = Form(None),
    language: str = Form("en")
):
    """
    Transcribe audio using Groq's Whisper API.
    Automatically splits files >25MB into chunks.
    """
    
    # Validate file type
    valid_extensions = ('.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.flac', '.webm')
    if not audio.filename.lower().endswith(valid_extensions):
        raise HTTPException(400, f"Invalid format. Supported: {', '.join(valid_extensions)}")
    
    # Validate language
    valid_languages = ['en', 'it', 'de', 'es', 'fr']
    if language not in valid_languages:
        language = 'en'
    
    temp_files = []
    
    try:
        # Read file and check size
        audio_content = await audio.read()
        file_size_mb = len(audio_content) / (1024 * 1024)
        
        # Save to temp file
        suffix = os.path.splitext(audio.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_content)
            tmp_path = tmp.name
            temp_files.append(tmp_path)
        
        all_transcripts = []
        total_duration = 0
        
        # Check if we need to split
        if file_size_mb > MAX_AUDIO_SIZE_MB:
            print(f"📦 File is {file_size_mb:.1f}MB, splitting into chunks...")
            
            # Split the audio file
            chunk_paths = split_audio_file(tmp_path, CHUNK_DURATION_MINUTES * 60)
            temp_files.extend([p for p in chunk_paths if p != tmp_path])
            
            print(f"📦 Split into {len(chunk_paths)} chunks")
            
            # Transcribe each chunk
            for i, chunk_path in enumerate(chunk_paths):
                print(f"🎤 Transcribing chunk {i+1}/{len(chunk_paths)}...")
                result = transcribe_audio_chunk(chunk_path, language)
                all_transcripts.append(result['text'])
                total_duration += result['duration']
            
            raw_transcript = "\n\n".join(all_transcripts)
        else:
            # Single file transcription
            result = transcribe_audio_chunk(tmp_path, language)
            raw_transcript = result['text']
            total_duration = result['duration']
        
        # Clean transcript with LLaMA
        cleaned_transcript = clean_transcript_with_groq(raw_transcript, title)
        
        # Save to database
        lecture_data = {
            'title': title,
            'raw_transcript': raw_transcript,
            'cleaned_transcript': cleaned_transcript,
            'audio_duration_seconds': total_duration,
            'recording_date': datetime.now().isoformat()
        }
        if topic_id:
            lecture_data['topic_id'] = topic_id
        
        result = supabase.table('lectures').insert(lecture_data).execute()
        
        # Get language name for response
        language_names = {
            'en': 'English', 'it': 'Italian', 'de': 'German', 
            'es': 'Spanish', 'fr': 'French'
        }
        
        return {
            'lecture_id': result.data[0]['id'],
            'title': title,
            'duration_seconds': total_duration,
            'raw_length': len(raw_transcript),
            'cleaned_length': len(cleaned_transcript),
            'cleaned_preview': cleaned_transcript[:500],
            'language': language,
            'language_name': language_names.get(language, 'Unknown'),
            'chunks_processed': len(all_transcripts) if file_size_mb > MAX_AUDIO_SIZE_MB else 1,
            'status': 'success'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")
    finally:
        # Clean up all temp files
        for path in temp_files:
            try:
                os.unlink(path)
            except:
                pass


@app.post("/transcribe-multi")
async def transcribe_multiple_files(
    audio_files: List[UploadFile] = File(...),
    title: str = Form("Untitled Lecture"),
    topic_id: str = Form(None),
    language: str = Form("en")
):
    """
    Transcribe multiple audio files and combine into one lecture.
    Useful for lectures recorded in multiple parts (e.g., before/after break).
    """
    
    valid_extensions = ('.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.flac', '.webm')
    valid_languages = ['en', 'it', 'de', 'es', 'fr']
    
    if language not in valid_languages:
        language = 'en'
    
    if not audio_files:
        raise HTTPException(400, "No audio files provided")
    
    if len(audio_files) > 10:
        raise HTTPException(400, "Maximum 10 files allowed per upload")
    
    # Validate all files first
    for audio in audio_files:
        if not audio.filename.lower().endswith(valid_extensions):
            raise HTTPException(400, f"Invalid format for {audio.filename}. Supported: {', '.join(valid_extensions)}")
    
    temp_files = []
    all_transcripts = []
    total_duration = 0
    
    try:
        for i, audio in enumerate(audio_files, 1):
            print(f"📁 Processing file {i}/{len(audio_files)}: {audio.filename}")
            
            # Read and save to temp file
            audio_content = await audio.read()
            file_size_mb = len(audio_content) / (1024 * 1024)
            
            suffix = os.path.splitext(audio.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(audio_content)
                tmp_path = tmp.name
                temp_files.append(tmp_path)
            
            # Check if this file needs splitting
            if file_size_mb > MAX_AUDIO_SIZE_MB:
                print(f"  📦 File is {file_size_mb:.1f}MB, splitting...")
                chunk_paths = split_audio_file(tmp_path, CHUNK_DURATION_MINUTES * 60)
                temp_files.extend([p for p in chunk_paths if p != tmp_path])
                
                for j, chunk_path in enumerate(chunk_paths):
                    print(f"  🎤 Transcribing chunk {j+1}/{len(chunk_paths)}...")
                    result = transcribe_audio_chunk(chunk_path, language)
                    all_transcripts.append(result['text'])
                    total_duration += result['duration']
            else:
                print(f"  🎤 Transcribing...")
                result = transcribe_audio_chunk(tmp_path, language)
                all_transcripts.append(result['text'])
                total_duration += result['duration']
        
        # Combine all transcripts with part markers
        if len(audio_files) > 1:
            raw_transcript = ""
            transcript_idx = 0
            for i, audio in enumerate(audio_files, 1):
                raw_transcript += f"\n\n--- Part {i}: {audio.filename} ---\n\n"
                # Add transcripts for this file (may be multiple if split)
                raw_transcript += all_transcripts[transcript_idx]
                transcript_idx += 1
        else:
            raw_transcript = "\n\n".join(all_transcripts)
        
        # Clean transcript
        cleaned_transcript = clean_transcript_with_groq(raw_transcript, title)
        
        # Save to database
        lecture_data = {
            'title': title,
            'raw_transcript': raw_transcript,
            'cleaned_transcript': cleaned_transcript,
            'audio_duration_seconds': total_duration,
            'recording_date': datetime.now().isoformat()
        }
        if topic_id:
            lecture_data['topic_id'] = topic_id
        
        result = supabase.table('lectures').insert(lecture_data).execute()
        
        language_names = {
            'en': 'English', 'it': 'Italian', 'de': 'German', 
            'es': 'Spanish', 'fr': 'French'
        }
        
        return {
            'lecture_id': result.data[0]['id'],
            'title': title,
            'duration_seconds': total_duration,
            'raw_length': len(raw_transcript),
            'cleaned_length': len(cleaned_transcript),
            'cleaned_preview': cleaned_transcript[:500],
            'language': language,
            'language_name': language_names.get(language, 'Unknown'),
            'files_processed': len(audio_files),
            'total_chunks': len(all_transcripts),
            'status': 'success'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Multi-file transcription failed: {str(e)}")
    finally:
        # Clean up all temp files
        for path in temp_files:
            try:
                os.unlink(path)
            except:
                pass


def clean_transcript_with_groq(raw_text: str, subject_context: str) -> str:
    """Clean transcript with Groq"""
    prompt = f"""Clean this transcript. Fix errors, remove filler words, fix punctuation.
DO NOT summarize. Keep original meaning.

Subject: {subject_context}

Transcript:
{raw_text}

Return ONLY cleaned transcript:"""

    try:
        response = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=4096
        )
        return response.choices[0].message.content.strip()
    except:
        return raw_text


@app.post("/lectures/{lecture_id}/upload-pdf")
async def upload_pdf(lecture_id: str, pdf: UploadFile = File(...)):
    """Upload PDF to lecture"""
    if not pdf.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Must be PDF")
    
    pdf_content = await pdf.read()
    pdf_reader = PdfReader(io.BytesIO(pdf_content))
    
    extracted_text = ""
    for i, page in enumerate(pdf_reader.pages):
        extracted_text += f"\n--- Page {i+1} ---\n{page.extract_text()}"
    
    result = supabase.table('materials').insert({
        'lecture_id': lecture_id,
        'file_name': pdf.filename,
        'file_type': 'pdf',
        'extracted_text': extracted_text
    }).execute()
    
    return {'material_id': result.data[0]['id'], 'pages': len(pdf_reader.pages), 'status': 'success'}


@app.get("/lectures/{lecture_id}/materials")
async def get_lecture_materials(lecture_id: str):
    """Get materials for a lecture"""
    return supabase.table('materials')\
        .select('id, file_name, file_type, created_at')\
        .eq('lecture_id', lecture_id)\
        .execute().data


@app.put("/lectures/{lecture_id}/topic")
async def assign_lecture_to_topic(lecture_id: str, topic_id: str = Form(...)):
    """Assign lecture to topic"""
    supabase.table('lectures').update({'topic_id': topic_id}).eq('id', lecture_id).execute()
    return {'success': True}


# ============================================
# TOPIC MATERIALS (PDFs attached to topics)
# ============================================

@app.post("/topics/{topic_id}/upload-pdf")
async def upload_topic_pdf(topic_id: str, pdf: UploadFile = File(...)):
    """Upload PDF to a topic (shared across all lectures in topic)"""
    if not pdf.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Must be PDF")
    
    # Verify topic exists
    topic = supabase.table('topics').select('id').eq('id', topic_id).execute()
    if not topic.data:
        raise HTTPException(404, "Topic not found")
    
    pdf_content = await pdf.read()
    pdf_reader = PdfReader(io.BytesIO(pdf_content))
    
    extracted_text = ""
    for i, page in enumerate(pdf_reader.pages):
        extracted_text += f"\n--- Page {i+1} ---\n{page.extract_text()}"
    
    result = supabase.table('materials').insert({
        'topic_id': topic_id,
        'file_name': pdf.filename,
        'file_type': 'pdf',
        'extracted_text': extracted_text
    }).execute()
    
    return {
        'material_id': result.data[0]['id'],
        'pages': len(pdf_reader.pages),
        'characters': len(extracted_text),
        'status': 'success'
    }


@app.get("/topics/{topic_id}/materials")
async def get_topic_materials(topic_id: str):
    """Get materials attached directly to a topic"""
    return supabase.table('materials')\
        .select('id, file_name, file_type, created_at')\
        .eq('topic_id', topic_id)\
        .execute().data


@app.delete("/materials/{material_id}")
async def delete_material(material_id: str):
    """Delete a material (PDF)"""
    supabase.table('materials').delete().eq('id', material_id).execute()
    return {'success': True}


# ============================================
# DELETE ENDPOINTS
# ============================================

@app.delete("/lectures/{lecture_id}")
async def delete_lecture(lecture_id: str):
    supabase.table('materials').delete().eq('lecture_id', lecture_id).execute()
    supabase.table('lectures').delete().eq('id', lecture_id).execute()
    return {'success': True}


@app.delete("/topics/{topic_id}")
async def delete_topic(topic_id: str):
    lectures = supabase.table('lectures').select('id').eq('topic_id', topic_id).execute().data
    lecture_ids = [l['id'] for l in lectures]
    
    # Delete lecture-level materials
    if lecture_ids:
        supabase.table('materials').delete().in_('lecture_id', lecture_ids).execute()
    
    # Delete topic-level materials
    supabase.table('materials').delete().eq('topic_id', topic_id).execute()
    
    supabase.table('lectures').delete().eq('topic_id', topic_id).execute()
    supabase.table('topics').delete().eq('id', topic_id).execute()
    
    return {'success': True, 'deleted_lectures': len(lecture_ids)}


@app.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    topics = supabase.table('topics').select('id').eq('subject_id', subject_id).execute().data
    topic_ids = [t['id'] for t in topics]
    
    deleted_lectures = 0
    
    if topic_ids:
        lectures = supabase.table('lectures').select('id').in_('topic_id', topic_ids).execute().data
        lecture_ids = [l['id'] for l in lectures]
        deleted_lectures = len(lecture_ids)
        
        # Delete lecture-level materials
        if lecture_ids:
            supabase.table('materials').delete().in_('lecture_id', lecture_ids).execute()
        
        # Delete topic-level materials
        supabase.table('materials').delete().in_('topic_id', topic_ids).execute()
        
        supabase.table('lectures').delete().in_('topic_id', topic_ids).execute()
    
    supabase.table('topics').delete().eq('subject_id', subject_id).execute()
    supabase.table('subjects').delete().eq('id', subject_id).execute()
    
    return {'success': True, 'deleted_topics': len(topic_ids), 'deleted_lectures': deleted_lectures}


# ============================================
# AI TUTORING (WITH SELF-LEARNING PERSONALIZATION & TABLE SUPPORT)
# ============================================

# Base formatting instructions for all AI modes
FORMATTING_INSTRUCTIONS = """
FORMATTING GUIDELINES:
- Use **bold** for key terms and important concepts
- Use markdown tables when comparing items, showing data, or listing properties:
  | Column 1 | Column 2 | Column 3 |
  |----------|----------|----------|
  | Data 1   | Data 2   | Data 3   |
- Use bullet points for lists of items
- Use numbered lists for sequential steps or processes
- Use code blocks with ``` for formulas, code, or technical notation
- Keep formatting clean and readable
"""


@app.post("/lectures/{lecture_id}/ask")
async def ask_lecture_question(
    lecture_id: str,
    question: str = Form(...),
    mode: str = Form("tutor"),
    chat_history: str = Form("[]"),
    authorization: Optional[str] = Header(None)
):
    """AI study assistant (personalized)"""
    
    user_id = await get_current_user(authorization)
    personalization = ""
    if user_id:
        profile = get_learned_profile(user_id)
        personalization = build_personalization_from_profile(profile)
    
    try:
        history = json.loads(chat_history)[-10:]
    except:
        history = []
    
    lecture = supabase.table('lectures')\
        .select('title, cleaned_transcript')\
        .eq('id', lecture_id).execute()
    
    if not lecture.data:
        raise HTTPException(404, "Lecture not found")
    
    materials = supabase.table('materials')\
        .select('file_name, extracted_text')\
        .eq('lecture_id', lecture_id).execute()
    
    context = f"LECTURE: {lecture.data[0]['title']}\n\nTRANSCRIPT:\n{lecture.data[0]['cleaned_transcript']}"
    
    if materials.data:
        context += "\n\nMATERIALS:\n"
        for m in materials.data:
            context += f"\n--- {m['file_name']} ---\n{m['extracted_text']}"
    
    if len(context) > MAX_CONTEXT_CHARS:
        raise HTTPException(400, "Content too large")
    
    if mode == "tutor":
        response = await tutor_mode(context, question, history, personalization)
    elif mode == "practice":
        response = await practice_mode(context, question, history, personalization)
    elif mode == "exam":
        response = await exam_mode(context, question, history, personalization)
    else:
        raise HTTPException(400, "Invalid mode")
    
    return {'question': question, 'mode': mode, 'response': response}


@app.post("/topics/{topic_id}/ask")
async def ask_topic_question(
    topic_id: str,
    question: str = Form(...),
    mode: str = Form("tutor"),
    chat_history: str = Form("[]"),
    authorization: Optional[str] = Header(None)
):
    """AI study assistant for topic (personalized)"""
    
    user_id = await get_current_user(authorization)
    personalization = ""
    if user_id:
        profile = get_learned_profile(user_id)
        personalization = build_personalization_from_profile(profile)
    
    try:
        history = json.loads(chat_history)[-10:]
    except:
        history = []
    
    lectures = supabase.table('lectures')\
        .select('id, title, cleaned_transcript')\
        .eq('topic_id', topic_id).execute()
    
    if not lectures.data:
        raise HTTPException(404, "No lectures in this topic")
    
    # Get lecture-level materials
    lecture_ids = [l['id'] for l in lectures.data]
    lecture_materials = supabase.table('materials')\
        .select('file_name, extracted_text')\
        .in_('lecture_id', lecture_ids).execute()
    
    # Get topic-level materials (PDFs attached directly to topic)
    topic_materials = supabase.table('materials')\
        .select('file_name, extracted_text')\
        .eq('topic_id', topic_id).execute()
    
    context = f"TOPIC ({len(lectures.data)} lectures):\n"
    for i, lec in enumerate(lectures.data, 1):
        context += f"\n--- Lecture {i}: {lec['title']} ---\n{lec['cleaned_transcript']}"
    
    # Add topic-level materials first (shared resources)
    if topic_materials.data:
        context += "\n\nTOPIC MATERIALS (shared across all lectures):\n"
        for m in topic_materials.data:
            context += f"\n--- {m['file_name']} ---\n{m['extracted_text']}"
    
    # Add lecture-specific materials
    if lecture_materials.data:
        context += "\n\nLECTURE MATERIALS:\n"
        for m in lecture_materials.data:
            context += f"\n--- {m['file_name']} ---\n{m['extracted_text']}"
    
    if len(context) > MAX_CONTEXT_CHARS:
        raise HTTPException(400, "Topic too large")
    
    if mode == "tutor":
        response = await tutor_mode(context, question, history, personalization)
    elif mode == "practice":
        response = await practice_mode(context, question, history, personalization)
    elif mode == "exam":
        response = await exam_mode(context, question, history, personalization)
    else:
        raise HTTPException(400, "Invalid mode")
    
    return {'question': question, 'mode': mode, 'response': response}


@app.post("/subjects/{subject_id}/ask")
async def ask_subject_question(
    subject_id: str,
    question: str = Form(...),
    chat_history: str = Form("[]"),
    authorization: Optional[str] = Header(None)
):
    """AI tutor for subject (personalized)"""
    
    user_id = await get_current_user(authorization)
    personalization = ""
    if user_id:
        profile = get_learned_profile(user_id)
        personalization = build_personalization_from_profile(profile)
    
    try:
        history = json.loads(chat_history)[-10:]
    except:
        history = []
    
    topics = supabase.table('topics').select('id').eq('subject_id', subject_id).execute()
    if not topics.data:
        raise HTTPException(404, "No topics")
    
    topic_ids = [t['id'] for t in topics.data]
    lectures = supabase.table('lectures')\
        .select('title, cleaned_transcript')\
        .in_('topic_id', topic_ids).execute()
    
    if not lectures.data:
        raise HTTPException(404, "No lectures")
    
    context = f"SUBJECT ({len(lectures.data)} lectures):\n"
    for i, lec in enumerate(lectures.data, 1):
        context += f"\n--- Lecture {i}: {lec['title']} ---\n{lec['cleaned_transcript'][:5000]}"
    
    if len(context) > MAX_CONTEXT_CHARS:
        raise HTTPException(400, "Subject too large")
    
    response = await tutor_mode(context, question, history, personalization)
    return {'question': question, 'mode': 'tutor', 'response': response}


async def tutor_mode(context: str, question: str, history: list = None, personalization: str = "") -> str:
    """Answer questions (personalized with table support)"""
    
    system = f"""You are a helpful tutor. Answer using ONLY the provided content.
Be encouraging. If something isn't covered, say so.

{FORMATTING_INSTRUCTIONS}

When answering questions that involve:
- Comparisons → Use a TABLE to show differences/similarities
- Multiple items with properties → Use a TABLE
- Processes or sequences → Use NUMBERED LISTS
- Key concepts → Use **bold** for important terms

{personalization}

CONTENT:
{context}"""
    
    messages = [{"role": "system", "content": system}]
    if history:
        for msg in history:
            if msg.get("role") in ["user", "assistant"]:
                messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})
    
    response = groq_client.chat.completions.create(
        messages=messages,
        model="llama-3.3-70b-versatile",
        temperature=0.7,
        max_tokens=2000
    )
    return response.choices[0].message.content.strip()


async def practice_mode(context: str, question: str, history: list = None, personalization: str = "") -> str:
    """Generate practice problems (personalized with table support)"""
    
    system = f"""Create practice problems based on this content.
Generate 5-10 problems with varying difficulty.
Include ANSWERS section at end.

{FORMATTING_INSTRUCTIONS}

Format problems clearly:
- Number each problem
- For multiple choice, use a TABLE to show options:
  | Option | Answer |
  |--------|--------|
  | A      | ...    |
- Group answers in a clear ANSWERS section at the end

{personalization}

CONTENT:
{context}"""
    
    messages = [{"role": "system", "content": system}]
    if history:
        for msg in history:
            if msg.get("role") in ["user", "assistant"]:
                messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})
    
    response = groq_client.chat.completions.create(
        messages=messages,
        model="llama-3.3-70b-versatile",
        temperature=0.8,
        max_tokens=3000
    )
    return response.choices[0].message.content.strip()


async def exam_mode(context: str, question: str, history: list = None, personalization: str = "") -> str:
    """Generate mock exam (personalized with table support)"""
    
    system = f"""Create a mock exam based on this content.
Include 15-25 questions: multiple choice, true/false, short answer.
Include ANSWER KEY at end.

{FORMATTING_INSTRUCTIONS}

Format the exam professionally:
- Use clear section headers
- Number all questions
- For multiple choice, format options clearly (A, B, C, D)
- Use a TABLE for the answer key:
  | Question | Answer | Explanation |
  |----------|--------|-------------|
  | 1        | B      | Brief why   |

{personalization}

CONTENT:
{context}"""
    
    messages = [{"role": "system", "content": system}]
    if history:
        for msg in history:
            if msg.get("role") in ["user", "assistant"]:
                messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})
    
    response = groq_client.chat.completions.create(
        messages=messages,
        model="llama-3.3-70b-versatile",
        temperature=0.7,
        max_tokens=4000
    )
    return response.choices[0].message.content.strip()


# ============================================
# QUIZ GENERATION
# ============================================

@app.post("/topics/{topic_id}/quiz")
async def generate_topic_quiz(topic_id: str, num_questions: int = Form(20)):
    lectures = supabase.table('lectures')\
        .select('title, cleaned_transcript')\
        .eq('topic_id', topic_id).execute()
    
    if not lectures.data:
        raise HTTPException(404, "No lectures")
    
    content = "TOPIC:\n"
    for i, lec in enumerate(lectures.data, 1):
        content += f"\n--- {lec['title']} ---\n{lec['cleaned_transcript']}"
    
    quiz = await generate_quiz(content[:15000], num_questions)
    return {'topic_id': topic_id, 'quiz': quiz}


@app.post("/subjects/{subject_id}/quiz")
async def generate_subject_quiz(subject_id: str, num_questions: int = Form(30)):
    topics = supabase.table('topics').select('id').eq('subject_id', subject_id).execute()
    if not topics.data:
        raise HTTPException(404, "No topics")
    
    topic_ids = [t['id'] for t in topics.data]
    lectures = supabase.table('lectures')\
        .select('title, cleaned_transcript')\
        .in_('topic_id', topic_ids).execute()
    
    if not lectures.data:
        raise HTTPException(404, "No lectures")
    
    content = "SUBJECT:\n"
    for lec in lectures.data:
        content += f"\n--- {lec['title']} ---\n{lec['cleaned_transcript']}"
    
    quiz = await generate_quiz(content[:15000], num_questions)
    return {'subject_id': subject_id, 'quiz': quiz}


async def generate_quiz(content: str, num_questions: int) -> str:
    prompt = f"""Create {num_questions} quiz questions. Include multiple choice, true/false, short answer.

{FORMATTING_INSTRUCTIONS}

Use a TABLE for the answer key at the end:
| Q# | Answer | Brief Explanation |
|----|--------|-------------------|

CONTENT:
{content}"""
    
    response = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        temperature=0.7,
        max_tokens=4096
    )
    return response.choices[0].message.content.strip()


@app.get("/")
async def root():
    return {
        "status": "running",
        "transcription": "groq-whisper-large-v3",
        "ai_model": "llama-3.3-70b-versatile",
        "auth": "enabled",
        "self_learning": "enabled",
        "max_audio_mb": MAX_AUDIO_SIZE_MB,
        "auto_split": "enabled",
        "multi_file_upload": "enabled",
        "table_formatting": "enabled"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for deployment platforms"""
    return {"status": "healthy"}