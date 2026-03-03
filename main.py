import os
import yfinance as yf
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from io import BytesIO
from PIL import Image

# Configure Gemini API Key (Set GEMINI_API_KEY in Render Environment Variables!)
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Render 대시보드 → Environment에서 키를 추가해주세요.")
client = genai.Client(api_key=api_key)

app = FastAPI()

# Enable CORS for the local HTML frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import json

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

SYSTEM_PROMPT = """
당신은 월스트리트 상위 1% 자산 운용사이자 거시경제 수석 전략가인 'AI 주식 비서'입니다.
사용자와 자연스럽게 대화하며, 주식 분석, 포트폴리오 진단, 실시간 뉴스 추천 등 금융 관련 모든 조언을 빠르고 냉철하게 제공합니다.
사용자의 이전 대화(포트폴리오 내용 등)를 기억하고, 뉴스나 시황을 설명할 때 그 포트폴리오에 맞춰 어떻게 대응해야 할지 구체적으로 조언하세요.
답변은 읽기 쉽도록 마크다운을 적극 활용하고, 직설적이고 통찰력 있는 전문가의 어조를 유지하세요.
"""

@app.post("/api/chat")
async def chat_endpoint(
    message: str = Form(...),
    history: str = Form("[]"), # JSON array of {role, text}
    model_type: str = Form("gemini-2.5-flash"), # 플래시/프로 모델 선택 파라미터 추가
    file: UploadFile = File(None)
):
    try:
        past_messages = json.loads(history)
    except Exception:
        past_messages = []

    # Build contents array for GenAI SDK
    contents = []
    
    # 1. System Prompt as first user message + model ok
    contents.append(types.Content(role="user", parts=[types.Part.from_text(SYSTEM_PROMPT)]))
    contents.append(types.Content(role="model", parts=[types.Part.from_text("알겠습니다. 최고의 금융 인사이트를 제공하겠습니다.")]))

    # 2. Append history
    for msg in past_messages:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(msg.get("text", ""))]))

    # 3. Append current message with optional image
    parts = []
    if file:
        contents_bytes = await file.read()
        image = Image.open(BytesIO(contents_bytes))
        parts.append(image)
        # If no message provided but image uploaded, set default prompt
        if not message or message.strip() == "":
            message = "내 포트폴리오 스크린샷이야. 1. 종목, 비중 파악 / 2. 약점(리스크) 팩트폭행 / 3. 리밸런싱 액션 플랜을 제안해줘."
            
    parts.append(types.Part.from_text(message))
    contents.append(types.Content(role="user", parts=parts))

    try:
        response = client.models.generate_content(
            model=model_type,
            contents=contents,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}], # Enable real-time web search for recent news
            )
        )
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ping")
async def ping():
    """서버 웜업용 ping 엔드포인트 - Render 콜드스타트 방지"""
    return {"status": "ok"}
