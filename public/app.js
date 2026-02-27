const contentArea = document.getElementById('content-area');
// Render 클라우드 백엔드 주소로 변경 (배포용)
const API_BASE = 'https://ai-stock-assistant-474b.onrender.com/api';

function selectOption(option) {
  contentArea.classList.remove('hidden');
  contentArea.style.animation = 'none';
  void contentArea.offsetWidth;
  contentArea.style.animation = 'fadeIn 0.5s ease';

  if (option === 'analysis') {
    renderAnalysisUI();
  } else if (option === 'portfolio') {
    renderPortfolioUI();
  } else if (option === 'news') {
    renderNewsUI();
  }
}

function renderAnalysisUI() {
  contentArea.innerHTML = `
    <h2>어떤 종목, 섹터에 대하여 이야기하고 싶나요?</h2>
    <p>예: 엔비디아, 삼성전자, AI 소프트웨어 등</p>
    <div class="input-group">
      <input type="text" id="stock-input" class="glass-input" placeholder="종목명 또는 섹터를 입력하세요..." onkeydown="if(event.key === 'Enter') analyzeStock()">
      <button class="primary-btn" onclick="analyzeStock()">진짜 AI 분석하기</button>
    </div>
    <div id="result-container"></div>
  `;
}

function renderPortfolioUI() {
  contentArea.innerHTML = `
    <h2>토스증권 포트폴리오를 캡처해서 올려주세요 📸</h2>
    <p>포트폴리오 이미지를 Vision AI가 읽고 전문가 수준의 가혹한 리밸런싱 조언을 제공합니다.</p>
    <p style="color: var(--accent); font-weight: bold; margin-top: 1rem;">💡 팁: 화면 캡처 후 이 화면에서 바로 [Ctrl + V] 로 붙여넣기 해보세요!</p>
    <input type="file" id="file-input" accept="image/*" style="display: none;" onchange="handleFileUpload(event)">
    <div class="upload-area" style="margin-top: 1.5rem; border: 2px dashed var(--glass-border); padding: 3rem; text-align: center; border-radius: 12px; cursor: pointer; transition: 0.3s;" onclick="document.getElementById('file-input').click()">
      <span style="font-size: 3rem;">📤</span>
      <p style="margin-top: 1rem; color: var(--text-muted);">클릭하여 업로드 하거나 화면에 붙여넣기(Ctrl+V) 하세요</p>
    </div>
    <div id="result-container"></div>
  `;
}

function renderNewsUI() {
  contentArea.innerHTML = `
    <h2>이번 주 핵심 주식 시장 리포트 📰</h2>
    <p>Gemini AI가 실시간으로 거시 경제 트렌드를 분석하고 주도주 섹터를 뽑아냅니다...</p>
    <div id="result-container" style="margin-top: 2rem;">
      <div class="loader">🔄 구글 제미나이가 글로벌 경제 상황을 추론 중입니다...</div>
    </div>
  `;
  fetchNews();
}

function showLoader(containerId, message) {
  document.getElementById(containerId).innerHTML = `
    <div style="text-align: center; padding: 3rem 0; color: var(--accent);">
      <div style="font-size: 2rem; margin-bottom: 1rem; animation: spin 1s linear infinite;">⚙️</div>
      <p>${message}</p>
    </div>
  `;
}

function renderMarkdown(text) {
  // Simple markdown to HTML parser for the result card
  let html = text
    .replace(/^### (.*$)/gim, '<h3 style="margin-top: 1.5rem; color: #a5b4fc;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h3 style="margin-top: 1.5rem; color: #a5b4fc;">$1</h3>')
    .replace(/^\*\*([^*]+)\*\*/gim, '<b style="color: #fbbf24;">$1</b>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>');
  return html;
}

async function analyzeStock() {
  const input = document.getElementById('stock-input').value;
  if (!input) return alert('종목명이나 섹터를 입력해주세요.');

  showLoader('result-container', `야후 파이낸스 실시간 데이터 연동 및 "${input}" 제미나이 AI 분석 중...`);

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input })
    });
    const data = await res.json();

    document.getElementById('result-container').innerHTML = `
      <div class="result-card animation-fade" style="line-height: 1.8; color: var(--text-muted);">
        ${renderMarkdown(data.result || data.detail)}
      </div>
    `;
  } catch (e) {
    document.getElementById('result-container').innerHTML = `<p style="color:red">API Error: 백엔드 서버가 켜져 있는지 확인해주세요.</p>`;
  }
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  showLoader('result-container', `Gemini Vision AI가 이미지를 판독(OCR)하고 분석 중입니다...`);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/portfolio`, {
      method: "POST",
      body: formData
    });
    const data = await res.json();

    document.getElementById('result-container').innerHTML = `
      <div class="result-card animation-fade" style="line-height: 1.8; color: var(--text-muted);">
        ${renderMarkdown(data.result || data.detail)}
      </div>
    `;
  } catch (e) {
    document.getElementById('result-container').innerHTML = `<p style="color:red">Upload Error.</p>`;
  }
}

async function fetchNews() {
  try {
    const res = await fetch(`${API_BASE}/news`);
    const data = await res.json();
    document.getElementById('result-container').innerHTML = `
      <div class="result-card animation-fade" style="line-height: 1.8; color: var(--text-muted);">
        ${renderMarkdown(data.result || data.detail)}
      </div>
    `;
  } catch (e) {
    document.getElementById('result-container').innerHTML = `<p style="color:red">API Error: 백엔드 서버 연결 실패.</p>`;
  }
}

// 스크린샷 캡처 후 Ctrl+V 로 바로 붙여넣기 지원
document.addEventListener('paste', (event) => {
  // 포트폴리오 화면이 열려있을 때만 작동 (file-input 존재 여부 확인)
  const fileInput = document.getElementById('file-input');
  if (!fileInput) return;

  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      const mockEvent = { target: { files: [blob] } };
      handleFileUpload(mockEvent); // 캡처된 이미지를 업로드 함수로 전달
    }
  }
});
