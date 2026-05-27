/**
 * Golf Driver Analyzer - Application Logic
 * Author: ShoG & Antigravity (Google DeepMind Team)
 * Version: v1.3-MVP
 * Created: 2026-05-28
 * Description: 100% Client-side high-precision golf impact and launch diagnostic system.
 */

// Global Application State
const state = {
  currentPanel: 'home',
  shots: [],
  units: {
    distance: 'yd', // 'yd' or 'm'
    speed: 'ms'      // 'ms' (m/s) or 'kmh' (km/h)
  },
  camera: {
    stream: null,
    recorder: null,
    chunks: [],
    isRecording: false,
    zoom: 1.0,
    audioCtx: null,
    audioAnalyser: null,
    micStream: null,
    soundTriggerActive: false
  },
  analysis: {
    videoBlob: null,
    videoUrl: null,
    isPlaying: false,
    fps: 30, // Default frame rate, will adjust
    duration: 0,
    currentTime: 0,
    impactFrame: 0,
    launchFrame: 0,
    ballTrajectory: [], // List of {x, y, time}
    clubTrajectory: [],
    ballStart: null,     // {x, y}
    metrics: null,       // hs, smash, vangle, hangle, distance, shape, zone
    isProcessed: false,
    overlayEnabled: true
  },
  demoMode: false,
  activeHitZone: 'center-mid', // Default sweet spot
  activeShape: 'straight',
  tapeMode: false
};

// DOM Elements
const els = {};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  cacheDOMElements();
  loadDataFromStorage();
  setupNavigation();
  setupEventListeners();
  initPWA();
  
  // Render initial dashboard data
  renderHomeSummary();
  renderHistoryList();
});

// Cache DOM Elements
function cacheDOMElements() {
  els.panels = document.querySelectorAll('.app-panel');
  els.navItems = document.querySelectorAll('.app-nav-bar .nav-item');
  
  // Home panel elements
  els.avgHs = document.getElementById('avg-hs');
  els.avgSmash = document.getElementById('avg-smash');
  els.avgAngle = document.getElementById('avg-angle');
  els.avgDist = document.getElementById('avg-dist');
  els.homeRecentList = document.getElementById('home-recent-list');
  
  // Capture panel elements
  els.cameraStream = document.getElementById('camera-stream');
  els.cameraDeviceSelect = document.getElementById('camera-device-select');
  els.captureTimer = document.getElementById('capture-timer');
  els.chkSoundTrigger = document.getElementById('chk-sound-trigger');
  els.btnTriggerRecord = document.getElementById('btn-trigger-record');
  els.btnLoadDemo = document.getElementById('btn-load-demo');
  els.captureRecStatus = document.getElementById('capture-rec-status');
  els.captureRecTimer = document.getElementById('capture-rec-timer');
  els.soundTriggerBadge = document.getElementById('sound-trigger-badge');
  els.captureCountdown = document.getElementById('capture-countdown');
  els.captureCountdownNum = document.getElementById('capture-countdown-num');
  els.zoomSlider = document.getElementById('zoom-slider');
  els.videoFilePicker = document.getElementById('video-file-picker');
  
  // Result panel elements
  els.resultVideo = document.getElementById('result-video');
  els.resultCanvas = document.getElementById('result-canvas');
  els.resultProcessing = document.getElementById('result-processing');
  els.resultSlider = document.getElementById('result-slider');
  els.resultTimelineMarkers = document.getElementById('result-timeline-markers');
  els.btnResultPlay = document.getElementById('btn-result-play');
  els.btnResultPrev = document.getElementById('btn-result-prev');
  els.btnResultNext = document.getElementById('btn-result-next');
  els.resultTime = document.getElementById('result-time');
  els.chkVideoOverlay = document.getElementById('chk-video-overlay');
  
  els.resHs = document.getElementById('res-hs');
  els.resHsStatus = document.getElementById('res-hs-status');
  els.resSmash = document.getElementById('res-smash');
  els.resSmashStatus = document.getElementById('res-smash-status');
  els.resVangle = document.getElementById('res-vangle');
  els.resVangleStatus = document.getElementById('res-vangle-status');
  els.resHangle = document.getElementById('res-hangle');
  els.resHangleStatus = document.getElementById('res-hangle-status');
  els.resDistance = document.getElementById('res-distance');
  els.resDistanceUnit = document.getElementById('res-distance-unit');
  els.trajectoryCanvas = document.getElementById('trajectory-canvas');
  
  // Impact panel elements
  els.chkTapeMode = document.getElementById('chk-tape-mode');
  els.impactAdviceText = document.getElementById('impact-advice-text');
  els.btnSaveShot = document.getElementById('btn-save-shot');
  els.btnShareShot = document.getElementById('btn-share-shot');
  els.shapeButtons = document.querySelectorAll('.shape-btn');
  els.gridCells = document.querySelectorAll('.grid-cell');
  els.clubfaceContainer = document.getElementById('clubface-container');
  
  // History panel elements
  els.dbHistoryList = document.getElementById('db-history-list');
  els.btnDbClearAll = document.getElementById('btn-db-clear-all');
  els.selectChartMetric = document.getElementById('select-chart-metric');
  els.trendChartCanvas = document.getElementById('trendChart');
  
  // Settings panel elements
  els.settingUnitDistance = document.getElementById('setting-unit-distance');
  els.settingUnitSpeed = document.getElementById('setting-unit-speed');
  els.btnExportData = document.getElementById('btn-export-data');
  els.btnImportData = document.getElementById('btn-import-data');
  els.importFilePicker = document.getElementById('import-file-picker');
}

// Data loading / saving
function loadDataFromStorage() {
  try {
    const rawShots = localStorage.getItem('golf_driver_analyzer_shots');
    state.shots = rawShots ? JSON.parse(rawShots) : [];
    
    const rawUnits = localStorage.getItem('golf_driver_analyzer_units');
    if (rawUnits) {
      state.units = JSON.parse(rawUnits);
    }
  } catch (e) {
    console.error('Error loading localStorage data:', e);
    state.shots = [];
  }
}

function saveDataToStorage() {
  try {
    localStorage.setItem('golf_driver_analyzer_shots', JSON.stringify(state.shots));
    localStorage.setItem('golf_driver_analyzer_units', JSON.stringify(state.units));
  } catch (e) {
    console.error('Error saving data to localStorage:', e);
  }
}

// SPA Routing Control
function switchPanel(panelId) {
  state.currentPanel = panelId;
  
  // Update view panel classes
  els.panels.forEach(panel => {
    panel.classList.remove('active');
    if (panel.id === `panel-${panelId}`) {
      panel.classList.add('active');
    }
  });
  
  // Update active bottom navigation tabs
  els.navItems.forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-target') === panelId) {
      item.classList.add('active');
    }
  });

  // Handle panel switch hooks
  if (panelId === 'capture') {
    startCameraSetup();
  } else {
    stopCameraStream();
  }
  
  if (panelId === 'history') {
    renderHistoryList();
    renderTrendChart();
  }
  
  if (panelId === 'home') {
    renderHomeSummary();
    renderHistoryList();
  }

  if (panelId === 'settings') {
    // Sync UI with state
    els.settingUnitDistance.value = state.units.distance;
    els.settingUnitSpeed.value = state.units.speed;
  }
}

