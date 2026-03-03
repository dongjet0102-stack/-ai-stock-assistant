const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const fileUpload = document.getElementById('file-upload');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const welcomeSection = document.getElementById('welcome-section');

const API_BASE = 'https://ai-stock-assistant-474b.onrender.com/api';

let selectedFile = null;
let chatHistory = [];
let serverReady = false;

// ────────────────────────────────────────
// 서버 웜업 (Render 콜드스타트 방지)
// ────────────────────────────────────────
async function wakeUpServer() {
  try {
    await fetch(`${API_BASE}/ping`, { method: 'GET', signal: AbortSignal.timeout(30000) });
    serverReady = true;
  } catch (e) {
    // 첫 번째 ping 실패해도 실제 요청 시도에 맡김
    serverReady = false;
  }
}
// 페이지 로드 시 미리 깨우기
wakeUpServer();

// ────────────────────────────────────────
// 홈 화면으로 돌아가기
// ────────────────────────────────────────
function goHome() {
  // 웰컴 섹션 다시 보이기
  if (welcomeSection) welcomeSection.style.display = '';

  // AI 메시지 / 유저 메시지 제거 (웰컴 섹션 이후에 추가된 것들)
  const messages = chatMessages.querySelectorAll('.message');
  messages.forEach(m => m.remove());

  // 히스토리 초기화
  chatHistory = [];

  // 이미지 초기화
  removeImage();

  // 입력창 초기화
  chatInput.value = '';
}

// ────────────────────────────────────────
// 버튼 3개: 옵션 선택
// ────────────────────────────────────────
function selectOption(option) {
  if (welcomeSection) welcomeSection.style.display = 'none';

  if (option === 'analysis') {
    appendMessage('model', '🔍 **[종목 / 섹터 분석]** 모드입니다.\n궁금하신 특정 주식이나 섹터 이름(예: 삼성전자, AI 반도체 등)을 입력해주세요.');
  } else if (option === 'portfolio') {
    appendMessage('model', '📸 **[포트폴리오 조언]** 모드입니다.\n증권 화면(토스증권 등)을 캡처해서 📎 버튼이나 **Ctrl+V**로 붙여넣어 전송해주세요. 날카로운 팩트 폭행과 리밸런싱을 제안해 드립니다.');
  } else if (option === 'news') {
    appendMessage('model', '📰 **[실시간 뉴스 추천]** 이번 주 거시 경제 흐름과 추천 종목 브리핑을 준비합니다...');
    setTimeout(() => {
      sendQuickMessage('이번 주 가장 큰 영향을 미치는 거시경제 뉴스를 요약하고, 최선호 섹터와 종목 2가지를 추천해줘. 실시간 구글 검색을 활용해줘.');
    }, 500);
  }
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (file) setPreview(file);
}

function setPreview(file) {
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    imagePreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  selectedFile = null;
  if (fileUpload) fileUpload.value = '';
  if (imagePreview) imagePreview.classList.add('hidden');
  if (previewImg) previewImg.src = '';
}

function handleEnter(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// Ctrl+V 이미지 붙여넣기
document.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      setPreview(item.getAsFile());
    }
  }
});

function renderMarkdown(text) {
  return text
    .replace(/^### (.*$)/gim, '<h3 style="margin-top:1.5rem;color:#a5b4fc;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h3 style="margin-top:1.5rem;color:#a5b4fc;">$1</h3>')
    .replace(/\*\*([^*]+)\*\*/gim, '<b style="color:#fbbf24;">$1</b>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>');
}

function appendMessage(role, text, imageUrl = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + (role === 'user' ? 'user-message' : 'ai-message');

  let contentHtml = '';
  if (imageUrl) {
    contentHtml += `<img src="${imageUrl}" style="max-width:250px;border-radius:8px;margin-bottom:8px;display:block;"/>`;
  }
  if (text) {
    contentHtml += `<div>${renderMarkdown(text)}</div>`;
  }

  if (role === 'model') {
    msgDiv.innerHTML = `<div class="avatar">🤖</div><div class="bubble">${contentHtml}</div>`;
  } else {
    msgDiv.innerHTML = `<div class="bubble">${contentHtml}</div>`;
  }

  chatMessages.appendChild(msgDiv);
  scrollToBottom();
  return msgDiv;
}

function sendQuickMessage(text) {
  chatInput.value = text;
  sendMessage();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text && !selectedFile) return;

  // 웰컴 버튼 숨기기
  if (welcomeSection) welcomeSection.style.display = 'none';

  const currentImage = selectedFile ? previewImg.src : null;
  appendMessage('user', text, currentImage);

  const loadingDiv = appendMessage('model', '<div class="loader">분석 중입니다... 🔄<br><small style="color:var(--text-muted);font-weight:400;">처음 요청 시 서버가 깨어나는 데 최대 1~2분이 소요될 수 있습니다.</small></div>');

  const formData = new FormData();
  formData.append('message', text);
  formData.append('history', JSON.stringify(chatHistory));
  formData.append('model_type', document.getElementById('model-select').value);
  if (selectedFile) formData.append('file', selectedFile);

  chatHistory.push({ role: 'user', text: text });

  chatInput.value = '';
  removeImage();

  try {
    // 타임아웃 120초 (Render 콜드스타트 포함)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await res.json();
    loadingDiv.remove();
    appendMessage('model', data.result || data.detail || '응답을 받지 못했습니다.');
    chatHistory.push({ role: 'model', text: data.result || data.detail });

  } catch (e) {
    loadingDiv.remove();
    if (e.name === 'AbortError') {
      appendMessage('model', `<span style="color:red">⏱ 서버 응답 시간을 초과했습니다. Render 무료 서버가 잠들어 있다면 처음 요청이 오래 걸릴 수 있습니다. 잠시 후 다시 시도해주세요.</span>`);
    } else {
      appendMessage('model', `<span style="color:red">🔌 서버 연결 실패: 백엔드(Render) 서버가 아직 깨어나는 중일 수 있습니다. 잠시 후(약 1분) 다시 보내주세요.</span>`);
    }
    chatHistory.pop();
  }
}
