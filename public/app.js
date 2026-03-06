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
let pendingFormData = null; // 재시도를 위한 대기 중인 요청

// ────────────────────────────────────────
// 서버 웜업 (Render 콜드스타트 방지)
// ────────────────────────────────────────
async function wakeUpServer() {
  try {
    const res = await fetch(`${API_BASE}/ping`, { method: 'GET', signal: AbortSignal.timeout(60000) });
    if (res.ok) {
      serverReady = true;
      console.log('✅ 서버 준비 완료');
    }
  } catch (e) {
    serverReady = false;
    console.warn('⚠️ 서버 웜업 실패 (첫 요청 시도 시 자동 재시도)');
  }
}

// 재시도 포함 fetch
async function fetchWithRetry(url, options, maxRetries = 3, retryDelay = 15000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (e) {
      if (e.name === 'AbortError') throw e; // 타임아웃은 재시도 안 함
      if (attempt < maxRetries) {
        console.warn(`🔄 재시도 ${attempt}/${maxRetries - 1} - ${retryDelay / 1000}초 후 재연결...`);
        await new Promise(r => setTimeout(r, retryDelay));
      } else {
        throw e;
      }
    }
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

async function sendMessage(retryFormData = null) {
  let text = '';
  let currentImage = null;
  let formData;

  if (retryFormData) {
    // 재시도의 경우 기존 formData 재사용
    formData = retryFormData;
    text = formData.get('message') || '';
  } else {
    text = chatInput.value.trim();
    if (!text && !selectedFile) return;

    // 웰컴 버튼 숨기기
    if (welcomeSection) welcomeSection.style.display = 'none';

    currentImage = selectedFile ? previewImg.src : null;
    appendMessage('user', text, currentImage);

    formData = new FormData();
    formData.append('message', text);
    formData.append('history', JSON.stringify(chatHistory));
    formData.append('model_type', document.getElementById('model-select').value);
    if (selectedFile) formData.append('file', selectedFile);

    chatHistory.push({ role: 'user', text: text });
    chatInput.value = '';
    removeImage();
  }

  // 로딩 메시지 표시
  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'message ai-message';
  loadingBubble.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble" id="loading-status">
      <div class="loader">서버에 연결 중... 🔌</div>
      <small style="color:var(--text-muted);">Render 서버가 슬립 상태라면 최대 1~2분 소요됩니다.<br>자동으로 재시도합니다.</small>
      <div id="retry-counter" style="margin-top:0.5rem;color:#a5b4fc;font-size:0.85rem;"></div>
    </div>`;
  chatMessages.appendChild(loadingBubble);
  scrollToBottom();

  const retryCounter = document.getElementById('retry-counter');
  const MAX_RETRIES = 4;
  const RETRY_DELAY = 15000; // 15초

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1 && retryCounter) {
        retryCounter.textContent = `🔄 재시도 중... (${attempt - 1}/${MAX_RETRIES - 1})`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      loadingBubble.remove();
      appendMessage('model', data.result || data.detail || '응답을 받지 못했습니다.');
      chatHistory.push({ role: 'model', text: data.result || data.detail });
      serverReady = true;
      return; // 성공 시 종료

    } catch (e) {
      if (e.name === 'AbortError') {
        // 90초 타임아웃 → 재시도 없음
        loadingBubble.remove();
        appendMessage('model', `<span style="color:#f87171">⏱ <b>응답 시간 초과</b><br>Render 서버가 응답하지 않습니다. 잠시 후 다시 시도해주세요.</span>`);
        chatHistory.pop();
        return;
      }

      if (attempt < MAX_RETRIES) {
        // 재연결 대기
        if (retryCounter) retryCounter.textContent = `⏳ 재시도 대기 중... (${attempt}/${MAX_RETRIES - 1}) — ${RETRY_DELAY / 1000}초 후`;
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      } else {
        // 최종 실패
        loadingBubble.remove();
        const errorDiv = appendMessage('model', `
          <span style="color:#f87171">🔌 <b>서버 연결 실패</b><br>
          Render 무료 서버가 슬립 상태이거나 문제가 있습니다.<br>
          <small style="color:var(--text-muted)">잠시 후 아래 버튼으로 다시 시도하세요.</small>
          </span>`);
        // 재전송 버튼 추가
        const retryBtn = document.createElement('button');
        retryBtn.textContent = '🔁 다시 보내기';
        retryBtn.style.cssText = `
          margin-top: 0.8rem; display: block;
          background: var(--accent); color: white;
          border: none; border-radius: 8px;
          padding: 0.5rem 1.2rem; cursor: pointer; font-weight: 600;`;
        retryBtn.onclick = () => {
          errorDiv.remove();
          chatHistory.pop();
          sendMessage(formData);
        };
        errorDiv.querySelector('.bubble').appendChild(retryBtn);
        chatHistory.pop();
      }
    }
  }
}