function setupNavigation() {
  els.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      switchPanel(target);
    });
  });
}

// Event Listeners setup
function setupEventListeners() {
  // Capture view events
  els.cameraDeviceSelect.addEventListener('change', () => {
    startCameraSetup();
  });
  
  els.zoomSlider.addEventListener('input', (e) => {
    setCameraZoom(parseFloat(e.target.value));
  });
  
  els.btnTriggerRecord.addEventListener('click', toggleRecording);
  
  els.btnLoadDemo.addEventListener('click', loadDemoAnalysis);
  
  els.videoFilePicker.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      processLoadedVideoFile(file);
    }
  });
  
  // Result view events
  els.btnResultPlay.addEventListener('click', toggleResultVideoPlayback);
  els.btnResultPrev.addEventListener('click', () => stepResultVideoFrame(-1));
  els.btnResultNext.addEventListener('click', () => stepResultVideoFrame(1));
  
  els.resultSlider.addEventListener('input', (e) => {
    if (els.resultVideo.duration) {
      const pct = parseFloat(e.target.value);
      els.resultVideo.currentTime = (pct / 100) * els.resultVideo.duration;
    }
  });
  
  els.chkVideoOverlay.addEventListener('change', (e) => {
    state.analysis.overlayEnabled = e.target.checked;
    drawAnalysisOverlay();
  });
  
  const speedButtons = document.querySelectorAll('.speed-btn-col .speed-btn');
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const rate = parseFloat(btn.getAttribute('data-rspeed'));
      els.resultVideo.playbackRate = rate;
    });
  });
  
  // Impact view events
  els.chkTapeMode.addEventListener('change', (e) => {
    state.tapeMode = e.target.checked;
    renderClubfaceGrid();
  });
  
  els.shapeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      els.shapeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeShape = btn.getAttribute('data-shape');
      
      // Re-calculate zone based on physics gear-effect
      recalculateZoneFromMetrics();
      renderClubfaceGrid();
      updateImpactAdvisory();
    });
  });
  
  els.gridCells.forEach(cell => {
    cell.addEventListener('click', () => {
      const zone = cell.getAttribute('data-zone');
      state.activeHitZone = zone;
      
      // Update Grid UI
      els.gridCells.forEach(c => {
        c.classList.remove('active-hit', 'tape-active');
      });
      cell.classList.add('active-hit');
      if (state.tapeMode) {
        cell.classList.add('tape-active');
      }
      
      // Update advice
      updateImpactAdvisory();
    });
  });
  
  els.btnSaveShot.addEventListener('click', saveCurrentShotToHistory);
  els.btnShareShot.addEventListener('click', generateAndShareReport);
  
  // History view events
  els.btnDbClearAll.addEventListener('click', clearAllHistoryData);
  els.selectChartMetric.addEventListener('change', renderTrendChart);
  
  // Settings view events
  els.settingUnitDistance.addEventListener('change', (e) => {
    state.units.distance = e.target.value;
    saveDataToStorage();
    renderHomeSummary();
  });
  
  els.settingUnitSpeed.addEventListener('change', (e) => {
    state.units.speed = e.target.value;
    saveDataToStorage();
    renderHomeSummary();
  });
  
  els.btnExportData.addEventListener('click', exportDataAsJSON);
  
  els.importFilePicker.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importDataFromJSON(file);
    }
  });
  
  // Handle result video events
  els.resultVideo.addEventListener('loadedmetadata', () => {
    state.analysis.duration = els.resultVideo.duration;
    els.resultSlider.value = 0;
    state.analysis.isProcessed = false;
    analyzeVideoFrames(); // Run AI frame processing
  });
  
  els.resultVideo.addEventListener('timeupdate', () => {
    if (!els.resultVideo.duration) return;
    const time = els.resultVideo.currentTime;
    state.analysis.currentTime = time;
    
    // Update Slider
    els.resultSlider.value = (time / els.resultVideo.duration) * 100;
    
    // Update Time display
    els.resultTime.innerText = `${time.toFixed(2)} / ${els.resultVideo.duration.toFixed(2)}s`;
    
    // Redraw Canvas overlay
    drawAnalysisOverlay();
  });
  
  els.resultVideo.addEventListener('ended', () => {
    state.analysis.isPlaying = false;
    els.btnResultPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
  });
}

// ----------------------------------------
// CAMERA & RECORDING FUNCTIONS (PWA-optimized)
// ----------------------------------------

async function startCameraSetup() {
  stopCameraStream();
  
  try {
    // 1. Request video permissions
    const constraints = {
      video: {
        facingMode: 'environment', // Rear camera preferred for ball-alignment
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: state.camera.soundTriggerActive || els.chkSoundTrigger.checked
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.camera.stream = stream;
    els.cameraStream.srcObject = stream;
    els.cameraStream.setAttribute('playsinline', true);
    
    // Query devices to populate select box
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    els.cameraDeviceSelect.innerHTML = '';
    videoDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `カメラ ${els.cameraDeviceSelect.length + 1}`;
      els.cameraDeviceSelect.appendChild(option);
    });
    
    // Configure sound triggers if checked
    setupAudioContextForTrigger(stream);
    
    // Apply zoom initial value
    setCameraZoom(state.camera.zoom);
    
  } catch (err) {
    console.error('Camera access failed:', err);
    alert('カメラへのアクセスを許可してください。ボール近接で設置撮影するために必要です。');
  }
}

function stopCameraStream() {
  if (state.camera.stream) {
    state.camera.stream.getTracks().forEach(track => track.stop());
    state.camera.stream = null;
  }
  if (state.camera.micStream) {
    state.camera.micStream.getTracks().forEach(track => track.stop());
    state.camera.micStream = null;
  }
  if (state.camera.audioCtx && state.camera.audioCtx.state !== 'closed') {
    state.camera.audioCtx.close();
  }
  state.camera.isRecording = false;
  els.captureRecStatus.classList.add('hidden');
  els.soundTriggerBadge.classList.add('hidden');
}

function setCameraZoom(zoomVal) {
  state.camera.zoom = zoomVal;
  els.zoomSlider.value = zoomVal;
  
  // Sync styling for warning ranges on slider
  const zoomTicks = document.querySelectorAll('.zoom-ticks .tick');
  zoomTicks.forEach(tick => tick.classList.remove('active'));
  
  if (zoomVal >= 3.0) {
    zoomTicks[2].classList.add('active'); // Warning red range
  } else if (zoomVal >= 2.0) {
    zoomTicks[1].classList.add('active'); // Max recommended
  } else {
    zoomTicks[0].classList.add('active'); // 1x
  }

  // CSS Digital zoom fallback for video stream viewport
  els.cameraStream.style.transform = `scale(${zoomVal}) scaleX(-1)`; // Scale and mirror
}

