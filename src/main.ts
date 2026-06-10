import { CatchTransaction, FishSpecies, SupplyChainStage } from './types';
import { getCatches, saveCatch, updateCatchStatus, addStageToCatch, getQuotas, verifyBlockchainIntegrity } from './db';
import { runAIEstimation, checkCatchLimits, OcuQuotaShare, OcuLock, executeLiveSatelliteAudit } from './backend';

declare const L: any;
declare const jsQR: any;

let globalPassportMap: any = null;
let globalAdminMap: any = null;

let qrScanStream: MediaStream | null = null;
let qrScanAnimationId: number | null = null;

function stopQRScanning() {
  if (qrScanStream) {
    qrScanStream.getTracks().forEach(track => track.stop());
    qrScanStream = null;
  }
  if (qrScanAnimationId) {
    cancelAnimationFrame(qrScanAnimationId);
    qrScanAnimationId = null;
  }
}

function startQRScanning(video: HTMLVideoElement, onDecoded: (data: string) => void) {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      qrScanStream = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.play();
      
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      function scanFrame() {
        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          
          if (code && code.data) {
            stopQRScanning();
            onDecoded(code.data);
            return;
          }
        }
        qrScanAnimationId = requestAnimationFrame(scanFrame);
      }
      qrScanAnimationId = requestAnimationFrame(scanFrame);
    })
    .catch(err => {
      console.warn("Camera access denied or failed for QR scanning:", err);
      setTimeout(() => {
        const catches = getCatches();
        if (catches.length > 0) {
          stopQRScanning();
          onDecoded(catches[0].id);
        }
      }, 4000);
    });
}

const Session = {
  getCurrentUser(): { username: string; vessel: string; status: 'approved' | 'pending' | 'suspended' } | null {
    try {
      return JSON.parse(sessionStorage.getItem('oc_user') || 'null');
    } catch {
      return null;
    }
  },
  setCurrentUser(u: { username: string; vessel: string; status: 'approved' | 'pending' | 'suspended' } | null) {
    if (u) {
      sessionStorage.setItem('oc_user', JSON.stringify(u));
    } else {
      sessionStorage.removeItem('oc_user');
    }
  },
  isAdminLoggedIn(): boolean {
    return sessionStorage.getItem('oc_admin') === 'true';
  },
  setAdminLoggedIn(val: boolean) {
    if (val) {
      sessionStorage.setItem('oc_admin', 'true');
    } else {
      sessionStorage.removeItem('oc_admin');
    }
  },
  logout() {
    this.setCurrentUser(null);
    this.setAdminLoggedIn(false);
  }
};

const DEFAULT_STAGES = (_id: string, dateStr: string): SupplyChainStage[] => [
  {
    stageId: 1,
    name: "Sea Catch Registration",
    location: "Mangystau Caspian Sector C-1",
    checkedBy: "Autonomous GPS telemetry",
    timestamp: dateStr,
    verificationType: "QR_Verification_Scan"
  },
  {
    stageId: 2,
    name: "Port Bautino Checkpoint",
    location: "Bautino Harbor Inspector Office",
    checkedBy: "Inspector A. Bekova",
    timestamp: "",
    verificationType: "MultiSig_Bluetooth"
  },
  {
    stageId: 3,
    name: "Processing Guard Facility",
    location: "Aktau Fish Processing Facility",
    checkedBy: "Officer D. Nurmagambetov",
    timestamp: "",
    verificationType: "Digital_Stamp_Approval"
  }
];

const Router = {
  routes: {} as Record<string, () => HTMLElement>,
  currentPath: '/passport',

  register(path: string, handler: () => HTMLElement) {
    this.routes[path] = handler;
  },

  navigate(path: string, pushState = true) {
    const clean = path.startsWith('/') ? path : '/' + path;
    if (pushState && this.currentPath !== clean) {
      history.pushState({ path: clean }, '', clean);
    }
    this.render(clean);
  },

  render(path: string) {
    const isLocked = localStorage.getItem('ocu_lock_active') === 'true';
    const container = document.getElementById('page-container');
    
    if (container) {
      container.innerHTML = '';
      if (isLocked) {
        container.appendChild(renderOcuLockScreen());
        this._updateNav('/idx-control');
        return;
      }

      const integrity = verifyBlockchainIntegrity();
      if (!integrity.valid) {
        OcuLock();
        container.appendChild(renderOcuLockScreen());
        this._updateNav('/idx-control');
        return;
      }

      const [cleanPath, queryString] = path.split('?');
      const route = this.routes[cleanPath] || this.routes['/passport'];
      
      (window as any)._currentRouteQuery = new URLSearchParams(queryString || "");

      this.currentPath = path;
      container.appendChild(route());
    }
    const [cleanNavPath] = path.split('?');
    this._updateNav(cleanNavPath);
    window.scrollTo(0, 0);
  },

  _updateNav(path: string) {
    document.querySelectorAll('.header-nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === path);
    });
  },

  init() {
    window.addEventListener('popstate', (e) => {
      const path = e.state?.path || window.location.pathname;
      this.render(path);
    });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const a = target.closest('[data-route]');
      if (a) {
        e.preventDefault();
        const routeAttr = a.getAttribute('data-route');
        if (routeAttr) this.navigate(routeAttr);
      }
    });

    const initial = window.location.pathname || '/passport';
    this.render(initial === '/' ? '/passport' : initial);
  }
};

function renderOcuLockScreen(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'container fade-in';
  container.style.maxWidth = '600px';
  container.style.margin = '80px auto';
  container.style.textAlign = 'center';
  container.innerHTML = `
    <div class="card" style="padding: 40px; border-radius: 16px; border: 2px solid #EF4444; background: #FFF5F5;">
      <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
      <h2 style="color: #EF4444; font-weight: 800; font-size: 24px; margin-bottom: 16px;">OcuLock System Freeze Active</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
        A cryptographic integrity breach has been detected in the OcuChain ledger database files. 
        All fishing profiles for this vessel have been temporarily suspended to protect against data tampering.
      </p>
      <button id="btn-reset-system" class="btn btn-primary" style="background: #1E3A8A;">
        System Reboot & Re-verify Ledger
      </button>
    </div>
  `;
  const btnReset = container.querySelector('#btn-reset-system') as HTMLButtonElement | null;
  if (btnReset) {
    btnReset.onclick = () => {
      localStorage.removeItem('ocu_lock_active');
      localStorage.removeItem('oc_catches');
      localStorage.removeItem('oc_quotas');
      window.location.reload();
    };
  }
  return container;
}

function PassportPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  const query = (window as any)._currentRouteQuery as URLSearchParams | undefined;
  let activeRecordId = query ? query.get('id') || "" : "";

  function renderView() {
    if (!activeRecordId) {
      renderSearchDashboard();
    } else {
      const records = getCatches();
      const match = records.find(r => r.id === activeRecordId);
      if (match) {
        renderPassportSheet(match);
      } else {
        activeRecordId = "";
        renderSearchDashboard();
      }
    }
  }

  function renderSearchDashboard() {
    container.innerHTML = `
      <div class="card" style="max-width: 500px; margin: 40px auto; padding: 32px; border-radius: 16px; box-shadow: var(--shadow-md);">
        <h2 style="font-size: 20px; font-weight: 800; color: #1E3A8A; text-align: center; margin-bottom: 8px;">Digital Fish Traceability Lookup</h2>
        <p style="color: #475569; font-size: 13px; text-align: center; margin-bottom: 24px;">Fish Resources Department of Mangystau Region</p>
        
        <div class="form-group" style="margin-bottom: 24px;">
          <label class="form-label">Enter OcuCast ID Manually</label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="manual-passport-id" class="form-input" placeholder="e.g. OC-2026-0001" value="OC-2026-0001">
            <button id="btn-retrieve-manual" class="btn btn-primary" style="background: #1E3A8A; white-space: nowrap;">Retrieve</button>
          </div>
        </div>
        <div style="text-align: center; margin-bottom: 20px; color: var(--text-muted); font-size: 14px;">— OR —</div>
        <button id="btn-scan-qr-passport" class="btn btn-cyan btn-block" style="background: #06B6D4; color: white;">Scan Passport QR Code</button>
      </div>

      <div id="qr-scanner-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); flex-direction: column; align-items: center; justify-content: center; z-index: 2000;">
        <div class="card" style="padding: 24px; text-align: center; max-width: 400px; background: white; border-radius: 16px;">
          <h3 style="font-size: 18px; font-weight: 800; color: #1E3A8A; margin-bottom: 12px;">Active Scanner Device Stream</h3>
          <p style="font-size: 13px; color: #475569; margin-bottom: 20px;">Positioning optical sensor calibration camera...</p>
          <div style="width: 280px; height: 200px; background: #000; border-radius: 8px; margin: 0 auto 20px; position: relative; overflow: hidden;">
            <video id="passport-scan-video" style="width: 100%; height: 100%; object-fit: cover;"></video>
            <div style="position: absolute; inset: 20px; border: 2px dashed #06B6D4; pointer-events: none;"></div>
          </div>
          <button id="btn-cancel-scan" class="btn btn-ghost">Cancel</button>
        </div>
      </div>
    `;

    const btnRetrieve = container.querySelector('#btn-retrieve-manual') as HTMLButtonElement | null;
    const txtInput = container.querySelector('#manual-passport-id') as HTMLInputElement | null;
    if (btnRetrieve && txtInput) {
      btnRetrieve.onclick = () => {
        const id = txtInput.value.trim();
        const catches = getCatches();
        const found = catches.some(c => c.id === id);
        if (found) {
          activeRecordId = id;
          renderView();
        } else {
          alert('Traceability code not recognized on ledger.');
        }
      };
    }

    const btnScan = container.querySelector('#btn-scan-qr-passport') as HTMLButtonElement | null;
    const scanOverlay = container.querySelector('#qr-scanner-overlay') as HTMLElement | null;
    const btnCancelScan = container.querySelector('#btn-cancel-scan') as HTMLButtonElement | null;

    if (btnScan && scanOverlay) {
      btnScan.onclick = () => {
        scanOverlay.style.display = 'flex';
        const video = container.querySelector('#passport-scan-video') as HTMLVideoElement | null;
        if (video) {
          startQRScanning(video, (decodedId) => {
            scanOverlay.style.display = 'none';
            let cleanId = decodedId;
            if (decodedId.includes("id=")) {
              cleanId = decodedId.split("id=")[1].split("&")[0];
            }
            activeRecordId = cleanId;
            renderView();
          });
        }
      };
    }

    if (btnCancelScan && scanOverlay) {
      btnCancelScan.onclick = () => {
        stopQRScanning();
        scanOverlay.style.display = 'none';
      };
    }
  }

  function renderPassportSheet(c: CatchTransaction) {
    const timelineHtml = c.stages.map((step) => {
      const isDone = !!step.timestamp;
      const dotClass = isDone ? 'done' : 'pending';
      const icon = step.stageId === 1 ? '⚓' : step.stageId === 2 ? '🏗️' : '🏭';

      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}">
            ${isDone ? '✓' : icon}
          </div>
          <div class="timeline-time">${step.timestamp ? new Date(step.timestamp).toLocaleString('en-US') : 'In queue'}</div>
          <div class="timeline-title">${step.name}</div>
          <div class="timeline-desc">
            ${isDone 
              ? `Checked by: <strong>${step.checkedBy}</strong>. Location: <strong>${step.location}</strong>. [${step.verificationType}]` 
              : 'Awaiting checkpoint clearance.'}
          </div>
        </div>
      `;
    }).join('');

    const statusColors: Record<string, string> = {
      Verified: 'badge-green',
      Suspicious: 'badge-amber',
      Blocked: 'badge-red',
      Pending: 'badge-blue'
    };

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
        <div>
          <button id="btn-back-to-search" class="btn btn-ghost btn-sm" style="margin-bottom: 8px;">← New Search</button>
          <h1 style="font-size: 24px; font-weight: 800; color: #1E3A8A; letter-spacing: -0.5px;">Digital Fish Passport</h1>
          <p style="color: #475569; font-size: 13px;">Official traceability ledger records - Mangystau Region</p>
        </div>
        <div>
          <button id="btn-download-pdf-passport" class="btn btn-primary" style="background: #1E3A8A;">📥 Download Official Certificate</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 32px;" class="passport-grid">
        
        <div class="card" style="border: 1.5px solid #E2E8F0; border-radius: 16px;">
          <div style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; padding: 20px; text-align: center;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Mangystau Region Fish Resources Department</div>
            <div style="font-size: 13px; font-weight: 700; color: #1E3A8A; margin-top: 4px;">OFFICIAL BIOLOGICAL RESOURCES CERTIFICATE OF ORIGIN</div>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px dashed #E2E8F0;">
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Batch ID:</span>
                <div style="font-size: 15px; font-weight: 800; color: #1E3A8A;">${c.id}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Vessel:</span>
                <div style="font-size: 14px; font-weight: 700;">${c.vessel}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Registered Species:</span>
                <div style="font-size: 14px; font-weight: 700;">${c.species}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Net Weight:</span>
                <div style="font-size: 15px; font-weight: 800; color: #06B6D4;">${c.weight} kg <span class="badge badge-green" style="font-size:9px;">Sensor verified</span></div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">Cold Chain Status:</span>
                <div style="font-size: 13px; font-weight: 700; color: ${c.coldChainStatus === 'Violation' ? '#EF4444' : '#10B981'};">${c.coldChainStatus}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-muted);">AI Validation Confidence:</span>
                <div style="font-size: 13px; font-weight: 700; color: #8B5CF6;">${c.aiConfidence}%</div>
              </div>
            </div>

            <div style="margin-bottom: 24px;">
              <span style="font-size: 11px; color: var(--text-muted);">Verification Status:</span>
              <div style="margin-top: 4px;"><span class="badge ${statusColors[c.status] || 'badge-blue'}">${c.status}</span></div>
            </div>

            <h3 style="font-size: 13px; font-weight: 800; margin-bottom: 16px; color: #1E3A8A; text-transform: uppercase;">⛓️ Supply Chain Traceability Timeline</h3>
            <div class="timeline">${timelineHtml}</div>

            ${c.satelliteAuditLog ? `
              <div style="margin-top: 16px; padding: 12px; background: #FFFBEB; border: 1px solid #F59E0B; border-radius: 8px; font-size: 12px; color: #B45309;">
                <strong>Satellite Audit Data:</strong> ${c.satelliteAuditLog}
              </div>
            ` : ''}

            <div style="margin-top: 24px; padding: 12px; background: #F8FAFC; border-radius: 8px; font-family: monospace; font-size: 10px; color: #475569; word-break: break-all;">
              OcuChain Blockchain Signature: ${c.hash}
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div class="card" style="border-radius: 16px;">
            <div class="card-header">
              <div class="card-title">Caspian Satellite Position</div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div id="passport-map" style="height: 280px; width: 100%;"></div>
            </div>
          </div>
          ${c.satelliteOverlayImg ? `
            <div class="card" style="border-radius: 16px; overflow: hidden;">
              <div class="card-header">
                <div class="card-title">Satellite Optical Analysis</div>
              </div>
              <div class="card-body" style="padding: 0; text-align: center;">
                <img src="${c.satelliteOverlayImg}" style="width: 100%; height: 200px; object-fit: cover;" alt="Satellite View" />
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const btnBack = container.querySelector('#btn-back-to-search') as HTMLButtonElement | null;
    if (btnBack) {
      btnBack.onclick = () => {
        activeRecordId = "";
        renderView();
      };
    }

    const btnPrint = container.querySelector('#btn-download-pdf-passport') as HTMLButtonElement | null;
    if (btnPrint) {
      btnPrint.onclick = () => {
        printPassportPDF(c);
      };
    }

    initPassportMap("passport-map", c.location, c.id, c.species, c.weight);
  }

  function printPassportPDF(c: CatchTransaction) {
    const printContent = `
      <html>
        <head>
          <title>OcuCast Official PDF Certificate - ${c.id}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #0F172A; background: #FFFFFF; }
            .header { text-align: center; border-bottom: 2px solid #1E3A8A; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 22px; font-weight: 800; color: #1E3A8A; text-transform: uppercase; }
            .subtitle { font-size: 12px; font-weight: 600; color: #06B6D4; letter-spacing: 1px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .field { margin-bottom: 10px; }
            .label { font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: bold; }
            .value { font-size: 15px; font-weight: 700; color: #0F172A; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
            .badge-verified { background: #D1FAE5; color: #065F46; }
            .badge-suspicious { background: #FEF3C7; color: #92400E; }
            .badge-blocked { background: #FEE2E2; color: #991B1B; }
            .timeline { margin-top: 30px; }
            .timeline-item { border-left: 2px solid #E2E8F0; padding-left: 20px; margin-bottom: 15px; position: relative; }
            .timeline-item::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: #06B6D4; position: absolute; left: -6px; top: 4px; }
            .hash { font-family: monospace; font-size: 11px; background: #F8FAFC; padding: 10px; border-radius: 6px; word-break: break-all; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="subtitle">Mangystau Region Fish Resources Department</div>
            <div class="title">Official Digital Certificate of Origin</div>
          </div>
          <div class="grid">
            <div class="field">
              <div class="label">Catch Identifier</div>
              <div class="value">${c.id}</div>
            </div>
            <div class="field">
              <div class="label">Fishing Vessel</div>
              <div class="value">${c.vessel}</div>
            </div>
            <div class="field">
              <div class="label">Species</div>
              <div class="value">${c.species}</div>
            </div>
            <div class="field">
              <div class="label">Weight</div>
              <div class="value">${c.weight} kg</div>
            </div>
            <div class="field">
              <div class="label">Verification Status</div>
              <div class="value"><span class="badge badge-${c.status.toLowerCase()}">${c.status}</span></div>
            </div>
            <div class="field">
              <div class="label">Timestamp</div>
              <div class="value">${new Date(c.timestamp).toUTCString()}</div>
            </div>
          </div>
          
          <div class="timeline">
            <h3>Supply Chain Tracking Stages</h3>
            ${c.stages.map(s => `
              <div class="timeline-item">
                <div><strong>${s.name}</strong> - ${s.location}</div>
                <div style="font-size: 12px; color: #64748B;">Checked by ${s.checkedBy} on ${s.timestamp ? new Date(s.timestamp).toUTCString() : 'Pending'}</div>
              </div>
            `).join('')}
          </div>

          <div class="hash">
            OcuChain Cryptographic Seal: ${c.hash}
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(printContent);
      doc.close();
    }

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
    }, 500);
  }

  function initPassportMap(containerId: string, location: [number, number], id: string, species: string, weight: number) {
    setTimeout(() => {
      if (globalPassportMap) {
        try {
          globalPassportMap.remove();
        } catch (e) {
          console.warn("Failed to remove Leaflet map instance:", e);
        }
        globalPassportMap = null;
      }

      const mapDiv = document.getElementById(containerId);
      if (!mapDiv) return;
      mapDiv.innerHTML = '';

      try {
        globalPassportMap = L.map(containerId).setView(location, 9);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri Satellite'
        }).addTo(globalPassportMap);

        L.marker(location).addTo(globalPassportMap)
          .bindPopup(`<strong>Batch: ${id}</strong><br>Mangystau Caspian Sector<br>${species} - ${weight} kg`)
          .openPopup();

        const pathCoordinates = [
          [44.5367, 50.2567],
          location
        ];
        L.polyline(pathCoordinates, { color: '#06B6D4', weight: 3 }).addTo(globalPassportMap);
      } catch (err) {
        console.error("Leaflet map mounting error:", err);
      }
    }, 100);
  }

  renderView();
  return container;
}

function downloadReceiptBuffer(id: string, species: string, weight: number, vessel: string, hash: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('OCUCAST TRUSTED SEAL', canvas.width / 2, 45);

  ctx.fillStyle = '#06B6D4';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillText('MANGYSTAU REGION FISH REGISTRY', canvas.width / 2, 65);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 80);
  ctx.lineTo(380, 80);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '14px "Courier New", monospace';
  ctx.textAlign = 'left';

  ctx.fillText(`CATCH ID: ${id}`, 30, 110);
  ctx.fillText(`VESSEL:   ${vessel}`, 30, 135);
  ctx.fillText(`SPECIES:  ${species}`, 30, 160);
  ctx.fillText(`WEIGHT:   ${weight.toFixed(2)} kg`, 30, 185);
  ctx.fillText(`DATE:     ${new Date().toLocaleDateString()}`, 30, 210);

  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(20, 230);
  ctx.lineTo(380, 230);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '9px "Courier New", monospace';
  ctx.fillText('OCUCHAIN BLOCK SIGNATURE:', 30, 250);
  ctx.fillText(hash.substring(0, 32), 30, 265);
  ctx.fillText(hash.substring(32), 30, 278);

  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous';
  const passportUrl = `${window.location.origin}/passport?id=${id}`;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(passportUrl)}`;
  
  const finishDownload = () => {
    const link = document.createElement('a');
    link.download = 'OcuCast_Print_Buffer.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  qrImg.onload = () => {
    ctx.drawImage(qrImg, 125, 300, 150, 150);
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PHYSICAL CHECK BUFFER - WALKPRINT READY', canvas.width / 2, 485);
    finishDownload();
  };

  qrImg.onerror = () => {
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[QR CODE MATRIX SIGNED]', canvas.width / 2, 380);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PHYSICAL CHECK BUFFER - WALKPRINT READY', canvas.width / 2, 485);
    finishDownload();
  };
}

function FishermanPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let currentStep = 1;
  let inputWeight = 1.8;
  let selectedSpecies: FishSpecies = "Vobla";
  let mediaStream: MediaStream | null = null;
  let capturedBase64 = "";

  function renderView() {
    const user = Session.getCurrentUser();
    if (!user) {
      renderLoginCard();
    } else if (user.status === 'suspended') {
      renderSuspendedNotice();
    } else {
      renderWizard();
    }
  }

  function renderLoginCard() {
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card" style="border-radius:16px;">
          <h2 style="font-size:20px; font-weight:800; color:#1E3A8A; text-align:center; margin-bottom:24px;">Fisherman Portal Access</h2>
          <div id="login-err"></div>
          <form id="form-fisherman-login">
            <div class="form-group">
              <label class="form-label">Captain Login ID</label>
              <input type="text" id="log-username" class="form-input" value="fisher1" required>
            </div>
            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label">Authorization Code</label>
              <input type="password" id="log-pass" class="form-input" value="demo" required>
            </div>
            <button class="btn btn-primary btn-block" style="background:#1E3A8A;">Authorize Vessel</button>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector('#form-fisherman-login');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const login = (container.querySelector('#log-username') as HTMLInputElement).value;
      const pass = (container.querySelector('#log-pass') as HTMLInputElement).value;

      if (login === 'fisher1' && pass === 'demo') {
        Session.setCurrentUser({ username: 'fisher1', vessel: 'Caspian-Star', status: 'approved' });
        renderView();
      } else {
        const err = container.querySelector('#login-err');
        if (err) err.innerHTML = `<div class="alert alert-red" style="margin-bottom:12px;">Invalid login credentials.</div>`;
      }
    });
  }

  function renderSuspendedNotice() {
    container.innerHTML = `
      <div class="card" style="padding:40px; text-align:center; max-width:500px; margin: 40px auto; border-radius:16px; border:2px solid #EF4444;">
        <span style="font-size:48px;">🔒</span>
        <h2 style="color:#EF4444; margin: 16px 0 8px;">Vessel Profiles Suspended</h2>
        <p style="color:#475569; margin-bottom:24px;">
          OcuLock has locked this terminal due to ledger data mismatch. Contact the Fish Resources Department of Mangystau Region.
        </p>
        <button id="btn-susp-logout" class="btn btn-ghost">Switch Operator</button>
      </div>
    `;
    container.querySelector('#btn-susp-logout')?.addEventListener('click', () => {
      Session.logout();
      renderView();
    });
  }

  function renderWizard() {
    const user = Session.getCurrentUser()!;
    let stepContent = "";

    if (currentStep === 1) {
      stepContent = `
        <h3>Step 1: Scales Hardware Calibration</h3>
        <p style="font-size: 13px; color: #475569; margin-bottom: 20px;">Ensure the vessel scales are clear before reading telemetry.</p>
        
        <div style="text-align:center; padding:32px; background:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0; margin-bottom:20px;">
          <div style="font-size:54px; font-weight:900; color:#1E3A8A;" id="calib-weight-text">${inputWeight.toFixed(1)} kg</div>
          <span class="badge badge-green">IoT Scales Telemetry Connected</span>
        </div>

        <div class="form-group">
          <label class="form-label">Simulation Weight Control</label>
          <input type="range" id="scales-simulator-slider" class="form-input" min="0.5" max="10.0" step="0.1" value="${inputWeight}">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px;">
            <span>0.5 kg</span>
            <span style="color:#EF4444; font-weight:bold;">Vobla bio-limit alert test at >3.0 kg</span>
            <span>10.0 kg</span>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 24px;">
          <label class="form-label">Fish Species Target</label>
          <select id="species-target-select" class="form-input form-select">
            <option value="Vobla" ${selectedSpecies === 'Vobla' ? 'selected' : ''}>Vobla (Limit: ≤ 3.0 kg)</option>
            <option value="Carp" ${selectedSpecies === 'Carp' ? 'selected' : ''}>Carp (Limit: ≤ 35.0 kg)</option>
            <option value="Sturgeon" ${selectedSpecies === 'Sturgeon' ? 'selected' : ''}>Sturgeon (Limit: ≤ 120.0 kg)</option>
          </select>
        </div>

        <button id="btn-step1-next" class="btn btn-primary" style="float:right; background: #1E3A8A;">Configure Optical Scanner</button>
      `;
    } else if (currentStep === 2) {
      stepContent = `
        <h3>Step 2: Optical Sample Authentication</h3>
        <p style="font-size: 13px; color: #475569; margin-bottom: 20px;">Vessel camera stream must capture the fish sample to prevent physical fraud.</p>
        
        <div class="alert alert-cyan" style="margin-bottom: 20px; border-radius: 12px; display: block; background: #ECFEFF; border: 1.5px solid #06B6D4; color: #0891B2; font-size: 12.5px; padding: 12px; font-weight: 600;">
          💡 Demo Mode: Hand gestures/likes are recognized by the AI model as Carp.
        </div>

        <div style="background:#000; border-radius:12px; height:240px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; margin-bottom:20px;">
          <video id="device-camera-stream" autoplay playsinline style="width:100%; height:100%; object-fit:cover; display: ${mediaStream && !capturedBase64 ? 'block' : 'none'};"></video>
          ${capturedBase64 ? `<img src="${capturedBase64}" style="width:100%; height:100%; object-fit:cover;" />` : ''}
          ${!mediaStream && !capturedBase64 ? `
            <div style="text-align:center; color:#94A3B8;">
              <span style="font-size:32px;">📷</span><br>
              <button id="btn-trigger-camera" class="btn btn-cyan btn-sm" style="margin-top:10px; background: #06B6D4;">Activate Device Camera</button>
            </div>
          ` : ''}
          ${mediaStream && !capturedBase64 ? `
            <button id="btn-shoot-camera" class="btn btn-cyan btn-sm" style="position:absolute; bottom:16px; background: #06B6D4;">Capture Image</button>
          ` : ''}
        </div>

        <div style="display:flex; justify-content:space-between;">
          <button id="btn-step2-back" class="btn btn-ghost">Back</button>
          <button id="btn-step2-next" class="btn btn-primary" style="background: #1E3A8A;" ${!capturedBase64 ? 'disabled' : ''}>Run AI Authentication</button>
        </div>
      `;
    } else if (currentStep === 3) {
      const confidence = runAIEstimation(inputWeight, selectedSpecies);
      const limitVerification = checkCatchLimits(selectedSpecies, inputWeight, 12);

      let detectedType = `${selectedSpecies} (Confidence: ${confidence}%)`;
      let freshnessIndex = `<strong style="color: #10B981;">97.2% (Fresh)</strong>`;
      let healthCheck = `<strong style="color: #06B6D4;">No contaminants detected</strong>`;

      if (selectedSpecies === "Carp") {
        const gestureConfidence = (91 + Math.random() * 8).toFixed(1);
        detectedType = `Hand gesture (${gestureConfidence}%)`;
        freshnessIndex = `<strong style="color: #EF4444;">This is not a fish</strong>`;
        healthCheck = `<strong style="color: #EF4444;">This is not a fish</strong>`;
      }

      const aiAnalysisPanel = `
        <div class="ai-panel" style="margin-bottom: 20px; border: 1px solid rgba(139, 92, 246, 0.15); border-radius: 12px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(139, 92, 246, 0.04) 100%); padding: 16px;">
          <div style="font-weight: 800; color: #8B5CF6; font-size:13.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
            <span>🤖 AI Vision Analysis</span>
            <span class="badge badge-purple" style="font-size:9px; background:#F5F3FF; color:#7C3AED;">Active</span>
          </div>
          <div style="font-size:12.5px; display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Detected Fish Type:</span> <strong style="color: #7C3AED;">${detectedType}</strong>
          </div>
          <div style="font-size:12.5px; display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Retina Freshness Index:</span> ${freshnessIndex}
          </div>
          <div style="font-size:12.5px; display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Ecosystem Health Check:</span> ${healthCheck}
          </div>
          <div style="font-size:11px; color: #64748B; font-style: italic; margin-top: 8px; border-top: 1px dashed #E2E8F0; padding-top: 6px;">
            💡 Demo Mode: Hand gestures/likes are recognized by the AI model as Carp.
          </div>
        </div>
      `;

      let innerResultHTML = "";
      if (limitVerification.mismatchFlag) {
        innerResultHTML = `
          <div class="alert alert-amber" style="margin-bottom:20px; border-radius: 12px; display: block;">
            <div style="font-weight: 800; font-size:14px; margin-bottom:6px;">⚠️ Biological mismatch detected</div>
            <p style="font-size: 12.5px; margin-bottom: 12px; white-space: pre-wrap;">${limitVerification.text}</p>
            <button id="btn-escalate-inspector" class="btn btn-primary btn-sm" style="background:#1E3A8A; width: 100%;">Forward to Inspector for Manual Review</button>
          </div>
        `;
      } else if (limitVerification.status === "Blocked") {
        innerResultHTML = `
          <div class="alert alert-red" style="margin-bottom:20px; border-radius: 12px; display: block;">
            <div style="font-weight: 800; font-size:14px; margin-bottom:6px;">❌ Critical Biological Limits Breached</div>
            <p style="font-size: 12.5px; margin-bottom: 12px; white-space: pre-wrap;">${limitVerification.text}</p>
            <div style="font-size: 12px; color: #7F1D1D;">Registration is locked. Smart leasing or manual clearance required.</div>
          </div>
        `;
      } else {
        innerResultHTML = `
          <div class="alert alert-green" style="margin-bottom:20px; border-radius: 12px; display: block;">
            <div style="font-weight: 800; font-size:14px; margin-bottom:6px;">✓ Calibration verification passed</div>
            <p style="font-size: 12.5px;">AI Confidence: <strong>${confidence}%</strong>. Species match authenticated.</p>
          </div>
          <button id="btn-finalize-seal" class="btn btn-primary btn-block" style="background:#1E3A8A; margin-bottom: 16px;">Register Catch and Seal Container</button>
        `;
      }

      stepContent = `
        <h3>Step 3: Verification Ledger Seals</h3>
        <p style="font-size: 13px; color: #475569; margin-bottom: 20px;">System analyzes physical metrics with biological databases.</p>
        
        <div class="card" style="padding: 16px; border: 1px solid #E2E8F0; margin-bottom: 20px; border-radius:12px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
            <span>Fish Species:</span> <strong>${selectedSpecies}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px;">
            <span>Measured Mass:</span> <strong>${inputWeight.toFixed(1)} kg</strong>
          </div>
        </div>

        ${aiAnalysisPanel}

        ${innerResultHTML}
        
        <div id="finalize-success-card" style="display:none; padding:16px; background:#ECFDF5; border:1.5px solid #10B981; border-radius:12px; text-align:center;">
          <span style="font-size: 24px;">🖨️</span>
          <div style="color:#065F46; font-weight:800; font-size:14px; margin: 8px 0 4px;">Catch Registered & Certified</div>
          <div style="margin: 12px 0;">
            <img id="finalize-qr-img" src="" style="width: 140px; height: 140px; border: 1px solid #E2E8F0; border-radius: 8px; display: inline-block;" />
          </div>
          <div style="font-size:11px; font-family:monospace; background:white; padding:8px; border-radius:6px; border:1px dashed #A7F3D0; margin-bottom:12px;">
            OcuCast Secure Seal - Do not tamper<br>
            CODE: <span id="final-registered-id"></span>
          </div>
          <button id="btn-print-physical-receipt" class="btn btn-cyan btn-block" style="background:#06B6D4; color:white; margin-bottom:8px; display:block;">Печать физического QR-чека</button>
          <button id="btn-go-to-passport-immediate" class="btn btn-primary btn-block" style="background:#1E3A8A; margin-bottom:8px; display:block;">View Digital Passport</button>
          <button id="btn-restart-wizard" class="btn btn-outline btn-block">Start New Catch Registration</button>
        </div>

        <button id="btn-step3-back" class="btn btn-ghost" style="margin-top:10px;">Restart Calibration</button>
      `;
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color:#1E3A8A;">Vessel Fishing Terminal</h2>
          <p style="font-size:13px; color:#475569;">Vessel: ${user.vessel} | Sector: Mangystau Sector C-1</p>
        </div>
        <button id="btn-fisherman-logout" class="btn btn-outline btn-sm">Exit Portal</button>
      </div>

      <div style="display:grid; grid-template-columns: 240px 1fr; gap:32px;" class="passport-grid">
        <div class="card" style="padding:16px; border-radius:16px; height:fit-content;">
          <div style="font-weight:800; font-size:13px; margin-bottom:16px; color:#1E3A8A; text-transform:uppercase;">Wizard Steps</div>
          <div style="display:flex; flex-direction:column; gap:12px; font-size:13.5px;">
            <div style="color:${currentStep === 1 ? '#06B6D4' : '#94A3B8'}; font-weight:${currentStep === 1 ? '800' : '500'};">1. Scales Calibration</div>
            <div style="color:${currentStep === 2 ? '#06B6D4' : '#94A3B8'}; font-weight:${currentStep === 2 ? '800' : '500'};">2. Sample Camera</div>
            <div style="color:${currentStep === 3 ? '#06B6D4' : '#94A3B8'}; font-weight:${currentStep === 3 ? '800' : '500'};">3. Ledger Seals</div>
          </div>
        </div>
        <div class="card" style="padding:24px; border-radius:16px;">${stepContent}</div>
      </div>
    `;

    const btnLogout = container.querySelector('#btn-fisherman-logout') as HTMLButtonElement | null;
    if (btnLogout) {
      btnLogout.onclick = () => {
        Session.logout();
        renderView();
      };
    }

    if (currentStep === 1) {
      const slider = container.querySelector('#scales-simulator-slider') as HTMLInputElement | null;
      if (slider) {
        slider.oninput = (e: any) => {
          inputWeight = parseFloat(e.target.value);
          const txt = container.querySelector('#calib-weight-text');
          if (txt) txt.textContent = `${inputWeight.toFixed(1)} kg`;
        };
      }
      const select = container.querySelector('#species-target-select') as HTMLSelectElement | null;
      if (select) {
        select.onchange = (e: any) => {
          selectedSpecies = e.target.value as FishSpecies;
        };
      }
      const btnNext1 = container.querySelector('#btn-step1-next') as HTMLButtonElement | null;
      if (btnNext1) {
        btnNext1.onclick = () => {
          currentStep = 2;
          renderWizard();
        };
      }
    } else if (currentStep === 2) {
      const btnBack2 = container.querySelector('#btn-step2-back') as HTMLButtonElement | null;
      if (btnBack2) {
        btnBack2.onclick = () => {
          stopCamera();
          currentStep = 1;
          renderWizard();
        };
      }
      const btnCamera = container.querySelector('#btn-trigger-camera') as HTMLButtonElement | null;
      if (btnCamera) {
        btnCamera.onclick = () => {
          startCamera();
        };
      }
      const btnShoot = container.querySelector('#btn-shoot-camera') as HTMLButtonElement | null;
      if (btnShoot) {
        btnShoot.onclick = () => {
          shootFrame();
        };
      }
      const btnNext2 = container.querySelector('#btn-step2-next') as HTMLButtonElement | null;
      if (btnNext2) {
        btnNext2.onclick = () => {
          btnNext2.disabled = true;
          btnNext2.innerHTML = `🔄 Running AI Analysis...`;
          setTimeout(() => {
            currentStep = 3;
            renderWizard();
          }, 1200);
        };
      }
    } else if (currentStep === 3) {
      const btnBack3 = container.querySelector('#btn-step3-back') as HTMLButtonElement | null;
      if (btnBack3) {
        btnBack3.onclick = () => {
          currentStep = 1;
          capturedBase64 = "";
          renderWizard();
        };
      }

      const setupSuccess = (newId: string, item: any) => {
        btnBack3!.style.display = "none";
        const successCard = container.querySelector('#finalize-success-card') as HTMLElement | null;
        if (successCard) {
          successCard.style.display = "block";
          const lbl = container.querySelector('#final-registered-id');
          if (lbl) lbl.textContent = newId;

          const qrImg = container.querySelector('#finalize-qr-img') as HTMLImageElement | null;
          if (qrImg) {
            const passportUrl = `${window.location.origin}/passport?id=${newId}`;
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(passportUrl)}`;
          }

          const btnPrintReceipt = container.querySelector('#btn-print-physical-receipt') as HTMLButtonElement | null;
          if (btnPrintReceipt) {
            btnPrintReceipt.onclick = () => {
              downloadReceiptBuffer(newId, item.species, item.weight, item.vessel, item.hash || 'N/A');
            };
          }

          const btnPassportImmediate = container.querySelector('#btn-go-to-passport-immediate') as HTMLButtonElement | null;
          if (btnPassportImmediate) {
            btnPassportImmediate.onclick = () => {
              Router.navigate(`/passport?id=${newId}`);
            };
          }
        }
      };

      const btnEscalate = container.querySelector('#btn-escalate-inspector') as HTMLButtonElement | null;
      if (btnEscalate) {
        btnEscalate.onclick = () => {
          const newId = `OC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
          const freshItem = {
            id: newId,
            weight: inputWeight,
            species: selectedSpecies,
            vessel: user.vessel,
            timestamp: new Date().toISOString(),
            location: [43.6521 + (Math.random() - 0.5) * 0.1, 51.1753 + (Math.random() - 0.5) * 0.1] as [number, number],
            status: "Suspicious" as const,
            imageBase64: capturedBase64,
            aiConfidence: runAIEstimation(inputWeight, selectedSpecies),
            oilDetected: false,
            coldChainStatus: "Normal" as const,
            currentStage: 1,
            gyroAngle: 12,
            aisStatus: "Mismatch" as const,
            vesselsDetectedOnPhoto: 1,
            satelliteOverlayImg: "",
            stages: DEFAULT_STAGES(newId, new Date().toISOString())
          };

          const saved = saveCatch(freshItem);
          btnEscalate.style.display = "none";
          setupSuccess(newId, saved);
        };
      }

      const btnFinalize = container.querySelector('#btn-finalize-seal') as HTMLButtonElement | null;
      if (btnFinalize) {
        btnFinalize.onclick = () => {
          const newId = `OC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
          const freshItem = {
            id: newId,
            weight: inputWeight,
            species: selectedSpecies,
            vessel: user.vessel,
            timestamp: new Date().toISOString(),
            location: [43.6521 + (Math.random() - 0.5) * 0.1, 51.1753 + (Math.random() - 0.5) * 0.1] as [number, number],
            status: "Verified" as const,
            imageBase64: capturedBase64,
            aiConfidence: runAIEstimation(inputWeight, selectedSpecies),
            oilDetected: false,
            coldChainStatus: "Normal" as const,
            currentStage: 1,
            gyroAngle: 12,
            aisStatus: "Active" as const,
            vesselsDetectedOnPhoto: 1,
            satelliteOverlayImg: "",
            stages: DEFAULT_STAGES(newId, new Date().toISOString())
          };

          const saved = saveCatch(freshItem);
          btnFinalize.style.display = "none";
          setupSuccess(newId, saved);
        };
      }

      const btnRestart = container.querySelector('#btn-restart-wizard') as HTMLButtonElement | null;
      if (btnRestart) {
        btnRestart.onclick = () => {
          currentStep = 1;
          capturedBase64 = "";
          renderWizard();
        };
      }
    }
  }

  function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        mediaStream = stream;
        renderWizard();
        const video = container.querySelector('#device-camera-stream') as HTMLVideoElement | null;
        if (video) {
          video.srcObject = stream;
          video.play().catch(err => console.error("Video play error:", err));
        }
      })
      .catch(() => {
        capturedBase64 = "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80";
        renderWizard();
      });
  }

  function shootFrame() {
    const video = container.querySelector('#device-camera-stream') as HTMLVideoElement | null;
    if (video && mediaStream) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        capturedBase64 = canvas.toDataURL('image/jpeg');
      }
      stopCamera();
      renderWizard();
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
  }

  renderView();
  return container;
}

function CheckpointPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  let hasScannedQR = false;

  function render() {
    container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="font-size: 22px; font-weight: 800; color: #1E3A8A; margin-bottom: 6px;">Logistics Checkpoint Terminal</h2>
        <p style="color: #475569; font-size: 13.5px; margin-bottom: 24px;">Harbor Inspection & Digital Verification Authority - Mangystau</p>
        
        <div class="card" style="padding: 28px; border-radius: 16px;">
          <form id="checkpoint-inspect-form">
            <div class="form-group">
              <label class="form-label">Target OcuCast ID</label>
              <select id="checkpoint-id-select" class="form-input form-select">
                ${getCatches().map(c => `<option value="${c.id}">${c.id} (${c.vessel} - ${c.species})</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Ambient Storage Temperature (°C)</label>
              <input type="number" id="checkpoint-temp-input" class="form-input" value="-4" step="0.5">
            </div>

            <div class="form-group">
              <label class="form-label">Verification Target Stage</label>
              <select id="checkpoint-stage-select" class="form-input form-select">
                <option value="2">Stage 2: Port Bautino Checkpoint</option>
                <option value="3">Stage 3: Processing Guard Facility</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 24px;">
              <label class="form-label">Verification Methodology Split Menu</label>
              <select id="checkpoint-methodology" class="form-input form-select">
                <option value="QR_Verification_Scan">Direct QR Verification Scan</option>
                <option value="MultiSig_Bluetooth">Multi-Sig Encrypted Bluetooth Handshake</option>
                <option value="Digital_Stamp_Approval">Hardware Digital Seal Approval</option>
              </select>
            </div>

            <div style="margin-bottom:24px; text-align:center;">
              <button type="button" id="btn-scan-checkpoint-qr" class="btn btn-cyan btn-block" style="background:#06B6D4; color:white;">
                Scan Batch QR
              </button>
              <div id="checkpoint-scan-status" style="margin-top: 10px; font-weight:700; font-size:13px; color:#EF4444;">
                ⚠️ Scanner verification required.
              </div>
            </div>

            <button type="submit" id="btn-submit-checkpoint" class="btn btn-primary btn-block" style="background:#1E3A8A;" disabled>
              Register Stage and Certify
            </button>
          </form>
          
          <div id="checkpoint-feedback" style="margin-top:20px; display:none;"></div>
        </div>
      </div>

      <div id="checkpoint-scanner-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); flex-direction: column; align-items: center; justify-content: center; z-index: 2000;">
        <div class="card" style="padding: 24px; text-align: center; max-width: 400px; background: white; border-radius: 16px;">
          <h3 style="font-size: 18px; font-weight: 800; color: #1E3A8A; margin-bottom: 12px;">Active Scanner Device Stream</h3>
          <p style="font-size: 13px; color: #475569; margin-bottom: 20px;">Reading QR matrix payload on fish container seal...</p>
          <div style="width: 280px; height: 200px; background: #000; border-radius: 8px; margin: 0 auto 20px; position: relative; overflow: hidden;">
            <video id="checkpoint-scan-video" style="width: 100%; height: 100%; object-fit: cover;"></video>
            <div style="position: absolute; inset: 20px; border: 2px dashed #06B6D4; pointer-events: none;"></div>
          </div>
          <button id="btn-cancel-checkpoint-scan" class="btn btn-ghost">Cancel</button>
        </div>
      </div>
    `;

    const btnScan = container.querySelector('#btn-scan-checkpoint-qr') as HTMLButtonElement | null;
    const scanOverlay = container.querySelector('#checkpoint-scanner-overlay') as HTMLElement | null;
    const btnCancelScan = container.querySelector('#btn-cancel-checkpoint-scan') as HTMLButtonElement | null;
    const scanStatus = container.querySelector('#checkpoint-scan-status') as HTMLElement | null;
    const btnSubmit = container.querySelector('#btn-submit-checkpoint') as HTMLButtonElement | null;

    if (btnScan && scanOverlay && scanStatus && btnSubmit) {
      btnScan.onclick = () => {
        scanOverlay.style.display = 'flex';
        const video = container.querySelector('#checkpoint-scan-video') as HTMLVideoElement | null;
        if (video) {
          startQRScanning(video, (decodedId) => {
            scanOverlay.style.display = 'none';
            let cleanId = decodedId;
            if (decodedId.includes("id=")) {
              cleanId = decodedId.split("id=")[1].split("&")[0];
            }

            const selectEl = container.querySelector('#checkpoint-id-select') as HTMLSelectElement | null;
            if (selectEl) {
              let optionExists = false;
              for (let i = 0; i < selectEl.options.length; i++) {
                if (selectEl.options[i].value === cleanId) {
                  selectEl.selectedIndex = i;
                  optionExists = true;
                  break;
                }
              }
              if (!optionExists) {
                const opt = document.createElement("option");
                opt.value = cleanId;
                opt.textContent = `${cleanId} (Scanned Catch ID)`;
                selectEl.appendChild(opt);
                selectEl.value = cleanId;
              }
            }

            hasScannedQR = true;
            scanStatus.textContent = `✓ QR Code scanned successfully (ID: ${cleanId})`;
            scanStatus.style.color = '#10B981';
            btnSubmit.disabled = false;
          });
        }
      };
    }

    if (btnCancelScan && scanOverlay) {
      btnCancelScan.onclick = () => {
        stopQRScanning();
        scanOverlay.style.display = 'none';
      };
    }

    const form = container.querySelector('#checkpoint-inspect-form') as HTMLFormElement | null;
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!hasScannedQR) return;

      const catchId = (container.querySelector('#checkpoint-id-select') as HTMLSelectElement).value;
      const tempVal = parseFloat((container.querySelector('#checkpoint-temp-input') as HTMLInputElement).value);
      const stageVal = parseInt((container.querySelector('#checkpoint-stage-select') as HTMLSelectElement).value);
      const methodVal = (container.querySelector('#checkpoint-methodology') as HTMLSelectElement).value as any;

      const stageName = stageVal === 2 ? "Port Bautino Checkpoint" : "Processing Guard Facility";
      const location = stageVal === 2 ? "Bautino Harbor Inspector Office" : "Aktau Fish Processing Facility";
      const checker = stageVal === 2 ? "Inspector A. Bekova" : "Officer D. Nurmagambetov";

      const newStage: SupplyChainStage = {
        stageId: stageVal,
        name: stageName,
        location: location,
        checkedBy: checker,
        timestamp: new Date().toISOString(),
        verificationType: methodVal,
        temp: tempVal
      };

      addStageToCatch(catchId, newStage);

      const catches = getCatches();
      const match = catches.find(c => c.id === catchId);
      if (match && tempVal > 4.0) {
        match.coldChainStatus = "Violation";
        localStorage.setItem('oc_catches', JSON.stringify(catches));
      }

      const feedback = container.querySelector('#checkpoint-feedback') as HTMLElement | null;
      if (feedback) {
        feedback.style.display = "block";
        feedback.innerHTML = `
          <div class="alert alert-green">
            ✓ Checkpoint Stage ${stageVal} successfully logged in OcuChain ledger. Passport database updated.
          </div>
        `;
      }

      hasScannedQR = false;
      if (scanStatus) {
        scanStatus.textContent = '⚠️ Scanner verification required.';
        scanStatus.style.color = '#EF4444';
      }
      if (btnSubmit) btnSubmit.disabled = true;
    });
  }

  render();
  return container;
}

function AdminPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';
  let selectedAnomalyId = "";

  function renderView() {
    const adminSession = Session.isAdminLoggedIn();
    if (!adminSession) {
      renderLoginCard();
    } else {
      renderDashboard();
    }
  }

  function renderLoginCard() {
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card" style="border-radius:16px;">
          <h2 style="font-size:20px; font-weight:800; color:#1E3A8A; text-align:center; margin-bottom:24px;">Department Administration</h2>
          <div id="admin-login-err"></div>
          <form id="form-admin-login">
            <div class="form-group">
              <label class="form-label">Administrator Account</label>
              <input type="text" id="admin-user" class="form-input" value="admin" required>
            </div>
            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label">Security Key</label>
              <input type="password" id="admin-pass" class="form-input" value="admin" required>
            </div>
            <button class="btn btn-primary btn-block" style="background:#1E3A8A;">Unlock Situation Center</button>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector('#form-admin-login');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const login = (container.querySelector('#admin-user') as HTMLInputElement).value;
      const pass = (container.querySelector('#admin-pass') as HTMLInputElement).value;

      if (login === 'admin' && pass === 'admin') {
        Session.setAdminLoggedIn(true);
        renderView();
      } else {
        const err = container.querySelector('#admin-login-err');
        if (err) err.innerHTML = `<div class="alert alert-red" style="margin-bottom:12px;">Access Denied.</div>`;
      }
    });
  }

  function renderDashboard() {
    const quotas = getQuotas();
    const catches = getCatches();

    const quotaCardsHtml = quotas.map(q => {
      const percentage = Math.min(100, Math.round((q.consumed / q.totalAllocated) * 100));
      return `
        <div class="card" style="padding: 20px; border-radius: 16px;">
          <div style="font-size: 11px; font-weight: 800; color:#94A3B8; text-transform:uppercase;">${q.species} Consumed Quota</div>
          <div style="font-size: 24px; font-weight: 800; color:#1E3A8A; margin: 8px 0;">${q.consumed.toFixed(1)} / ${q.totalAllocated} kg</div>
          <div class="progress-track" style="height: 8px; border-radius: 9999px; background: #F1F5F9; overflow: hidden;">
            <div class="progress-fill" style="width: ${percentage}%; height: 100%; background: #06B6D4; border-radius: 9999px;"></div>
          </div>
          <div style="font-size: 11px; text-align: right; color:#64748B; margin-top: 4px;">${percentage}% consumed</div>
        </div>
      `;
    }).join('');

    const anomalousCatches = catches.filter(c => c.oilDetected === true || c.status === "Suspicious" || c.status === "Blocked");

    const tableRowsHtml = anomalousCatches.map(c => {
      const factor = c.oilDetected ? "Oil Contamination" : "Biological Mismatch";
      return `
        <tr class="anomaly-row" data-id="${c.id}" style="cursor: pointer; transition: background 0.2s;">
          <td style="font-weight: 800; color: #1E3A8A;">${c.id} ${selectedAnomalyId === c.id ? '▶' : ''}</td>
          <td>${c.vessel}</td>
          <td>[${c.location[0].toFixed(4)}, ${c.location[1].toFixed(4)}]</td>
          <td style="color: #EF4444; font-weight: 700;">${factor}</td>
          <td>
            <span class="badge ${c.status === 'Verified' ? 'badge-green' : c.status === 'Blocked' ? 'badge-red' : 'badge-amber'}">${c.status}</span>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: #1E3A8A;">Situation Center Dashboard</h2>
          <p style="color: #475569; font-size: 13.5px;">Mangystau Region Fish Resources Department - Executive Analytics</p>
        </div>
        <button id="btn-admin-logout" class="btn btn-outline btn-sm">Exit Dashboard</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 32px;" class="passport-grid">
        ${quotaCardsHtml}
      </div>

      <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 32px;" class="passport-grid">
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div class="card" style="padding: 24px; border-radius: 16px;">
            <h3 style="font-size:13px; font-weight:800; color:#1E3A8A; margin-bottom:16px; text-transform:uppercase;">Anthropogenic Anomaly & Biological Audit Log</h3>
            <p style="font-size: 12px; color: #64748B; margin-bottom: 12px;">💡 Click any row to inspect, run AI satellite verification, or authorize quota lease.</p>
            <div style="overflow-x: auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Catch ID</th>
                    <th>Vessel</th>
                    <th>Coordinates</th>
                    <th>Flagged Anomaly</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml.length > 0 ? tableRowsHtml : `<tr><td colspan="5" style="text-align:center; color:#94A3B8; padding: 20px;">No active biological anomalies recorded on ledger.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <div id="satellite-audit-card-container"></div>
        </div>

        <div class="card" style="border-radius:16px; height: fit-content;">
          <div class="card-header">
            <div class="card-title">Regional Radar Eco-Heatmap</div>
            <div class="card-subtitle">Active environmental indicators - Caspian Sea</div>
          </div>
          <div class="card-body" style="padding:0;">
            <div id="admin-map" style="height:350px; width:100%;"></div>
          </div>
        </div>
      </div>
    `;

    const btnLogout = container.querySelector('#btn-admin-logout') as HTMLButtonElement | null;
    if (btnLogout) {
      btnLogout.onclick = () => {
        Session.logout();
        renderView();
      };
    }

    container.querySelectorAll('.anomaly-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id')!;
        selectedAnomalyId = id;
        renderDashboard();
        renderSatelliteAuditCard(id);
      });
    });

    if (selectedAnomalyId) {
      renderSatelliteAuditCard(selectedAnomalyId);
    }

    initAdminMap();
  }

  function renderSatelliteAuditCard(catchId: string) {
    const auditContainer = container.querySelector('#satellite-audit-card-container');
    if (!auditContainer) return;

    const matches = getCatches();
    const c = matches.find(item => item.id === catchId);
    if (!c) return;

    let feedbackHtml = '';
    if (c.status === 'Verified' && c.satelliteAuditLog) {
      const accuracy = (91 + Math.random() * 8).toFixed(1);
      feedbackHtml = `
        <div class="alert alert-green" style="margin-bottom: 16px; border-radius: 8px; display: block;">
          <strong>✓ Verification Accuracy ${accuracy}%:</strong> AI confirms a single legitimate vessel at coordinate telemetry. Status updated to Verified.
        </div>
      `;
    } else if (c.status === 'Blocked' && c.satelliteAuditLog) {
      const accuracy = (1 + Math.random() * 8).toFixed(1);
      feedbackHtml = `
        <div class="alert alert-red" style="margin-bottom: 16px; border-radius: 8px; display: block;">
          <strong>🚨 КРИТИЧЕСКОЕ НАРУШЕНИЕ (AI Confidence: ${accuracy}%):</strong> ИИ подтвердил нелегальную перегрузку в море (shadow transshipment). Status updated to Blocked.
        </div>
      `;
    }

    auditContainer.innerHTML = `
      <div class="card slide-up" style="padding: 24px; border-radius: 16px; border: 1.5px solid #06B6D4; background: #FAFDFE; margin-top: 8px;">
        <h3 style="font-size: 15px; font-weight: 800; color: #1E3A8A; margin-bottom: 8px;">Спутниковая проверка и АИС (Автоматический анализ ИИ)</h3>
        <p style="font-size: 12.5px; color: #475569; margin-bottom: 16px;">
          Inspecting target batch <strong>${c.id}</strong> from vessel <strong>${c.vessel}</strong>. Coordinates: [${c.location[0].toFixed(4)}, ${c.location[1].toFixed(4)}].
        </p>

        <div id="audit-feedback-area">${feedbackHtml}</div>

        <form id="satellite-audit-form" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Description</label>
            <input type="text" id="satellite-input-code" class="form-input" placeholder="Enter a description" value="" required>
          </div>

          <div style="display: flex; gap: 12px; margin-top: 8px;">
            <button type="submit" id="btn-run-satellite-audit" class="btn btn-cyan" style="background:#06B6D4; color:white; flex: 1;">Запустить ИИ-анализ снимка</button>
            ${c.status !== 'Verified' ? `
              <button type="button" id="btn-legalize-direct" class="btn btn-primary" style="background:#1E3A8A; color:white; flex: 1;">
                Legalize via Smart Lease
              </button>
            ` : ''}
          </div>

          <div style="font-size: 12px; color: #475569; margin-top: 8px; border-top: 1px solid #E2E8F0; padding-top: 10px; font-weight: 500;">
            ℹ️ To legalize this transaction, administration acceptance is required.
          </div>
        </form>
      </div>
    `;

    const form = auditContainer.querySelector('#satellite-audit-form') as HTMLFormElement | null;
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const userInput = (auditContainer.querySelector('#satellite-input-code') as HTMLInputElement).value.trim();
      const code = (userInput.includes("1") || userInput === "1") ? "1" : "0";
      const mockDescription = userInput || (code === "1" ? "Legitimate vessel activity verified." : "Suspicious transshipment activity detected.");

      executeLiveSatelliteAudit(catchId, code, mockDescription);
      renderDashboard();
    });

    const btnLease = auditContainer.querySelector('#btn-legalize-direct') as HTMLButtonElement | null;
    if (btnLease) {
      btnLease.onclick = () => {
        const leaseResult = OcuQuotaShare(c.weight, c.species);
        if (leaseResult.leased) {
          updateCatchStatus(c.id, leaseResult.newStatus);
          
          const catches = getCatches();
          const matchIdx = catches.findIndex(item => item.id === c.id);
          if (matchIdx !== -1) {
            catches[matchIdx].satelliteAuditLog = `Smart lease approved. Unused quota leased from Caspian vessel ${leaseResult.partnerVessel}.`;
            localStorage.setItem('oc_catches', JSON.stringify(catches));
          }

          alert(`Smart lease approved. Unused quota leased from Caspian vessel ${leaseResult.partnerVessel}. Anomalous transaction approved.`);
          renderDashboard();
        }
      };
    }
  }

  function initAdminMap() {
    setTimeout(() => {
      if (globalAdminMap) {
        try {
          globalAdminMap.remove();
        } catch (e) {
          console.warn("Failed to remove Leaflet map instance:", e);
        }
        globalAdminMap = null;
      }

      const mapDiv = document.getElementById("admin-map");
      if (!mapDiv) return;
      mapDiv.innerHTML = '';

      try {
        globalAdminMap = L.map("admin-map").setView([43.85, 51.0], 8);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri Satellite'
        }).addTo(globalAdminMap);

        const catches = getCatches();
        catches.forEach(c => {
          if (c.oilDetected || c.status === "Suspicious" || c.status === "Blocked") {
            const color = c.status === 'Blocked' ? "#EF4444" : c.oilDetected ? "#EF4444" : "#F59E0B";
            const anomalyLabel = c.status === 'Blocked' ? "Illegal Transshipment Blocked" : c.oilDetected ? "Oil Spill Contamination" : "Biological Anomaly";

            const customIcon = L.divIcon({
              html: `<div style="width: 14px; height: 14px; background-color: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px ${color};"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });

            L.marker(c.location, { icon: customIcon }).addTo(globalAdminMap)
              .bindPopup(`<strong>Anomaly Flagged</strong><br>${anomalyLabel}<br>ID: ${c.id}`);
          }
        });
      } catch (err) {
        console.error("Leaflet admin map error:", err);
      }
    }, 100);
  }

  renderView();
  return container;
}

function HowItWorksPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';
  
  container.innerHTML = `
    <style>
      .timeline-step {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
      .timeline-step:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-lg);
      }
      
      /* Pulse animation for node chain */
      @keyframes greenPulse {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }
      .node-glow {
        animation: greenPulse 2s infinite;
      }

      /* Radar scanning rotation */
      @keyframes radarSweep {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .radar-sweep-line {
        transform-origin: 100px 100px;
        animation: radarSweep 4s linear infinite;
      }
      
      /* Satellite laser array */
      @keyframes laserDash {
        to {
          stroke-dashoffset: -40;
        }
      }
      .laser-dashed {
        stroke-dasharray: 5, 5;
        animation: laserDash 1s linear infinite;
      }

      /* Blinking light */
      @keyframes blinkLight {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 1; }
      }
      .indicator-blink {
        animation: blinkLight 1.5s infinite;
      }
    </style>

    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="font-size: 28px; font-weight: 800; color: #1E3A8A; letter-spacing: -0.5px;">Physical-Digital OcuCast Telemetry Architecture</h1>
      <p style="color: #475569; font-size: 15px; max-width: 600px; margin: 8px auto 0;">
        How the Fish Resources Department of Mangystau Region verifies marine catch data in real-time.
      </p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 48px;" class="passport-grid">
      
      <!-- STEP 1 -->
      <div class="card timeline-step" style="padding: 24px; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="background: #ECFEFF; color: #0891B2; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; margin-bottom: 16px;">1</div>
          <h3 style="font-size: 16px; font-weight: 800; color: #1E3A8A; margin-bottom: 8px;">Physical Capture & CV</h3>
          <p style="font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
            The physical scale measures the net weight of the fish while the ship camera captures the sample. AI registers retina contours and determines exact biological specs.
          </p>
        </div>
        
        <!-- Animated SVG Step 1 -->
        <div style="background: #F8FAFC; border-radius: 12px; height: 180px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #E2E8F0; position: relative;">
          <svg width="200" height="150" viewBox="0 0 200 150">
            <!-- Fish contour -->
            <path d="M 40,75 C 60,55 120,55 140,75 C 150,65 165,65 170,75 C 165,85 150,85 140,75 C 120,95 60,95 40,75 Z" fill="none" stroke="#64748B" stroke-width="2" />
            <circle cx="130" cy="71" r="2.5" fill="#3B82F6" />
            
            <!-- Camera frame & optical lines -->
            <rect x="70" y="20" width="60" height="30" rx="3" fill="#1E3A8A" />
            <circle cx="100" cy="35" r="8" fill="#06B6D4" />
            <polygon points="100,35 60,75 140,75" fill="rgba(6, 182, 212, 0.08)" />
            <line x1="100" y1="35" x2="60" y2="75" stroke="#06B6D4" stroke-width="1.5" stroke-dasharray="3,3" />
            <line x1="100" y1="35" x2="140" y2="75" stroke="#06B6D4" stroke-width="1.5" stroke-dasharray="3,3" />
          </svg>
          <div class="indicator-blink" style="position: absolute; bottom: 12px; left: 12px; display: flex; align-items: center; gap: 6px; font-size: 10px; font-family: monospace; font-weight: bold; color: #10B981;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
            Scale Data Synchronized
          </div>
        </div>
      </div>

      <!-- STEP 2 -->
      <div class="card timeline-step" style="padding: 24px; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="background: #F0FDF4; color: #16A34A; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; margin-bottom: 16px;">2</div>
          <h3 style="font-size: 16px; font-weight: 800; color: #1E3A8A; margin-bottom: 8px;">OcuChain Cryptographic Ledger</h3>
          <p style="font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
            Weights and timestamps form a tamper-proof cryptographic ledger block. Any attempt to modify local history instantly breaks the hash signature chain.
          </p>
        </div>

        <!-- Animated Blockchain Nodes Step 2 -->
        <div style="background: #F8FAFC; border-radius: 12px; height: 180px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #E2E8F0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Block 1 -->
            <div class="node-glow" style="width: 44px; height: 60px; background: white; border: 1.5px solid #10B981; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-family: monospace;">
              <span style="font-weight: 800; color: #10B981;">BLK #1</span>
              <span style="color: #64748B; font-size: 8px; margin-top: 4px;">sha:a4</span>
            </div>
            <!-- Arrow -->
            <span style="color: #10B981; font-weight: 800;">➔</span>
            <!-- Block 2 -->
            <div class="node-glow" style="width: 44px; height: 60px; background: white; border: 1.5px solid #10B981; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-family: monospace;">
              <span style="font-weight: 800; color: #10B981;">BLK #2</span>
              <span style="color: #64748B; font-size: 8px; margin-top: 4px;">prev:a4</span>
            </div>
            <!-- Arrow -->
            <span style="color: #10B981; font-weight: 800;">➔</span>
            <!-- Block 3 -->
            <div class="node-glow" style="width: 44px; height: 60px; background: white; border: 1.5px solid #10B981; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-family: monospace;">
              <span style="font-weight: 800; color: #10B981;">BLK #3</span>
              <span style="color: #64748B; font-size: 8px; margin-top: 4px;">prev:c8</span>
            </div>
          </div>
        </div>
      </div>

      <!-- STEP 3 -->
      <div class="card timeline-step" style="padding: 24px; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="background: #EFF6FF; color: #2563EB; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; margin-bottom: 16px;">3</div>
          <h3 style="font-size: 16px; font-weight: 800; color: #1E3A8A; margin-bottom: 8px;">Real-Time AIS & Satellite Audit</h3>
          <p style="font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
            AI situation engines monitor ship locations via AIS. If a ship goes offline or meets another vessel, satellite radar scans flag the shadow transshipment.
          </p>
        </div>

        <!-- Radar & Satellite Sweep Step 3 -->
        <div style="background: #0B0F19; border-radius: 12px; height: 180px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; border: 1px solid #1E293B;">
          <svg width="200" height="180" viewBox="0 0 200 180">
            <!-- Radar Circle -->
            <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(6, 182, 212, 0.15)" stroke-width="1.5" />
            <circle cx="100" cy="100" r="50" fill="none" stroke="rgba(6, 182, 212, 0.15)" stroke-width="1" />
            <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(6, 182, 212, 0.15)" stroke-width="1" />
            <line x1="30" y1="100" x2="170" y2="100" stroke="rgba(6, 182, 212, 0.15)" stroke-width="1" />
            <line x1="100" y1="30" x2="100" y2="170" stroke="rgba(6, 182, 212, 0.15)" stroke-width="1" />
            
            <!-- Sweep line -->
            <line x1="100" y1="100" x2="100" y2="30" class="radar-sweep-line" stroke="#06B6D4" stroke-width="2" opacity="0.7" />

            <!-- Boat Symbol -->
            <path d="M 85,115 L 115,115 L 120,110 L 80,110 Z" fill="#E2E8F0" />
            <rect x="95" y="102" width="10" height="8" fill="#94A3B8" />

            <!-- Satellite Symbol -->
            <rect x="90" y="20" width="20" height="8" rx="2" fill="#3B82F6" />
            <rect x="80" y="22" width="8" height="4" fill="#06B6D4" />
            <rect x="112" y="22" width="8" height="4" fill="#06B6D4" />
            <circle cx="100" cy="24" r="2" fill="#FFFFFF" />

            <!-- Laser beam to boat -->
            <line x1="100" y1="28" x2="100" y2="108" class="laser-dashed" stroke="#EF4444" stroke-width="1.5" />
          </svg>
          
          <div style="position: absolute; top: 12px; right: 12px; background: rgba(16, 185, 129, 0.2); border: 1px solid #10B981; color: #10B981; font-size: 8px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">
            AIS Signal Online
          </div>
        </div>
      </div>

    </div>
  `;
  
  return container;
}

function IdxControlPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page-content container fade-in';

  function render() {
    const catches = getCatches();
    const integrity = verifyBlockchainIntegrity();

    container.innerHTML = `
      <style>
        .cyber-card {
          background: #090D16 !important;
          border: 1px solid rgba(6, 182, 212, 0.2) !important;
          color: #E2E8F0 !important;
          border-radius: 16px;
        }
        .cyber-text-cyan {
          color: #06B6D4 !important;
          text-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
        }
        .cyber-alert-red {
          background: rgba(239, 68, 68, 0.05) !important;
          border: 1px solid #EF4444 !important;
          color: #FECACA !important;
          border-radius: 12px;
        }
      </style>

      <div style="background:#020617; padding:32px; border-radius:24px; border:1px solid #1E293B; color:#F8FAFC;">
        <h2 class="cyber-text-cyan" style="font-family:'Courier New', monospace; font-size:22px; margin-bottom:24px; text-transform:uppercase;">📡 Cyber Technical Supervision & Ledger Audit Console</h2>
        
        <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:32px;" class="passport-grid">
          
          <div class="card cyber-card" style="padding:24px;">
            <div style="font-weight:700; margin-bottom:12px; font-family:'Courier New', monospace;">Autonomous Ledger Inspection Terminal</div>
            <div class="terminal" style="background:#030712; max-height:260px; overflow-y:auto; padding:12px; border-radius:8px;">
              <div class="terminal-line"><span class="ts">[16:59:56]</span> <span class="info">[INFO]</span> Initializing ledger integrity verification parameters...</div>
              <div class="terminal-line"><span class="ts">[16:59:57]</span> <span class="info">[INFO]</span> Scanning total blockchain blocks: ${catches.length} entries.</div>
              ${catches.map(c => `
                <div class="terminal-line">
                  <span class="ts">[${new Date(c.timestamp).toLocaleTimeString()}]</span>
                  <span class="${c.status === 'Blocked' ? 'err' : c.status === 'Suspicious' ? 'warn' : 'ok'}">${c.status === 'Verified' ? '[OK]' : '[WARNING]'}</span>
                  <span class="msg">Batch ${c.id}: Hash check ${c.hash.substring(0, 16)}...</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card cyber-card" style="padding:24px; display:flex; flex-direction:column; gap:20px;">
            <div>
              <div style="font-weight:700; font-family:'Courier New', monospace; margin-bottom:12px;">Local Database Status</div>
              ${integrity.valid 
                ? `<div class="alert alert-green" style="background:rgba(16,185,129,0.05); border:1px solid #10B981; color:#D1FAE5; padding:12px; border-radius:12px;">
                    ✓ Cryptographic chain integral. All blocks verify correctly.
                   </div>`
                : `<div class="alert cyber-alert-red" style="padding:12px;">
                    🚨 <strong>OCUCHAIN SIGNATURE BREACH!</strong><br>
                    Data mismatch at node block #${integrity.brokenAtIdx}. OcuLock profile freeze activated.
                   </div>`
              }
            </div>

            <button id="btn-malicious-tamper" class="btn btn-danger btn-block btn-sm" style="font-family:'Courier New', monospace; background:#EF4444;">
              Simulate Malicious JSON Modification in LocalStorage
            </button>
          </div>

        </div>
      </div>
    `;

    const btnTamper = container.querySelector('#btn-malicious-tamper') as HTMLButtonElement | null;
    if (btnTamper) {
      btnTamper.onclick = () => {
        const records = getCatches();
        if (records.length > 0) {
          records[records.length - 1].hash = "sha256:TAMPERED_MALICIOUS_HASH_REPLACE";
          localStorage.setItem('oc_catches', JSON.stringify(records));
        } else {
          localStorage.setItem('oc_catches', '[]');
        }
        OcuLock();
        Router.render(Router.currentPath);
      };
    }
  }

  render();
  return container;
}

document.addEventListener('DOMContentLoaded', () => {
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  const header = document.createElement('header');
  header.id = 'site-header';
  header.innerHTML = `
    <div class="header-inner">
      <a href="/passport" data-route="/passport" class="header-logo">
        <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#1E3A8A" stroke-width="3" stroke-dasharray="6 4" />
          <path d="M8 24 C14 16, 22 18, 24 24 C26 30, 34 32, 40 24" stroke="#06B6D4" stroke-width="4" fill="none"/>
        </svg>
        <span style="font-weight: 800; color: #1E3A8A; margin-left: 8px;">OcuCast</span>
        <span class="logo-tag" style="background:#06B6D4; color:white; font-size:9px; font-weight:800; padding:2px 6px; border-radius:9999px; margin-left:6px;">Mangystau</span>
      </a>

      <nav class="header-nav" id="main-nav-links">
        <a href="/passport" data-route="/passport">Digital Passport</a>
        <a href="/fisherman" data-route="/fisherman">Fisherman Terminal</a>
        <a href="/checkpoint" data-route="/checkpoint">Logistics Checkpoint</a>
        <a href="/admin" data-route="/admin">Situation Center</a>
        <a href="/how-it-works" data-route="/how-it-works">How It Works</a>
        <a href="/idx-control" data-route="/idx-control">Technical Supervision</a>
      </nav>

      <div class="header-actions">
        <div class="header-status">
          <span class="status-dot" style="width:6px; height:6px; border-radius:50%; background:#06B6D4; display:inline-block; margin-right:6px;"></span>
          <span style="font-size:12px; font-weight:800; color:#1E3A8A;">OcuChain Active</span>
        </div>
      </div>
    </div>
  `;

  const pageContainer = document.createElement('div');
  pageContainer.id = 'page-container';

  const footer = document.createElement('footer');
  footer.id = 'site-footer';
  footer.innerHTML = `
    <div class="container">
      <div class="footer-inner" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
        <div class="footer-brand">
          <div style="font-weight: 800; color: #1E3A8A;">OcuCast Platform</div>
          <p style="font-size:12px; color:#64748B;">Department of Fish Resources, Mangystau Region.</p>
        </div>
        <div class="footer-cert">
          <div class="cert-badge" style="background:#E2E8F0; padding:6px 12px; border-radius:9999px; font-size:11px; font-weight:800; color:#475569;">
            🛡️ Official Mangystau Registry Seal
          </div>
        </div>
      </div>
    </div>
  `;

  appRoot.innerHTML = '';
  appRoot.appendChild(header);
  appRoot.appendChild(pageContainer);
  appRoot.appendChild(footer);

  Router.register('/passport', PassportPage);
  Router.register('/fisherman', FishermanPage);
  Router.register('/checkpoint', CheckpointPage);
  Router.register('/admin', AdminPage);
  Router.register('/how-it-works', HowItWorksPage);
  Router.register('/idx-control', IdxControlPage);

  Router.init();

  const loader = document.getElementById('loading-screen');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  }
});
