const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const fileUpload = document.getElementById('file-upload');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const welcomeSection = document.getElementById('welcome-section');

const API_BASE = 'https://ai-stock-assistant-474b.onrender.com/api'; // 백엔드 주소 (Render)

let selectedFile = null;
let chatHistory = [];

function selectOption(option) {
  // 웰컴 섹션(버튼 3개) 숨기기
  if (welcomeSection) {
    welcomeSection.style.display = 'none';
  }

  if (option === 'analysis') {
    appendMessage('model', '🔍 **[종목 / 섹터 분석]** 모드입니다.<br>궁금하신 특정 주식이나 섹터 이름(예: 삼성전자, AI 반도체 등)을 하단에 자유롭게 입력해주세요.');
  } else if (option === 'portfolio') {
    appendMessage('model', '📸 **[포트폴리오 조언]** 모드입니다.<br>현재 보유 중이신 증권 화면(토스증권 등)을 캡처해서 하단 클립(📎) 버튼이나 **Ctrl+V**로 붙여넣어 전송해주세요. 날카로운 팩트 폭행과 리밸런싱을 제안해 드립니다.');
  } else if (option === 'news') {
    appendMessage('model', '📰 **[실시간 뉴스 추천]** 이번 주 거시 경제 흐름과 추천 종목 브리핑을 준비합니다...');
    sendQuickMessage('이번 주 가장 큰 영향을 미치는 거시경제 뉴스를 요약하고, 관련 최선호 섹터와 2가지 종목을 추천해줘. 실시간 구글 검색을 활용해줘.');
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
  fileUpload.value = '';
  imagePreview.classList.add('hidden');
  previewImg.src = '';
}

function handleEnter(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// 클립보드 붙여넣기 지원
document.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      setPreview(blob);
    }
  }
});

function renderMarkdown(text) {
  return text
    .replace(/^### (.*$)/gim, '<h3 style="margin-top: 1.5rem; color: #a5b4fc;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h3 style="margin-top: 1.5rem; color: #a5b4fc;">$1</h3>')
    .replace(/^\*\*([^*]+)\*\*/gim, '<b style="color: #fbbf24;">$1</b>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>');
}

function appendMessage(role, text, imageUrl = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + (role === 'user' ? 'user-message' : 'ai-message');

  let contentHtml = '';
  if (imageUrl) {
    contentHtml += `<img src="${imageUrl}" class="msg-image" style="max-width: 250px; border-radius: 8px; margin-bottom: 8px; display: block;"/>`;
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

  // 첫 번째 메시지가 전송될 때 웰컴 버튼들 숨기기
  if (welcomeSection) {
    welcomeSection.style.display = 'none';
  }

  // UI 반영
  const currentImage = selectedFile ? previewImg.src : null;
  appendMessage('user', text, currentImage);

  // 로딩 메시지
  const loadingDiv = appendMessage('model', '<div class="loader">분석 중입니다... 🔄</div>');

  // FormData 구성
  const formData = new FormData();
  formData.append('message', text);
  formData.append('history', JSON.stringify(chatHistory));

  const selectedModel = document.getElementById('model-select').value;
  formData.append('model_type', selectedModel);

  if (selectedFile) {
    formData.append('file', selectedFile);
  }

  // 히스토리에 추가 (보내기 전 유저 메시지)
  chatHistory.push({ role: 'user', text: text });

  // Reset input
  chatInput.value = '';
  removeImage();
  chatInput.style.height = 'auto';

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    // 로딩 문구 제거 및 AI 응답 추가
    loadingDiv.remove();
    appendMessage('model', data.result || data.detail);

    // 히스토리에 추가 (모델 메시지)
    chatHistory.push({ role: 'model', text: data.result || data.detail });
  } catch (e) {
    loadingDiv.remove();
    appendMessage('model', '<span style="color:red">서버 통신 오류가 발생했습니다. 백엔드(Render) 서버가 켜져 있는지 확인해주세요.</span>');
    chatHistory.pop(); // 에러 발생 시 히스토리 원복
  }
}