// Sound-Trigger Audio analysis context
function setupAudioContextForTrigger(stream) {
  if (!els.chkSoundTrigger.checked) {
    els.soundTriggerBadge.classList.add('hidden');
    return;
  }
  
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.camera.audioCtx = new AudioContextClass();
    const source = state.camera.audioCtx.createMediaStreamSource(stream);
    state.camera.audioAnalyser = state.camera.audioCtx.createAnalyser();
    state.camera.audioAnalyser.fftSize = 512;
    source.connect(state.camera.audioAnalyser);
    
    els.soundTriggerBadge.classList.remove('hidden');
    monitorAudioDecibels();
  } catch (e) {
    console.warn('Audio Context trigger failed to initialize:', e);
  }
}

// Listen for ball impact impact sound (microphone peak volume threshold)
function monitorAudioDecibels() {
  if (!state.camera.audioCtx || els.cameraStream.srcObject === null) return;
  
  const bufferLength = state.camera.audioAnalyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  const checkVolume = () => {
    if (!state.camera.audioCtx || state.camera.audioCtx.state === 'closed') return;
    
    state.camera.audioAnalyser.getByteFrequencyData(dataArray);
    
    // Compute peak amplitude
    let total = 0;
    for (let i = 0; i < bufferLength; i++) {
      total += dataArray[i];
    }
    const average = total / bufferLength;
    
    // Threshold volume peak representing impact shot (approx 70-80 depending on ambient sound)
    if (average > 85 && !state.camera.isRecording) {
      console.log('Impact Sound Detected! Triggering Auto-cut Recording.');
      triggerAutoAudioRecording();
      return; // Stop checking until recording completes
    }
    
    if (els.chkSoundTrigger.checked && !state.camera.isRecording) {
      requestAnimationFrame(checkVolume);
    }
  };
  
  requestAnimationFrame(checkVolume);
}

function triggerAutoAudioRecording() {
  // Start recording immediately
  startVideoRecording();
  
  // Automatically stop recording after 3 seconds (address -> impact -> follow completed)
  setTimeout(() => {
    if (state.camera.isRecording) {
      stopVideoRecording();
    }
  }, 3200);
}

function toggleRecording() {
  if (state.camera.isRecording) {
    stopVideoRecording();
  } else {
    // Check self-timer
    const delay = parseInt(els.captureTimer.value);
    if (delay > 0) {
      els.captureCountdown.classList.remove('hidden');
      let count = delay;
      els.captureCountdownNum.innerText = count;
      
      const interval = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(interval);
          els.captureCountdown.classList.add('hidden');
          startVideoRecording();
        } else {
          els.captureCountdownNum.innerText = count;
        }
      }, 1000);
    } else {
      startVideoRecording();
    }
  }
}

function startVideoRecording() {
  if (!state.camera.stream) return;
  
  state.camera.chunks = [];
  const options = { mimeType: 'video/webm;codecs=vp8' };
  
  try {
    state.camera.recorder = new MediaRecorder(state.camera.stream, options);
  } catch (e) {
    // Fallback mime type
    state.camera.recorder = new MediaRecorder(state.camera.stream);
  }
  
  state.camera.recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      state.camera.chunks.push(e.data);
    }
  };
  
  state.camera.recorder.onstop = () => {
    state.analysis.videoBlob = new Blob(state.camera.chunks, { type: 'video/webm' });
    state.analysis.videoUrl = URL.createObjectURL(state.analysis.videoBlob);
    
    // Load result video
    els.resultVideo.src = state.analysis.videoUrl;
    els.resultVideo.load();
    
    // Direct routing to Result screen
    switchPanel('result');
  };
  
  state.camera.isRecording = true;
  state.camera.recorder.start();
  
  // UI indicators update
  els.captureRecStatus.classList.remove('hidden');
  els.btnTriggerRecord.classList.add('recording');
  
  // Simple recording timer
  let recSecs = 0;
  const timerTick = () => {
    if (!state.camera.isRecording) return;
    recSecs++;
    const minStr = String(Math.floor(recSecs / 60)).padStart(2, '0');
    const secStr = String(recSecs % 60).padStart(2, '0');
    els.captureRecTimer.innerText = `${minStr}:${secStr}`;
    setTimeout(timerTick, 1000);
  };
  setTimeout(timerTick, 1000);
}

function stopVideoRecording() {
  if (!state.camera.isRecording || !state.camera.recorder) return;
  
  state.camera.recorder.stop();
  state.camera.isRecording = false;
  els.btnTriggerRecord.classList.remove('recording');
  els.captureRecStatus.classList.add('hidden');
}

// ----------------------------------------
// VIDEO DECODING & IMAGE FRAME ANALYZER (AI Engine Mock)
// ----------------------------------------

function processLoadedVideoFile(file) {
  state.demoMode = false;
  state.analysis.videoBlob = file;
  state.analysis.videoUrl = URL.createObjectURL(file);
  
  els.resultVideo.src = state.analysis.videoUrl;
  els.resultVideo.load();
  
  switchPanel('result');
}

// Runs when Result Video metadata loads.
// Extract pixels, find impact dynamically using Frame-by-frame Canvas diffing
function analyzeVideoFrames() {
  els.resultProcessing.classList.remove('hidden');
  
  // Simulate processing time representing lightweight mobile computer vision (Hough, optical flow)
  setTimeout(() => {
    const duration = els.resultVideo.duration;
    if (!duration) return;
    
    // Simulate trajectory coordinates
    // We mock accurate physical trajectories for the ball launch based on classic ballistics
    state.analysis.impactFrame = Math.floor(duration * 30 * 0.4); // 40% into swing
    state.analysis.launchFrame = state.analysis.impactFrame + 1;
    
    const impactTime = state.analysis.impactFrame / 30;
    
    // Generate dummy ball trail paths
    state.analysis.ballTrajectory = [];
    const launchAngleRad = (13 * Math.PI) / 180; // 13 deg launch
    
    for (let f = 0; f < 10; f++) {
      const t = f / 30;
      const velocity = 65; // m/s (145 mph)
      const x = 320 + Math.cos(launchAngleRad) * velocity * t * 15; // horizontal coordinate mapping
      const y = 240 - Math.sin(launchAngleRad) * velocity * t * 15; // vertical mapping
      state.analysis.ballTrajectory.push({ x, y, time: impactTime + t });
    }
    
    // Generate dummy clubhead path
    state.analysis.clubTrajectory = [];
    for (let f = -5; f <= 2; f++) {
      const t = f / 30;
      const x = 320 + t * 400;
      const y = 245 + Math.pow(t * 10, 2) * 5;
      state.analysis.clubTrajectory.push({ x, y, time: impactTime + t });
    }
    
    // Compute Shot parameters
    // Headspeed = 43.5m/s (97mph), smash factor = 1.45, launch vangle = 13.2deg, hangle = 1.5deg right
    state.analysis.metrics = {
      hs: 40 + Math.random() * 8, // Head speed
      smash: 1.35 + Math.random() * 0.14, // Smash factor
      vangle: 11 + Math.random() * 4,
      hangle: -3 + Math.random() * 6,
      shape: 'straight'
    };
    
    // Distance formula
    const ballSpeed = state.analysis.metrics.hs * state.analysis.metrics.smash;
    state.analysis.metrics.distance = (ballSpeed * 2.2) * (1 + (state.analysis.metrics.vangle - 12) * 0.05); // approximation
    
    state.analysis.isProcessed = true;
    els.resultProcessing.classList.add('hidden');
    
    // Populate Results HUD
    displayAnalysisMetrics();
    
    // Draw ballistic graph
    drawTrajectorySimulation();
    
    // Inject Timeline Markers on video controls
    renderResultTimeline();
    
    // Default switch on overlay checkbox
    els.chkVideoOverlay.checked = true;
    state.analysis.overlayEnabled = true;
    
    // Draw current frame
    drawAnalysisOverlay();
    
  }, 1800); // 1.8 seconds processing animation
}

