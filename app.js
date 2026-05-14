// ── PAGE NAVIGATION ──
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'analytics') loadAnalytics();
  if (name === 'diagnoses') loadDiagnoses();
}

// ── CHAT ──
let selectedImage = null;

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedImage = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('imagePreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  selectedImage = null;
  document.getElementById('imageInput').value = '';
  document.getElementById('imagePreview').style.display = 'none';
}

function handleKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function quickAsk(text) {
  document.getElementById('chatInput').value = text;
  sendMessage();
}

function addMessage(role, content, imageSrc = null) {
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (role === 'ai') {
    div.innerHTML = `<div class="label">🌱 Shamba AI</div>`;
  }
  if (imageSrc) {
    div.innerHTML += `<img src="${imageSrc}" alt="uploaded plant"/>`;
  }
  const text = document.createElement('div');
  text.innerText = content;
  div.appendChild(text);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function addTyping() {
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = 'typingIndicator';
  div.innerHTML = `<div class="label">🌱 Shamba AI</div>
    <div class="typing"><span></span><span></span><span></span></div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('sendBtn');
  const message = input.value.trim();

  if (!message && !selectedImage) return;

  // Show user message
  const imageSrc = selectedImage ? URL.createObjectURL(selectedImage) : null;
  addMessage('user', message || 'Please analyze this plant image', imageSrc);
  input.value = '';
  btn.disabled = true;

  // Show typing
  addTyping();

  try {
    const formData = new FormData();
    if (message) formData.append('message', message);
    if (selectedImage) formData.append('image', selectedImage);
    formData.append('farmer_id', 1);

    const res = await fetch('/api/chat', { method: 'POST', body: formData });
    const data = await res.json();

    removeTyping();

    if (data.error) {
      addMessage('ai', '❌ Error: ' + data.error);
    } else {
      addMessage('ai', data.reply);
    }
  } catch (err) {
    removeTyping();
    addMessage('ai', '❌ Could not connect to server. Make sure it is running.');
  }

  clearImage();
  btn.disabled = false;
}

// ── FARM REPORT ──
async function submitReport() {
  const crop = document.getElementById('r-crop').value;
  if (!crop) {
    showMsg('reportMsg', '⚠️ Please select a crop.', 'orange');
    return;
  }

  const report = {
    farmer_id: 1,
    crop,
    field_size: document.getElementById('r-field').value,
    yield_kg: document.getElementById('r-yield').value,
    rainfall_mm: document.getElementById('r-rain').value,
    temperature: document.getElementById('r-temp').value,
    soil_ph: document.getElementById('r-ph').value,
    fertilizer_used: document.getElementById('r-fert').value,
    notes: document.getElementById('r-notes').value,
  };

  try {
    const res = await fetch('/api/farm/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    const data = await res.json();
    if (data.success) {
      showMsg('reportMsg', '✅ Report saved successfully!', 'green');
      clearReport();
    } else {
      showMsg('reportMsg', '❌ Error: ' + data.error, 'red');
    }
  } catch (err) {
    showMsg('reportMsg', '❌ Could not connect to server.', 'red');
  }
}

function clearReport() {
  ['r-crop','r-field','r-yield','r-rain','r-temp','r-ph','r-fert','r-notes','r-date']
    .forEach(id => { document.getElementById(id).value = ''; });
}

function showMsg(id, text, color) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = color;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

// ── ANALYTICS ──
let cropChartInstance = null;
let trendChartInstance = null;
let rainChartInstance = null;

async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics/summary');
    const data = await res.json();

    document.getElementById('statReports').textContent = data.totalReports || 0;
    document.getElementById('statYield').textContent = data.avgYield ? Math.round(data.avgYield) + ' kg' : '0 kg';
    document.getElementById('statCrops').textContent = data.crops ? data.crops.length : 0;

    // Crop yield bar chart
    if (cropChartInstance) cropChartInstance.destroy();
    cropChartInstance = new Chart(document.getElementById('cropChart'), {
      type: 'bar',
      data: {
        labels: data.crops.map(c => c.crop),
        datasets: [{
          label: 'Reports',
          data: data.crops.map(c => c.count),
          backgroundColor: '#52b788',
          borderRadius: 8,
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Yield trend line chart
    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: data.yieldTrend.map(r => r.report_date),
        datasets: [{
          label: 'Yield (kg)',
          data: data.yieldTrend.map(r => r.yield_kg),
          borderColor: '#2d6a4f',
          backgroundColor: 'rgba(45,106,79,0.1)',
          tension: 0.4,
          fill: true,
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Rainfall vs yield scatter
    if (rainChartInstance) rainChartInstance.destroy();
    const reports = await fetch('/api/farm/reports').then(r => r.json());
    rainChartInstance = new Chart(document.getElementById('rainChart'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Rainfall vs Yield',
          data: reports.map(r => ({ x: r.rainfall_mm, y: r.yield_kg })),
          backgroundColor: '#f4a620',
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: 'Rainfall (mm)' } },
          y: { title: { display: true, text: 'Yield (kg)' } }
        }
      }
    });

    // AI recommendations
    if (data.totalReports > 0) {
      const recRes = await fetch('/api/chat', {
        method: 'POST',
        body: (() => { const f = new FormData(); f.append('message', `Based on ${data.totalReports} farm reports with average yield of ${Math.round(data.avgYield)}kg, crops grown: ${data.crops.map(c=>c.crop).join(', ')}. Give 3 short farming recommendations.`); f.append('farmer_id', 1); return f; })()
      });
      const recData = await recRes.json();
      if (recData.reply) {
        document.getElementById('aiRecs').innerText = recData.reply;
      }
    }
  } catch (err) {
    console.error('Analytics error:', err);
  }
}

// ── DIAGNOSES ──
async function loadDiagnoses() {
  try {
    const res = await fetch('/api/chat/history');
    const history = await res.json();
    const diagnoses = history.filter(h => h.image_path);
    const list = document.getElementById('diagnosisList');

    if (diagnoses.length === 0) {
      list.innerHTML = '<p style="color:var(--subtle);font-size:0.85rem;">No diagnoses yet. Upload a plant photo in the chat to get started!</p>';
      return;
    }

    list.innerHTML = diagnoses.map(d => `
      <div class="diagnosis-item">
        <img src="/uploads/${d.image_path}" alt="plant" onerror="this.style.display='none'"/>
        <div class="text">
          <h4>📅 ${new Date(d.created_at).toLocaleDateString()}</h4>
          <p>${d.content.substring(0, 200)}...</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Diagnoses error:', err);
  }
}

// ── INIT ──
window.onload = () => {
  addMessage('ai', 'Habari! 👋 I am Shamba AI, your smart farming assistant. Ask me anything about your crops, or upload a photo of a sick plant and I will diagnose it for you!');
  document.getElementById('r-date').value = new Date().toISOString().split('T')[0];
};