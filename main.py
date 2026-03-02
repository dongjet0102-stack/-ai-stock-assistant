import os
import yfinance as yf
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from io import BytesIO
from PIL import Image

# Configure Gemini API Key (Secret loaded from Environment Variable on Render)
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    # Fallback to local key for testing if env var isn't set
    api_key = "AIzaSyC7omD4yV5oJyuAsqio35wGU_N1115qIs4"
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

class AnalyzeRequest(BaseModel):
    query: str

@app.post("/api/analyze")
async def analyze_stock(request: AnalyzeRequest):
    query = request.query
    
    # 1. Try to fetch basic data from yfinance if the user entered an English Ticker (e.g., AAPL)
    # If it's a Korean name or sector, yf might not find it directly, relying more on Gemini's vast knowledge.
    market_data = "Market data fetch attempted."
    try:
        if query.encode().isalpha(): # rough check if it's an english ticker
            ticker = yf.Ticker(query.upper())
            info = ticker.info
            market_data = f"Current Price: {info.get('currentPrice', 'N/A')}, P/E: {info.get('trailingPE', 'N/A')}, ROE: {info.get('returnOnEquity', 'N/A')}, Sector: {info.get('sector', 'N/A')}"
        else:
            market_data = f"User asked for: {query}. Please use your comprehensive training data to analyze this asset/sector."
    except Exception as e:
        market_data = f"Could not fetch real-time ticker data for '{query}'. Please analyze based on your training data."

    # 2. Build the strict prompt for Gemini 1.5
    prompt = f"""
    당신은 월스트리트의 최고급 AI 주식 분석가입니다.
    사용자가 다음 종목/섹터에 대해 질문했습니다: "{query}"
    
    [실시간 참초 데이터 (존재할 경우)]: {market_data}
    
    다음 4가지 섹션을 반드시 포함하여, 투자자에게 실질적인 리포트를 매우 전문적이고 직설적인 어조로 작성하세요. HTML 형식 없이 순수 텍스트(Markdown 허용)로 작성하되 앱의 UI에 맞춰 읽기 쉽게 작성해야 합니다.
    
    필수 포함 내용:
    1. 핵심 요약 및 최종 결정 (강력 매수 / 분할 매수 / 관망 / 매도 중 하나를 정확히 명시)
    2. 펀더멘털 분석 (수익성, 기업 가치, 경영진 역량)
    3. 거시경제(Macro) 및 센티먼트 환경 (현재 금리, 경쟁사 동향 등)
    4. 기술적 타점 (구체적인 매수/매도 지지선 및 저항선 안내)
    """

    try:
        # Enable Google Search grounding to prevent hallucinations about real-time facts using the new SDK syntax
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
            )
        )
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/portfolio")
async def analyze_portfolio(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    try:
        # Read the image file
        contents = await file.read()
        image = Image.open(BytesIO(contents))
        
        # Build prompt for Gemini Vision
        prompt = """
        당신은 상위 1% 자산 운용사 포트폴리오 매니저입니다. 
        첨부된 이미지는 사용자의 증권 앱(예: 토스증권) 포트폴리오 스크린샷입니다.
        
        1. 이미지에 있는 종목명, 수익률, 비중(또는 총액)을 완벽하게 인식해서 나열하세요.
        2. 이 포트폴리오의 치명적인 약점(리스크)과 강점을 팩트 폭행하듯 아주 날카롭게 분석하세요. (섹터 편중, 고평가 주식 과다 등)
        3. 수익률 극대화와 리스크 헷지를 위한 구체적인 "리밸런싱 액션 플랜(매도 종목, 추천 대체 종목)"을 제안하세요.
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, image]
        )
        
        return {"result": response.text}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR AI Error: {str(e)}")

@app.get("/api/news")
async def weekly_news_recommendation():
    prompt = """
    당신은 글로벌 매크로 경제 및 주식 시장 수석 전략가입니다.
    현재 시점을 기준으로 최근 가장 주식 시장에 큰 영향을 미치고 있는 거시 경제 뉴스 2~3가지를 요약하세요 (예: 금리, AI 인프라, 전쟁 등).
    그리고 이러한 매크로 환경 하에서 앞으로 1개월 내에 자금이 쏠릴 것으로 예상되는 "최선호 섹터 1개"와 "가장 위험한 섹터 1개"를 명시하고,
    최선호 섹터 내에서 당장 매수할 만한 구체적인 종목(티커 포함) 2개를 추천하고 명확한 매수 이유를 제시하세요.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
            )
        )
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