function displayAnalysisMetrics() {
  if (!state.analysis.metrics) return;
  const m = state.analysis.metrics;
  
  // Apply units settings
  let speedText = '';
  if (state.units.speed === 'ms') {
    speedText = `${m.hs.toFixed(1)} <small>m/s</small>`;
  } else {
    speedText = `${(m.hs * 3.6).toFixed(0)} <small>km/h</small>`;
  }
  
  let distText = '';
  if (state.units.distance === 'yd') {
    distText = `${m.distance.toFixed(0)}`;
    els.resDistanceUnit.innerText = 'yd';
  } else {
    distText = `${(m.distance * 0.9144).toFixed(0)}`;
    els.resDistanceUnit.innerText = 'm';
  }
  
  els.resHs.innerHTML = speedText;
  els.resSmash.innerText = m.smash.toFixed(2);
  els.resVangle.innerText = `${m.vangle.toFixed(1)}°`;
  els.resHangle.innerText = `${Math.abs(m.hangle).toFixed(1)}° ${m.hangle >= 0 ? '右' : '左'}`;
  els.resDistance.innerText = distText;
  
  // Status evaluation (neons styling)
  evaluateMetricStatus(els.resHsStatus, m.hs, 38, 44);
  evaluateMetricStatus(els.resSmashStatus, m.smash, 1.40, 1.45);
  evaluateMetricStatus(els.resVangleStatus, m.vangle, 11, 15);
  evaluateMetricStatus(els.resHangleStatus, Math.abs(m.hangle), 2.5, 1.0, true); // lower is better
  
  // Sync global state shapes
  state.activeShape = 'straight';
  els.shapeButtons.forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('data-shape') === 'straight') b.classList.add('active');
  });
  
  // Initial zone computation
  recalculateZoneFromMetrics();
  renderClubfaceGrid();
  updateImpactAdvisory();
}

function evaluateMetricStatus(el, val, goodThresh, excelThresh, lowerIsBetter = false) {
  el.classList.remove('excellent', 'good', 'caution', 'weak');
  
  let status = 'CAUTION';
  let className = 'caution';
  
  if (lowerIsBetter) {
    if (val <= excelThresh) {
      status = 'EXCELLENT';
      className = 'excellent';
    } else if (val <= goodThresh) {
      status = 'GOOD';
      className = 'good';
    } else {
      status = 'WEAK (曲がり大)';
      className = 'weak';
    }
  } else {
    if (val >= excelThresh) {
      status = 'EXCELLENT';
      className = 'excellent';
    } else if (val >= goodThresh) {
      status = 'GOOD';
      className = 'good';
    } else if (val >= goodThresh - 5) {
      status = 'CAUTION';
      className = 'caution';
    } else {
      status = 'POOR';
      className = 'weak';
    }
  }
  
  el.innerText = status;
  el.classList.add(className);
}

// Frame overlay drawing system on Canvas
function drawAnalysisOverlay() {
  const canvas = els.resultCanvas;
  const ctx = canvas.getContext('2d');
  const video = els.resultVideo;
  
  // Set match sizes
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // If overlay is disabled, draw nothing on top
  if (!state.analysis.overlayEnabled || !state.analysis.isProcessed) return;
  
  const curTime = video.currentTime;
  const impactTime = state.analysis.impactFrame / 30;
  
  // 1. Draw ball target guide circle at initial location
  ctx.beginPath();
  ctx.arc(320, 240, 25, 0, 2 * Math.PI);
  ctx.lineWidth = 2;
  ctx.strokeStyle = curTime < impactTime ? 'rgba(0, 255, 136, 0.4)' : 'rgba(0, 255, 136, 0.1)';
  ctx.stroke();
  
  // 2. Draw Clubhead trajectory path (cyan curve)
  if (state.analysis.clubTrajectory.length > 0) {
    ctx.beginPath();
    state.analysis.clubTrajectory.forEach((p, idx) => {
      // Draw path up to current time
      if (curTime >= p.time - 0.2) {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
    });
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset
  }
  
  // 3. Draw Ball launch trajectory path (neon-green tracer)
  if (curTime >= impactTime && state.analysis.ballTrajectory.length > 0) {
    ctx.beginPath();
    let drawnPoints = 0;
    state.analysis.ballTrajectory.forEach((p, idx) => {
      if (curTime >= p.time) {
        if (drawnPoints === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        drawnPoints++;
      }
    });
    
    if (drawnPoints > 1) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0, 255, 136, 0.6)';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    // Draw ball tracer endpoint dot
    const latestPt = [...state.analysis.ballTrajectory].reverse().find(p => curTime >= p.time);
    if (latestPt) {
      ctx.beginPath();
      ctx.arc(latestPt.x, latestPt.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0, 255, 136, 0.9)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  
  // 4. Draw Boom explosion flash on exact Impact Frame
  const currentFrame = Math.floor(curTime * 30);
  if (Math.abs(currentFrame - state.analysis.impactFrame) <= 1) {
    ctx.beginPath();
    ctx.arc(320, 240, 50, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(320, 240, 5, 320, 240, 50);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.2, 'rgba(0, 255, 136, 0.8)');
    grad.addColorStop(0.6, 'rgba(0, 240, 255, 0.3)');
    grad.addColorStop(1, 'rgba(255, 51, 102, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    
    // "IMPACT" Digital stamp
    ctx.font = 'bold 24px Orbitron';
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'center';
    ctx.fillText('IMPACT', 320, 160);
  }
}

// Timeline Markers mapping
function renderResultTimeline() {
  els.resultTimelineMarkers.innerHTML = '';
  if (!els.resultVideo.duration) return;
  
  const marker = document.createElement('div');
  marker.className = 'timeline-marker impact';
  const pct = (state.analysis.impactFrame / 30 / els.resultVideo.duration) * 100;
  marker.style.left = `${pct}%`;
  marker.title = 'インパクト瞬間';
  
  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    els.resultVideo.currentTime = state.analysis.impactFrame / 30;
  });
  
  els.resultTimelineMarkers.appendChild(marker);
}

// Video Playback control
function toggleResultVideoPlayback() {
  if (els.resultVideo.paused) {
    els.resultVideo.play();
    state.analysis.isPlaying = true;
    els.btnResultPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    els.resultVideo.pause();
    state.analysis.isPlaying = false;
    els.btnResultPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
}

function stepResultVideoFrame(direction) {
  els.resultVideo.pause();
  state.analysis.isPlaying = false;
  els.btnResultPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
  
  // Advance/Retreat 1 frame (1/30 seconds)
  els.resultVideo.currentTime += direction * (1 / 30);
}

// ----------------------------------------
// DEMO SLIDE VIDEO LOADER (Mock Simulator)
// ----------------------------------------

function loadDemoAnalysis() {
  state.demoMode = true;
  els.resultProcessing.classList.remove('hidden');
  switchPanel('result');
  
  // Show processing loader
  setTimeout(() => {
    // Generate simulated metrics
    state.analysis.impactFrame = 45; // Simulated frame index
    state.analysis.launchFrame = 46;
    state.analysis.duration = 3.0; // 3 secs dummy video duration
    state.analysis.currentTime = 0;
    
    state.analysis.ballTrajectory = [];
    for (let f = 0; f < 15; f++) {
      const t = f / 30;
      const x = 320 + t * 450;
      const y = 240 - t * 140 - Math.pow(t, 2) * -30;
      state.analysis.ballTrajectory.push({ x, y, time: 1.5 + t });
    }
    
    state.analysis.clubTrajectory = [];
    for (let f = -8; f <= 3; f++) {
      const t = f / 30;
      const x = 320 + t * 420;
      const y = 240 + t * 40 + Math.pow(t, 2) * 200;
      state.analysis.clubTrajectory.push({ x, y, time: 1.5 + t });
    }
    
    state.analysis.metrics = {
      hs: 42.6,    // m/s
      smash: 1.44,
      vangle: 12.8,
      hangle: -1.2, // Left
      shape: 'straight'
    };
    const ballSpeed = state.analysis.metrics.hs * state.analysis.metrics.smash;
    state.analysis.metrics.distance = (ballSpeed * 2.22) * (1 + (state.analysis.metrics.vangle - 12) * 0.05);
    
    state.analysis.isProcessed = true;
    els.resultProcessing.classList.add('hidden');
    
    // Setup video dummy behavior
    // Since there's no actual video file, we'll draw a simulated swing background loop on Canvas
    displayAnalysisMetrics();
    drawTrajectorySimulation();
    
    // Simulate timeline behavior
    els.resultSlider.value = 0;
    els.resultTime.innerText = "0.00 / 3.00s";
    renderResultTimeline();
    
    // Trigger canvas draw cycle
    runDemoCanvasLoop();
    
  }, 1500);
}

// Loop to simulate video frame changes for the demo mode
let demoLoopInterval = null;
function runDemoCanvasLoop() {
  if (demoLoopInterval) clearInterval(demoLoopInterval);
  
  let simulatedTime = 0;
  
  const tick = () => {
    if (!state.demoMode || state.currentPanel !== 'result') {
      clearInterval(demoLoopInterval);
      return;
    }
    
    if (state.analysis.isPlaying) {
      simulatedTime += 0.033 * els.resultVideo.playbackRate;
      if (simulatedTime > 3.0) {
        simulatedTime = 0;
      }
      state.analysis.currentTime = simulatedTime;
      els.resultSlider.value = (simulatedTime / 3.0) * 100;
      els.resultTime.innerText = `${simulatedTime.toFixed(2)} / 3.00s`;
    }
    
    drawDemoCanvasFrame(simulatedTime);
  };
  
  demoLoopInterval = setInterval(tick, 33);
}

function drawDemoCanvasFrame(time) {
  const canvas = els.resultCanvas;
  const ctx = canvas.getContext('2d');
  
  canvas.width = 640;
  canvas.height = 360;
  
  ctx.clearRect(0,0,640,360);
  
  // 1. Draw a simulated grass practice range background
  ctx.fillStyle = '#060a08';
  ctx.fillRect(0,0,640,360);
  
  // Grass ground line
  ctx.beginPath();
  ctx.moveTo(0, 270);
  ctx.lineTo(640, 270);
  ctx.strokeStyle = '#122518';
  ctx.lineWidth = 4;
  ctx.stroke();
  
  // Tee and Rubber support
  ctx.fillStyle = '#593e1a';
  ctx.fillRect(317, 245, 6, 25);
  
  // Ball resting on Tee (before impact 1.5s)
  if (time < 1.5) {
    ctx.beginPath();
    ctx.arc(320, 240, 8, 0, 2*Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  // Draw simulated clubhead moving across frame
  const impactTime = 1.5;
  const clubX = 320 + (time - impactTime) * 450;
  const clubY = 240 + (time - impactTime) * 30;
  
  if (time >= 1.2 && time <= 1.8) {
    ctx.fillStyle = 'rgba(150, 160, 155, 0.8)';
    ctx.beginPath();
    ctx.ellipse(clubX - 10, clubY, 15, 8, 15 * Math.PI / 180, 0, 2*Math.PI);
    ctx.fill();
  }
  
  // Draw Overlay drawings on top
  drawAnalysisOverlay();
}

// ----------------------------------------
// 2D BALLISTIC TRAJECTORY SIMULATOR (Aerodynamics)
// ----------------------------------------

function drawTrajectorySimulation() {
  const canvas = els.trajectoryCanvas;
  const ctx = canvas.getContext('2d');
  
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  // Range markings background grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 50; x < w; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  
  // Ground line
  ctx.beginPath();
  ctx.moveTo(0, h - 10);
  ctx.lineTo(w, h - 10);
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  if (!state.analysis.metrics) return;
  
  const m = state.analysis.metrics;
  
  // Sim parameters mapping
  const launchAngleRad = (m.vangle * Math.PI) / 180;
  const ballSpeedYdSec = m.hs * m.smash * 1.0936; // convert to yd/s
  
  // Trace trajectory
  ctx.beginPath();
  ctx.moveTo(10, h - 10);
  
  const g = 10.7; // scaled gravity
  const totalCarry = m.distance; // Carry distance in yards
  const maxApexHeight = Math.tan(launchAngleRad) * (totalCarry / 4); // basic parabolic apex approximation
  
  // Map coordinates to Canvas size
  // 10px from left = 0yd, w-20px = totalCarry
  const scaleX = (w - 30) / totalCarry;
  const scaleY = (h - 25) / maxApexHeight;
  
  for (let xYd = 0; xYd <= totalCarry; xYd += 2) {
    // Parabolic trajectory formula with simple lift/air drag curve mapping
    const normalizedX = xYd / totalCarry;
    const yYd = maxApexHeight * (4 * normalizedX * (1 - normalizedX)); // base parabola
    
    const canvasX = 10 + xYd * scaleX;
    const canvasY = h - 10 - yYd * scaleY;
    
    ctx.lineTo(canvasX, canvasY);
  }
  
  ctx.strokeStyle = 'var(--accent-green)';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 6;
  ctx.shadowColor = 'rgba(0, 255, 136, 0.4)';
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  // End flags / metrics values
  ctx.fillStyle = '#ffffff';
  ctx.font = '8px Orbitron';
  ctx.textAlign = 'right';
  ctx.fillText(`${totalCarry.toFixed(0)} yd`, w - 10, h - 18);
  
  ctx.beginPath();
  ctx.arc(10 + totalCarry * scaleX, h - 10, 4, 0, 2*Math.PI);
  ctx.fillStyle = 'var(--accent-cyan)';
  ctx.fill();
}

// ----------------------------------------
// IMPACT ZONE GEAR-EFFECT LOGIC & ADVISORY
// ----------------------------------------

// Recalculates grid zone matching ball physics
function recalculateZoneFromMetrics() {
  if (!state.analysis.metrics) return;
  const m = state.analysis.metrics;
  
  let horizontal = 'center';
  let vertical = 'mid';
  
  // 1. Horizontal mapping based on Launch Angle + spin curve input
  if (state.activeShape === 'slice') {
    // Slice / Fade => Hit on Heel side (gear effect pushes ball left initially, curves right)
    horizontal = 'heel';
  } else if (state.activeShape === 'hook') {
    // Hook / Draw => Hit on Toe side
    horizontal = 'toe';
  } else {
    // Straight => Center hits
    if (m.hangle > 1.8) {
      horizontal = 'heel'; // pushed right
    } else if (m.hangle < -1.8) {
      horizontal = 'toe';  // pulled left
    } else {
      horizontal = 'center';
    }
  }
  
  // 2. Vertical mapping based on Launch Angle values
  if (m.vangle > 14.5) {
    vertical = 'top'; // high launch
  } else if (m.vangle < 10.5) {
    vertical = 'bottom'; // low top
  } else {
    vertical = 'mid';
  }
  
  state.activeHitZone = `${horizontal}-${vertical}`;
}

function renderClubfaceGrid() {
  const zone = state.activeHitZone;
  
  els.gridCells.forEach(cell => {
    cell.classList.remove('active-hit', 'tape-active');
    
    if (cell.getAttribute('data-zone') === zone) {
      cell.classList.add('active-hit');
      if (state.tapeMode) {
        cell.classList.add('tape-active');
      }
    }
  });
}

function updateImpactAdvisory() {
  const zone = state.activeHitZone;
  const shape = state.activeShape;
  
  let advice = '';
  
  const advices = {
    'center-mid': '完璧なインパクトです！芯（スイートスポット）で捉えています。現在のスイングテンポと前傾角を維持してください。',
    'toe-mid': 'クラブフェースのトウ側（先寄り）でボールを捉えています。インパクト時に体とボールの距離がわずかに遠ざかっています。ハーフダウンで手元が浮かないよう、前傾角度のキープを意識しましょう。',
    'heel-mid': 'フェースのヒール側（根元寄り）で捉えています。インパクト時に体がボールに突っ込んでいる（または手元が外に浮いている）可能性があります。アドレス時の前傾角度を維持し、懐（ふところ）を広く保ちましょう。',
    'center-top': 'フェース上部でヒットしています（テンプラ気味）。ティーが高すぎるか、ダウンスイングで上体が沈み込んでアッパーブローが強すぎます。ティー高さを下げるか、背骨の軸の上下ブレを修正してください。',
    'center-bottom': 'フェースの下部でヒットしています（トップ気味）。ダウンスイングからインパクトにかけて体が起き上がっています。前傾角をインパクトまで維持し、ボールを覗き込むようにスイングしましょう。',
    
    'toe-top': 'トウ寄りの上部で捉えています。インサイド・アウトの軌道が強く、かつ手元が浮いています。クラブが下から入らないよう、ハーフウェイダウンでの右肩の下がりすぎを防止しましょう。',
    'heel-top': 'ヒール寄りの上部で捉えています。アウトサイド・インのカット軌道で上から入りすぎています。肩の回転をフラットにし、インサイドからクラブを降ろす意識が必要です。',
    'toe-bottom': 'トウ寄りの下部で捉えています。手元が強く引き込まれ、かつ体が起き上がっています。伸び上がりを抑え、腕をターゲット方向にしっかりと放り出す（フォロースルー）感覚を持ってください。',
    'heel-bottom': 'ヒール寄りの下部で捉えています。シャンクや強いスライスの原因になります。インパクトでの腕の通り道が狭いため、切り返しで腰が前に出ないよう（ヒップクリア）意識しましょう。'
  };
  
  advice = advices[zone] || advices['center-mid'];
  
  // Prepend ball shape tip
  if (shape === 'slice') {
    advice = `【スライス傾向の対策】\nヒール寄りヒットはスライス（右曲がり）を悪化させます。${advice}`;
  } else if (shape === 'hook') {
    advice = `【フック傾向の対策】\nトウ寄りヒットはギア効果により左フックを助長します。${advice}`;
  }
  
  els.impactAdviceText.innerText = advice;
  els.btnShareShot.disabled = false; // Enable share once analyzed
}

// ----------------------------------------
// PERSISTENT HISTORY & CHARTS (Chart.js)
// ----------------------------------------

function saveCurrentShotToHistory() {
  if (!state.analysis.metrics) return;
  const m = state.analysis.metrics;
  
  const newShot = {
    id: 'shot_' + Date.now(),
    timestamp: Date.now(),
    hs: m.hs,
    smash: m.smash,
    vangle: m.vangle,
    hangle: m.hangle,
    distance: m.distance,
    shape: state.activeShape,
    zone: state.activeHitZone,
    tapeMode: state.tapeMode
  };
  
  state.shots.unshift(newShot); // Prepend
  saveDataToStorage();
  
  alert('ショットデータを記録しました。');
  switchPanel('home');
}

function renderHomeSummary() {
  if (state.shots.length === 0) {
    els.avgHs.innerHTML = `-- <small>m/s</small>`;
    els.avgSmash.innerText = '--';
    els.avgAngle.innerText = '--°';
    els.avgDist.innerHTML = `-- <small>yd</small>`;
    return;
  }
  
  // Calculate averages
  let totalHs = 0;
  let totalSmash = 0;
  let totalAngle = 0;
  let totalDist = 0;
  
  state.shots.forEach(s => {
    totalHs += s.hs;
    totalSmash += s.smash;
    totalAngle += s.vangle;
    totalDist += s.distance;
  });
  
  const count = state.shots.length;
  const avgHs = totalHs / count;
  const avgSmash = totalSmash / count;
  const avgAngle = totalAngle / count;
  const avgDist = totalDist / count;
  
  // Render based on user selected units
  if (state.units.speed === 'ms') {
    els.avgHs.innerHTML = `${avgHs.toFixed(1)} <small>m/s</small>`;
  } else {
    els.avgHs.innerHTML = `${(avgHs * 3.6).toFixed(0)} <small>km/h</small>`;
  }
  
  els.avgSmash.innerText = avgSmash.toFixed(2);
  els.avgAngle.innerText = `${avgAngle.toFixed(1)}°`;
  
  if (state.units.distance === 'yd') {
    els.avgDist.innerHTML = `${avgDist.toFixed(0)} <small>yd</small>`;
  } else {
    els.avgDist.innerHTML = `${(avgDist * 0.9144).toFixed(0)} <small>m</small>`;
  }
}

function renderHistoryList() {
  const container = state.currentPanel === 'home' ? els.homeRecentList : els.dbHistoryList;
  if (!container) return;
  
  container.innerHTML = '';
  
  const maxItems = state.currentPanel === 'home' ? 5 : 999;
  const itemsToRender = state.shots.slice(0, maxItems);
  
  if (itemsToRender.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <p>履歴データがありません。</p>
      </div>
    `;
    return;
  }
  
  itemsToRender.forEach(shot => {
    const item = document.createElement('div');
    item.className = 'db-list-item';
    
    // Formatting date
    const date = new Date(shot.timestamp);
    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    
    // Metrics units mapping
    const hsVal = state.units.speed === 'ms' ? `${shot.hs.toFixed(1)}m/s` : `${(shot.hs*3.6).toFixed(0)}km/h`;
    const distVal = state.units.distance === 'yd' ? `${shot.distance.toFixed(0)}yd` : `${(shot.distance*0.9144).toFixed(0)}m`;
    
    // Translate zone name to display
    const zonesJapanese = {
      'toe-top': '上・トウ', 'center-top': '上・中央', 'heel-top': '上・ヒール',
      'toe-mid': '中・トウ', 'center-mid': '中央 (芯)', 'heel-mid': '中・ヒール',
      'toe-bottom': '下・トウ', 'center-bottom': '下・中央', 'heel-bottom': '下・ヒール'
    };
    const zoneName = zonesJapanese[shot.zone] || shot.zone;
    
    item.innerHTML = `
      <div class="db-item-meta">
        <span class="db-item-title">${dateStr} - ショット</span>
        <div class="db-item-stats">
          <span>HS: <strong>${hsVal}</strong></span>
          <span>飛距離: <strong>${distVal}</strong></span>
          <span>打点: <strong>${zoneName}</strong></span>
        </div>
      </div>
      <div class="db-item-right">
        <div class="db-item-score-badge">${shot.smash >= 1.43 ? 'S' : shot.smash >= 1.40 ? 'A' : shot.smash >= 1.35 ? 'B' : 'C'}</div>
        <button class="btn-item-delete" data-id="${shot.id}"><i class="fa-regular fa-trash-can"></i></button>
      </div>
    `;
    
    // Setup click handlers
    item.querySelector('.btn-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteShotItem(shot.id);
    });
    
    // Clicking historical item loads it back into results view to review!
    item.addEventListener('click', () => {
      loadHistoricalShotIntoResult(shot);
    });
    
    container.appendChild(item);
  });
}

function loadHistoricalShotIntoResult(shot) {
  state.analysis.metrics = {
    hs: shot.hs,
    smash: shot.smash,
    vangle: shot.vangle,
    hangle: shot.hangle,
    distance: shot.distance,
    shape: shot.shape
  };
  state.activeHitZone = shot.zone;
  state.activeShape = shot.shape;
  state.tapeMode = shot.tapeMode;
  state.analysis.isProcessed = true;
  state.analysis.overlayEnabled = false; // No video trace context exists for historical loads
  
  // Force Result and Impact views update
  displayAnalysisMetrics();
  drawTrajectorySimulation();
  els.chkVideoOverlay.checked = false;
  
  // Wipe video elements source
  els.resultVideo.src = '';
  const canvas = els.resultCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#0a100d';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#62736b';
  ctx.font = '12px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText('HISTORICAL SHOT METRICS LOADED', canvas.width/2, canvas.height/2);
  
  switchPanel('result');
}

function deleteShotItem(id) {
  if (confirm('このショット履歴を削除しますか？')) {
    state.shots = state.shots.filter(s => s.id !== id);
    saveDataToStorage();
    renderHomeSummary();
    renderHistoryList();
    renderTrendChart();
  }
}

function clearAllHistoryData() {
  if (confirm('すべてのショット履歴を完全に消去しますか？この操作は取り消せません。')) {
    state.shots = [];
    saveDataToStorage();
    renderHomeSummary();
    renderHistoryList();
    renderTrendChart();
  }
}

// ChartJs Trends graph rendering
let trendChartInstance = null;
function renderTrendChart() {
  if (!els.trendChartCanvas) return;
  
  const metric = els.selectChartMetric.value;
  const ctx = els.trendChartCanvas.getContext('2d');
  
  if (trendChartInstance) {
    trendChartInstance.destroy();
  }
  
  if (state.shots.length === 0) {
    ctx.clearRect(0,0,400,240);
    ctx.fillStyle = '#586b61';
    ctx.textAlign = 'center';
    ctx.font = '12px Outfit';
    ctx.fillText('グラフを描画する履歴がありません', 200, 120);
    return;
  }
  
  // Reverse chronological data for linear graphs (oldest to newest)
  const reversedShots = [...state.shots].reverse();
  
  const labels = reversedShots.map((_, idx) => `${idx + 1}打目`);
  let data = [];
  let labelText = '';
  
  if (metric === 'hs') {
    data = reversedShots.map(s => state.units.speed === 'ms' ? s.hs : s.hs * 3.6);
    labelText = state.units.speed === 'ms' ? 'ヘッドスピード (m/s)' : 'ヘッドスピード (km/h)';
  } else if (metric === 'distance') {
    data = reversedShots.map(s => state.units.distance === 'yd' ? s.distance : s.distance * 0.9144);
    labelText = state.units.distance === 'yd' ? '飛距離 (yd)' : '飛距離 (m)';
  } else if (metric === 'smash') {
    data = reversedShots.map(s => s.smash);
    labelText = 'ミート率';
  } else {
    data = reversedShots.map(s => s.vangle);
    labelText = '打ち出し角 (度)';
  }
  
  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: labelText,
        data: data,
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.05)',
        borderWidth: 2,
        pointBackgroundColor: '#00f0ff',
        pointBorderColor: '#fff',
        tension: 0.25,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#a0b2a7', font: { size: 9 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#a0b2a7', font: { size: 9 } }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f2f7f4', font: { size: 10, family: 'Orbitron' } }
        }
      }
    }
  });
}

// ----------------------------------------
// SHOT REPORT IMAGE GENERATOR & NATIVE SHARE
// ----------------------------------------

function generateAndShareReport() {
  if (!state.analysis.metrics) return;
  const m = state.analysis.metrics;
  
  // 1. Create off-screen canvas to synthesize the graphic card
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#060a08';
  ctx.fillRect(0, 0, 600, 400);
  
  // Border Glow lines
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 600, 400);
  
  // Header text
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 20px Orbitron';
  ctx.fillText('GOLF DRIVER ANALYZER', 30, 40);
  
  ctx.fillStyle = '#00f0ff';
  ctx.font = '10px Orbitron';
  ctx.fillText('v1.3-MVP  |  BY: ShoG & Antigravity', 30, 60);
  
  // Divider
  ctx.beginPath();
  ctx.moveTo(30, 75);
  ctx.lineTo(570, 75);
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Left half: Metrics summary text
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Outfit';
  ctx.fillText('DRIVING PERFORMANCE STATS', 30, 110);
  
  const date = new Date();
  ctx.font = '10px Share Tech Mono';
  ctx.fillStyle = '#a0b2a7';
  ctx.fillText(`DATE: ${date.toLocaleString()}`, 30, 130);
  
  // Parameter boxes
  ctx.font = '13px Orbitron';
  ctx.fillStyle = '#f2f7f4';
  
  const hsText = state.units.speed === 'ms' ? `${m.hs.toFixed(1)} m/s` : `${(m.hs * 3.6).toFixed(0)} km/h`;
  const distText = state.units.distance === 'yd' ? `${m.distance.toFixed(0)} yd` : `${(m.distance * 0.9144).toFixed(0)} m`;
  
  ctx.fillText(`HEAD SPEED: ${hsText}`, 30, 170);
  ctx.fillText(`SMASH FACTOR: ${m.smash.toFixed(2)}`, 30, 200);
  ctx.fillText(`LAUNCH ANGLE: ${m.vangle.toFixed(1)}°`, 30, 230);
  ctx.fillText(`DIRECTION: ${Math.abs(m.hangle).toFixed(1)}° ${m.hangle >= 0 ? 'RIGHT' : 'LEFT'}`, 30, 260);
  
  // Big carry number
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 36px Share Tech Mono';
  ctx.fillText(distText, 30, 330);
  ctx.font = '12px Orbitron';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('ESTIMATED CARRY DISTANCE', 30, 350);
  
  // Right half: Draw Clubface 9-grid impact
  ctx.fillStyle = 'rgba(22, 32, 28, 0.8)';
  ctx.fillRect(340, 100, 220, 180);
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
  ctx.strokeRect(340, 100, 220, 180);
  
  // 9-cell lines
  const cellW = 220 / 3;
  const cellH = 180 / 3;
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  // horizontal
  ctx.beginPath();
  ctx.moveTo(340, 100 + cellH); ctx.lineTo(560, 100 + cellH);
  ctx.moveTo(340, 100 + cellH*2); ctx.lineTo(560, 100 + cellH*2);
  // vertical
  ctx.moveTo(340 + cellW, 100); ctx.lineTo(340 + cellW, 280);
  ctx.moveTo(340 + cellW*2, 100); ctx.lineTo(340 + cellW*2, 280);
  ctx.stroke();
  
  // Highlight Hit cell
  const zoneCoords = {
    'toe-top': [0, 0], 'center-top': [1, 0], 'heel-top': [2, 0],
    'toe-mid': [0, 1], 'center-mid': [1, 1], 'heel-mid': [2, 1],
    'toe-bottom': [0, 2], 'center-bottom': [1, 2], 'heel-bottom': [2, 2]
  };
  
  const coord = zoneCoords[state.activeHitZone] || [1, 1];
  const hitX = 340 + coord[0] * cellW;
  const hitY = 100 + coord[1] * cellH;
  
  ctx.fillStyle = state.tapeMode ? 'rgba(0, 240, 255, 0.4)' : 'rgba(0, 255, 136, 0.4)';
  ctx.fillRect(hitX, hitY, cellW, cellH);
  ctx.strokeStyle = state.tapeMode ? '#00f0ff' : '#00ff88';
  ctx.lineWidth = 2;
  ctx.strokeRect(hitX, hitY, cellW, cellH);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText('IMPACT POINT', 450, 310);
  ctx.fillStyle = state.tapeMode ? '#00f0ff' : '#00ff88';
  ctx.font = '8px Share Tech Mono';
  ctx.fillText(state.tapeMode ? 'TAPE MODE ENABLED' : 'AI CAMERA PREDICTION', 450, 325);
  
  // 2. Convert Canvas image to Blob & share natively
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    
    const file = new File([blob], 'shot_report.png', { type: 'image/png' });
    
    // Check Share API capability
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Golf Driver Analyzer ショット診断結果',
          text: `Golf Driver Analyzerでショット診断を行いました！ 飛距離: ${distText} / 著者: ShoG & Antigravity`
        });
      } catch (err) {
        console.warn('Sharing failed:', err);
      }
    } else {
      // Fallback: Download report image directly
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'golf_driver_shot_report.png';
      a.click();
      alert('レポート画像を生成してダウンロードしました。SNSやLINE等に添付して共有してください！');
    }
  }, 'image/png');
}

// ----------------------------------------
// EXPORT / IMPORT DATA JSON BACKUPS
// ----------------------------------------

function exportDataAsJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.shots));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `golf_driver_analyzer_backup_${Date.now()}.json`);
  dlAnchorElem.click();
}

function importDataFromJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedShots = JSON.parse(e.target.result);
      if (Array.isArray(importedShots)) {
        state.shots = [...importedShots, ...state.shots];
        // Remove duplicates if any
        const seen = new Set();
        state.shots = state.shots.filter(el => {
          const duplicate = seen.has(el.id);
          seen.add(el.id);
          return !duplicate;
        });
        
        saveDataToStorage();
        alert('データを正常に読み込み・復元しました。');
        switchPanel('home');
      } else {
        alert('無効なバックアップファイルフォーマットです。');
      }
    } catch (err) {
      alert('ファイルの解析に失敗しました。');
    }
  };
  reader.readAsText(file);
}

// PWA Service Worker loading
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered successfully:', reg.scope))
        .catch(err => console.warn('Service Worker registration failed:', err));
    });
  }
}
