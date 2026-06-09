/**
 * Spin Wheels - Giveaway Picker | Ritual Testnet
 * Core Javascript Application Code
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE VARIABLES ---
  let provider = null;
  let signer = null;
  let userAddress = null;
  let isConnected = false;
  const targetChainId = '1979'; // Ritual Testnet decimal
  const targetChainIdHex = '0x7bb'; // 1979 in hex
  const recipientAddress = '0x6143ae4131f918589f5a0c850da23a33b9d00284';
  
  // Default and saved configurations
  let entries = ['Alice', 'Bob', 'Charlie', 'David', 'Emma', 'Frank', 'Grace', 'Henry'];
  let winners = [];
  let spinFee = 0.01; // RITUAL
  let wheelColors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981']; // Purple, Pink, Blue, Green
  
  // Wheel Physics & Animation state
  let canvas = document.getElementById('wheel-canvas');
  let ctx = canvas.getContext('2d');
  let centerLogoImage = new Image();
  let customLogoLoaded = false;
  let defaultLogoSrc = 'logo.png';
  
  let wheelAngle = 0;
  let angularVelocity = 0;
  let isSpinning = false;
  let lastTickIndex = -1;
  let friction = 0.985; // Deceleration rate
  let spinTime = 0;
  let spinDuration = 0;
  let targetAngle = 0;
  let lastWinnerIndex = -1;

  // Web Audio Context for ticks
  let audioCtx = null;

  // --- INITIALIZATION ---
  init();

  function init() {
    // Initialize Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    // Load local storage data
    loadFromLocalStorage();
    
    // Setup Canvas Resolution & sizing
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Load Default Center Logo
    centerLogoImage.src = defaultLogoSrc;
    centerLogoImage.onload = () => {
      drawWheel();
    };
    centerLogoImage.onerror = () => {
      console.warn('Default logo.png not found or could not load, drawing simple center circle');
      drawWheel();
    };

    // Populate input controls with current state
    document.getElementById('entries-textarea').value = entries.join('\n');
    document.getElementById('fee-input').value = spinFee;
    document.getElementById('fee-amount-display').textContent = `${spinFee} RITUAL`;
    document.getElementById('spin-btn-fee').textContent = `${spinFee} RITUAL`;
    
    document.getElementById('color-picker-1').value = wheelColors[0] || '#8b5cf6';
    document.getElementById('color-picker-2').value = wheelColors[1] || '#ec4899';
    document.getElementById('color-picker-3').value = wheelColors[2] || '#3b82f6';
    document.getElementById('color-picker-4').value = wheelColors[3] || '#10b981';

    // Populate lists
    renderWinnersList();
    
    // Setup Event Listeners
    setupEventListeners();
    
    // Check if wallet already connected (EIP-1193 pre-authorization)
    checkWalletConnected();
  }

  // --- LOCAL STORAGE HANDLING ---
  function saveToLocalStorage() {
    localStorage.setItem('spin_wheels_entries', JSON.stringify(entries));
    localStorage.setItem('spin_wheels_winners', JSON.stringify(winners));
    localStorage.setItem('spin_wheels_colors', JSON.stringify(wheelColors));
    localStorage.setItem('spin_wheels_fee', spinFee.toString());
  }

  function loadFromLocalStorage() {
    try {
      const storedEntries = localStorage.getItem('spin_wheels_entries');
      if (storedEntries) entries = JSON.parse(storedEntries);

      const storedWinners = localStorage.getItem('spin_wheels_winners');
      if (storedWinners) winners = JSON.parse(storedWinners);

      const storedColors = localStorage.getItem('spin_wheels_colors');
      if (storedColors) wheelColors = JSON.parse(storedColors);

      const storedFee = localStorage.getItem('spin_wheels_fee');
      if (storedFee) spinFee = parseFloat(storedFee);
      
      const storedBg = localStorage.getItem('spin_wheels_bg_image');
      if (storedBg) {
        applyBackgroundImage(storedBg);
        // show preview
        const bgPreviewBox = document.getElementById('bg-preview-box');
        const bgPreviewImg = document.getElementById('bg-preview-img');
        const bgFileName = document.getElementById('bg-file-name');
        bgPreviewImg.src = storedBg;
        bgFileName.textContent = 'Custom Wallpaper';
        bgPreviewBox.style.display = 'flex';
      }

      const storedLogo = localStorage.getItem('spin_wheels_logo_image');
      if (storedLogo) {
        centerLogoImage.src = storedLogo;
        customLogoLoaded = true;
        // show preview
        const logoPreviewBox = document.getElementById('logo-preview-box');
        const logoPreviewImg = document.getElementById('logo-preview-img');
        const logoFileName = document.getElementById('logo-file-name');
        logoPreviewImg.src = storedLogo;
        logoFileName.textContent = 'Custom Logo';
        logoPreviewBox.style.display = 'flex';
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }

  // --- AUDIO CLICK FX (Web Audio API) ---
  function playTickSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'triangle';
      // High frequency click
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.03);
      
      gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.03);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
      console.warn('Audio Context error or user gesture needed:', e);
    }
  }

  // --- CANVAS & WHEEL DRAWING ---
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    drawWheel();
  }

  function drawWheel() {
    if (!canvas || !ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const radius = Math.min(width, height) / 2 - 10;
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.clearRect(0, 0, width, height);
    
    const numSlices = entries.length;
    if (numSlices === 0) {
      // Draw empty wheel message
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#1e1b2e';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '600 16px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Please add entries to populate the wheel', centerX, centerY);
      ctx.restore();
      return;
    }
    
    const sliceAngle = (2 * Math.PI) / numSlices;
    
    // 1. Draw Slices
    for (let i = 0; i < numSlices; i++) {
      const startAngle = i * sliceAngle + wheelAngle;
      const endAngle = startAngle + sliceAngle;
      
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      
      // Color selector logic
      ctx.fillStyle = wheelColors[i % wheelColors.length] || '#8b5cf6';
      ctx.fill();
      
      // Inner border lines
      ctx.strokeStyle = 'rgba(11, 8, 19, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    
    // 2. Draw Text Labels
    for (let i = 0; i < numSlices; i++) {
      const labelAngle = i * sliceAngle + sliceAngle / 2 + wheelAngle;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(labelAngle);
      
      // Text styling
      ctx.fillStyle = '#ffffff';
      // Scale font size according to number of items so it fits
      let fontSize = 16;
      if (numSlices > 15) fontSize = 12;
      if (numSlices > 30) fontSize = 9;
      
      ctx.font = `700 ${fontSize}px Inter`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      // Truncate name if it's too long
      let name = entries[i];
      const maxTextWidth = radius * 0.65;
      let textWidth = ctx.measureText(name).width;
      
      if (textWidth > maxTextWidth) {
        while (textWidth > maxTextWidth && name.length > 3) {
          name = name.slice(0, -1);
          textWidth = ctx.measureText(name + '...').width;
        }
        name = name + '...';
      }
      
      // Draw text with a subtle shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      // Pad text slightly from the edge
      ctx.fillText(name, radius - 20, 0);
      ctx.restore();
    }
    
    // 3. Draw Outer Gold/White Ring Border
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Glowing dots on outer border (adds premium feel)
    const dotCount = Math.min(24, numSlices * 2);
    for (let d = 0; d < dotCount; d++) {
      const dotAngle = (d * 2 * Math.PI) / dotCount + wheelAngle * 0.2; // rotates slowly
      const dx = centerX + radius * Math.cos(dotAngle);
      const dy = centerY + radius * Math.sin(dotAngle);
      
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.restore();
    
    // 4. Draw Center Circle background
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 52, 0, 2 * Math.PI);
    ctx.fillStyle = '#0c0a15';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
    ctx.lineWidth = 5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 5. Draw Center Logo image
    if (centerLogoImage.complete && centerLogoImage.naturalWidth !== 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 42, 0, 2 * Math.PI);
      ctx.clip(); // clip to circle shape
      
      // Draw image center-aligned
      ctx.drawImage(centerLogoImage, centerX - 42, centerY - 42, 84, 84);
      ctx.restore();
    } else {
      // Fallback center symbol if logo didn't load
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 24px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', centerX, centerY);
      ctx.restore();
    }
  }

  // --- SPIN PHYSICS & ANIMATION ---
  function spin(winnerIndex, txHash) {
    if (isSpinning) return;
    
    isSpinning = true;
    document.getElementById('spin-btn').disabled = true;
    
    const numSlices = entries.length;
    const sliceAngle = (2 * Math.PI) / numSlices;
    
    // Target calculation:
    // To land exactly on winnerIndex at the top of the wheel (angle: 3 * Math.PI / 2, which is 270 deg)
    // The top pointer points to relative angle: (3 * Math.PI / 2 - wheelAngle) % (2 * Math.PI)
    // We want: relative pointer angle to end up inside the slice interval [winnerIndex * sliceAngle, (winnerIndex+1) * sliceAngle]
    // Let's target the exact center of that slice: winnerIndex * sliceAngle + sliceAngle / 2
    // So we need: 3 * Math.PI / 2 - targetAngle = winnerIndex * sliceAngle + sliceAngle / 2
    // Which means: targetAngle = 1.5 * Math.PI - (winnerIndex * sliceAngle + sliceAngle / 2)
    // Adjust targetAngle to be positive and add many full rotations (e.g. 8 rotations) for a nice long spin effect.
    
    const baseTarget = (1.5 * Math.PI - (winnerIndex * sliceAngle + sliceAngle / 2));
    const fullRotations = 12 * 2 * Math.PI; // 12 complete turns for longer, suspenseful spin
    targetAngle = fullRotations + baseTarget;
    
    // Ensure rotation goes forward (clockwise)
    const currentAngleNormalized = wheelAngle % (2 * Math.PI);
    const angleDifference = targetAngle - currentAngleNormalized;
    
    // We anim with absolute easing
    const startAngle = wheelAngle;
    const targetEndAngle = startAngle + angleDifference;
    
    spinDuration = 10000; // 10 seconds spin for high suspense
    spinTime = 0;
    lastTickIndex = -1;
    
    const startTime = performance.now();
    
    function animateSpin(currentTime) {
      if (!spinTime) spinTime = currentTime;
      const elapsed = currentTime - startTime;
      
      if (elapsed >= spinDuration) {
        // Spin finished
        wheelAngle = targetEndAngle;
        drawWheel();
        isSpinning = false;
        document.getElementById('spin-btn').disabled = false;
        
        // Show Winner modal
        showWinner(winnerIndex, txHash);
      } else {
        // Easing function: easeOutQuart
        const t = elapsed / spinDuration;
        const easeT = 1 - Math.pow(1 - t, 4); // easeOutQuart
        
        wheelAngle = startAngle + (targetEndAngle - startAngle) * easeT;
        
        // Tick Sound trigger logic:
        // Pointer is at 1.5 * Math.PI
        const relativePointerAngle = (1.5 * Math.PI - wheelAngle) % (2 * Math.PI);
        const currentTickIndex = Math.floor(((relativePointerAngle + 2 * Math.PI) % (2 * Math.PI)) / sliceAngle);
        
        if (currentTickIndex !== lastTickIndex) {
          playTickSound();
          lastTickIndex = currentTickIndex;
          
          // Animate pointer wiggle
          const pointer = document.getElementById('wheel-pointer');
          pointer.classList.add('active');
          setTimeout(() => {
            pointer.classList.remove('active');
          }, 60);
        }
        
        drawWheel();
        requestAnimationFrame(animateSpin);
      }
    }
    
    requestAnimationFrame(animateSpin);
  }

  // --- CELEBRATION SOUNDS (Fanfare & Applause) ---
  function playCelebrationSound() {
    // 1. Try to play royalty free applause sound from public SoundJay CDN
    const externalApplause = new Audio('https://www.soundjay.com/human/sounds/applause-01.mp3');
    externalApplause.volume = 0.5;
    externalApplause.play().catch(err => {
      console.log('External audio failed or blocked, relying on synthesized fallback');
    });

    // 2. Play Synthesized Brass Fanfare via Web Audio API
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const now = audioCtx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4 (Do), E4 (Mi), G4 (Sol), C5 (Do)
      notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.15);
        
        // Volume envelope for each note
        gainNode.gain.setValueAtTime(0, now + index * 0.15);
        gainNode.gain.linearRampToValueAtTime(0.2, now + index * 0.15 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + index * 0.15 + 0.45);
        
        osc.start(now + index * 0.15);
        osc.stop(now + index * 0.15 + 0.5);
      });

      // 3. Synthesize clapping noises (noise bursts) to overlay (works offline)
      const bufferSize = audioCtx.sampleRate * 2.5; // 2.5 seconds noise
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; // white noise
      }
      
      // Schedule multiple claps
      for (let c = 0; c < 15; c++) {
        const noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000 + Math.random() * 800; // clap frequency range
        filter.Q.value = 2.0;
        
        const gainNode = audioCtx.createGain();
        
        noiseNode.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        const startDelay = 0.5 + Math.random() * 1.5; // spread claps
        
        gainNode.gain.setValueAtTime(0, now + startDelay);
        gainNode.gain.linearRampToValueAtTime(0.08, now + startDelay + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + startDelay + 0.15 + Math.random() * 0.1);
        
        noiseNode.start(now + startDelay);
        noiseNode.stop(now + startDelay + 0.3);
      }
    } catch (e) {
      console.warn('Fanfare synthesis failed:', e);
    }
  }

  // --- WINNER MANAGEMENT ---
  function showWinner(winnerIndex, txHash) {
    const winnerName = entries[winnerIndex];
    lastWinnerIndex = winnerIndex;
    
    // Play the celebration sounds (Applause + synthesized Fanfare)
    playCelebrationSound();

    // Create confetti explosion!
    if (window.confetti) {
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#8b5cf6', '#ec4899', '#3b82f6']
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#8b5cf6', '#ec4899', '#3b82f6']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }
    
    // Add to winners array
    const timestamp = new Date().toLocaleString();
    const newWinner = {
      name: winnerName,
      timestamp: timestamp,
      txHash: txHash
    };
    
    winners.unshift(newWinner); // add to top
    saveToLocalStorage();
    renderWinnersList();
    
    // Update share link
    const tweetText = `I just spun the wheel on Spin Wheels - Giveaway Picker on Ritual Testnet! ⚡\n\n🎉 Winner: ${winnerName}\n\nSpin Wheels By @NineMay_ID\n\nPlay here: https://spin-wheels-ritual.vercel.app\n\n@ritualnet #RitualTestnet #Giveaway`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    document.getElementById('winner-share-twitter-btn').href = shareUrl;

    // Show Winner modal
    document.getElementById('winner-reveal-name').textContent = winnerName;
    document.getElementById('winner-modal').classList.add('active');
  }

  function renderWinnersList() {
    const container = document.getElementById('winners-list-container');
    if (!container) return;
    
    if (winners.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="trophy" style="width: 40px; height: 40px; color: var(--text-muted);"></i>
          <span>No winners yet. Spin the wheel to pick!</span>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    
    let html = '';
    winners.forEach((winner, idx) => {
      let txLinkHtml = '';
      if (winner.txHash) {
        const truncatedTx = `${winner.txHash.slice(0, 6)}...${winner.txHash.slice(-4)}`;
        txLinkHtml = `
          <a href="https://explorer.ritualfoundation.org/tx/${winner.txHash}" target="_blank" class="winner-tx-link">
            <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
            ${truncatedTx}
          </a>
        `;
      }
      
      html += `
        <div class="winner-item">
          <div class="winner-info">
            <i data-lucide="award" class="winner-trophy"></i>
            <div>
              <div class="winner-name">${winner.name}</div>
              <div class="winner-timestamp">${winner.timestamp}</div>
            </div>
          </div>
          <div class="winner-actions">
            ${txLinkHtml}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // --- WEB3 INTEGRATION ---
  async function checkWalletConnected() {
    if (window.ethereum) {
      try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_accounts', []);
        
        if (accounts.length > 0) {
          // Connected!
          setupConnectedWallet(accounts[0]);
        }
      } catch (err) {
        console.error('Error checking wallet connection:', err);
      }
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert('MetaMask or another Web3 Wallet not found. Please install a wallet to use this dApp.');
      return;
    }
    
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request accounts
      const accounts = await provider.send('eth_requestAccounts', []);
      setupConnectedWallet(accounts[0]);
      
      // Verify correct network
      await checkNetworkAndPromptSwitch();
    } catch (err) {
      console.error('User rejected wallet connection or error occurred:', err);
      alert('Wallet connection rejected.');
    }
  }

  async function setupConnectedWallet(address) {
    userAddress = address;
    signer = await provider.getSigner();
    isConnected = true;
    
    // Update UI
    const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    document.getElementById('connect-btn-text').textContent = truncatedAddress;
    document.getElementById('connect-wallet-btn').classList.add('connected');
    document.getElementById('wallet-address-display').textContent = truncatedAddress;
    document.getElementById('wallet-info').style.display = 'flex';
    
    // Fetch and show balance
    updateWalletBalance();
    
    // Setup listeners
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        disconnectWalletUI();
      } else {
        setupConnectedWallet(accounts[0]);
      }
    });

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }

  function disconnectWalletUI() {
    userAddress = null;
    signer = null;
    isConnected = false;
    
    document.getElementById('connect-btn-text').textContent = 'Connect Wallet';
    document.getElementById('connect-wallet-btn').classList.remove('connected');
    document.getElementById('wallet-info').style.display = 'none';
  }

  async function updateWalletBalance() {
    if (!provider || !userAddress) return;
    try {
      const balance = await provider.getBalance(userAddress);
      const formattedBalance = ethers.formatEther(balance);
      const displayBalance = parseFloat(formattedBalance).toFixed(4);
      document.getElementById('wallet-balance-display').textContent = `${displayBalance} RITUAL`;
    } catch (e) {
      console.error('Error fetching balance:', e);
    }
  }

  async function checkNetworkAndPromptSwitch() {
    if (!provider) return false;
    
    const network = await provider.getNetwork();
    const chainId = network.chainId;
    
    if (chainId.toString() !== targetChainId) {
      try {
        // Prompt network switch
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainIdHex }],
        });
        return true;
      } catch (switchError) {
        // If network doesn't exist, try to add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: targetChainIdHex,
                chainName: 'Ritual Testnet',
                rpcUrls: ['https://rpc.ritualfoundation.org'],
                nativeCurrency: {
                  name: 'RITUAL',
                  symbol: 'RITUAL',
                  decimals: 18
                },
                blockExplorerUrls: ['https://explorer.ritualfoundation.org']
              }],
            });
            return true;
          } catch (addError) {
            console.error('Error adding network:', addError);
            alert('Failed to add Ritual Testnet to your wallet.');
            return false;
          }
        }
        console.error('Error switching network:', switchError);
        alert('Please manually switch your wallet to the Ritual Testnet network.');
        return false;
      }
    }
    return true;
  }

  // --- SPIN PURCHASE TRANSACTION ---
  async function handleSpinClick() {
    // 1. Verify entries
    if (entries.length < 2) {
      alert('Please add at least 2 entries before spinning.');
      return;
    }
    
    if (isSpinning) return;
    
    // 2. Require wallet connection
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    // 3. Ensure correct network
    const isCorrectNetwork = await checkNetworkAndPromptSwitch();
    if (!isCorrectNetwork) return;
    
    // 4. Check balance before proceeding
    try {
      const balance = await provider.getBalance(userAddress);
      const feeInWei = ethers.parseEther(spinFee.toString());
      
      if (balance < feeInWei) {
        alert(`Insufficient RITUAL token balance. This spin costs ${spinFee} RITUAL. Get test tokens from: https://faucet.ritualfoundation.org`);
        window.open('https://faucet.ritualfoundation.org', '_blank');
        return;
      }
    } catch (err) {
      console.error('Error checking balance:', err);
      alert('Could not check wallet balance. Please try again.');
      return;
    }
    
    // 5. Open transaction processing modal
    const txModal = document.getElementById('tx-modal');
    const stepWallet = document.getElementById('step-wallet');
    const stepChain = document.getElementById('step-chain');
    const stepSpin = document.getElementById('step-spin');
    const txHashBox = document.getElementById('tx-hash-box');
    
    // Reset steps
    stepWallet.className = 'step-item active';
    stepChain.className = 'step-item';
    stepSpin.className = 'step-item';
    txHashBox.style.display = 'none';
    txModal.classList.add('active');
    
    try {
      // 6. Send transaction of fee to target address
      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: ethers.parseEther(spinFee.toString())
      });
      
      // Update UI step 1 complete, step 2 active
      stepWallet.className = 'step-item completed';
      stepChain.className = 'step-item active';
      
      // Show Tx Hash and link
      const txLink = document.getElementById('tx-link');
      txLink.href = `https://explorer.ritualfoundation.org/tx/${tx.hash}`;
      txLink.textContent = tx.hash;
      txHashBox.style.display = 'block';
      
      // 7. Wait for transaction block confirmation
      const receipt = await tx.wait(1); // wait for 1 block
      
      // Update UI step 2 complete, step 3 active
      stepChain.className = 'step-item completed';
      stepSpin.className = 'step-item active';
      
      // Wait a tiny bit then close modal and start spin!
      setTimeout(() => {
        txModal.classList.remove('active');
        
        // Determine the winner index randomly on-chain/locally:
        // To keep it fair and transparent, we can hash the txHash or block number
        // index = BigNumber(hash) % numSlices
        const txHashNumber = BigInt(tx.hash);
        const winnerIndex = Number(txHashNumber % BigInt(entries.length));
        
        // Spin the wheel
        spin(winnerIndex, tx.hash);
        
        // Refresh balance after spin
        updateWalletBalance();
      }, 1000);
      
    } catch (txErr) {
      console.error('Transaction failed:', txErr);
      txModal.classList.remove('active');
      alert('Transaction was rejected or failed. Check console for details.');
    }
  }

  // --- EVENT LISTENERS & UI ACTIONS ---
  function setupEventListeners() {
    // Wallet Connect Click
    document.getElementById('connect-wallet-btn').addEventListener('click', () => {
      if (isConnected) {
        disconnectWalletUI();
      } else {
        connectWallet();
      }
    });

    // Spin Button Click
    document.getElementById('spin-btn').addEventListener('click', handleSpinClick);

    // Update Wheel Entries Button
    document.getElementById('update-wheel-btn').addEventListener('click', () => {
      const text = document.getElementById('entries-textarea').value.trim();
      const items = text.split('\n')
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
      
      if (items.length < 2) {
        alert('Please enter at least 2 entries (one per line).');
        return;
      }
      
      entries = items;
      saveToLocalStorage();
      drawWheel();
      
      // Visual feedback: briefly glow button
      const btn = document.getElementById('update-wheel-btn');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<i data-lucide="check" style="color:#10b981;"></i> Updated!`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        if (window.lucide) window.lucide.createIcons();
      }, 1500);
    });

    // Reset Wheel (quick control)
    document.getElementById('quick-reset-btn').addEventListener('click', () => {
      if (isSpinning) return;
      wheelAngle = 0;
      drawWheel();
    });

    // Shuffle Items (quick control)
    document.getElementById('quick-shuffle-btn').addEventListener('click', () => {
      if (isSpinning) return;
      
      // Durstenfeld shuffle algorithm
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }
      
      document.getElementById('entries-textarea').value = entries.join('\n');
      saveToLocalStorage();
      drawWheel();
      
      // Shuffle animation on canvas (brief rotation)
      wheelAngle = Math.random() * 2 * Math.PI;
      drawWheel();
    });

    // Clear Winners List
    document.getElementById('clear-winners-btn').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the winner history?')) {
        winners = [];
        saveToLocalStorage();
        renderWinnersList();
      }
    });

    function dismissWinnerModal() {
      document.getElementById('winner-modal').classList.remove('active');
      
      const shouldRemove = document.getElementById('remove-winner-checkbox').checked;
      
      if (shouldRemove && lastWinnerIndex !== -1) {
        entries.splice(lastWinnerIndex, 1);
        document.getElementById('entries-textarea').value = entries.join('\n');
        saveToLocalStorage();
        drawWheel();
      }
      
      // Reset state
      lastWinnerIndex = -1;
    }

    // Dismiss Winner Modal
    document.getElementById('winner-dismiss-btn').addEventListener('click', dismissWinnerModal);
    document.getElementById('close-winner-modal-btn').addEventListener('click', dismissWinnerModal);

    // Screenshot/Download Certificate click handler
    document.getElementById('winner-screenshot-btn').addEventListener('click', () => {
      const modalBox = document.querySelector('#winner-modal .modal-card');
      const actionButtons = document.getElementById('winner-modal-buttons');
      const closeBtn = document.getElementById('close-winner-modal-btn');
      const removeCheckboxContainer = document.getElementById('remove-winner-container');
      
      // Temporary styling overrides for high quality capture
      actionButtons.style.display = 'none';
      closeBtn.style.display = 'none';
      if (removeCheckboxContainer) removeCheckboxContainer.style.display = 'none';
      
      // Add custom styles for screenshot aesthetics
      const originalBorder = modalBox.style.borderColor;
      const originalBackground = modalBox.style.background;
      modalBox.style.borderColor = '#8b5cf6';
      modalBox.style.background = '#0c0a15';
      
      // Generate canvas via html2canvas
      window.html2canvas(modalBox, {
        backgroundColor: '#0c0a15',
        scale: 2.5, // Ultra-sharp print quality
        logging: false,
        useCORS: true
      }).then(canvas => {
        // Restore elements
        actionButtons.style.display = 'flex';
        closeBtn.style.display = 'block';
        if (removeCheckboxContainer) removeCheckboxContainer.style.display = 'flex';
        modalBox.style.borderColor = originalBorder;
        modalBox.style.background = originalBackground;
        
        // Export & download
        const winnerName = document.getElementById('winner-reveal-name').textContent;
        const link = document.createElement('a');
        link.download = `ritual-spin-winner-${winnerName.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }).catch(err => {
        console.error('Screenshot generation failed:', err);
        alert('Failed to generate image. Please try again.');
        // Make sure to restore elements in case of error
        actionButtons.style.display = 'flex';
        closeBtn.style.display = 'block';
        if (removeCheckboxContainer) removeCheckboxContainer.style.display = 'flex';
        modalBox.style.borderColor = originalBorder;
        modalBox.style.background = originalBackground;
      });
    });

    // Tabs navigation logic
    const tabLinks = document.querySelectorAll('.tab-link');
    tabLinks.forEach(link => {
      link.addEventListener('click', () => {
        // remove active from all
        tabLinks.forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        
        // add active to clicked
        link.classList.add('active');
        const tabId = link.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });

    // Customize inputs
    document.getElementById('fee-input').addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0) val = 0;
      spinFee = val;
      
      document.getElementById('fee-amount-display').textContent = `${spinFee} RITUAL`;
      document.getElementById('spin-btn-fee').textContent = `${spinFee} RITUAL`;
      saveToLocalStorage();
    });

    // Color Pickers input
    const colorIds = ['color-picker-1', 'color-picker-2', 'color-picker-3', 'color-picker-4'];
    colorIds.forEach((id, idx) => {
      document.getElementById(id).addEventListener('input', (e) => {
        wheelColors[idx] = e.target.value;
        saveToLocalStorage();
        drawWheel();
      });
    });

    // Center Logo Uploader
    document.getElementById('logo-uploader').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        centerLogoImage.src = base64Data;
        customLogoLoaded = true;
        
        // Update uploader preview UI
        document.getElementById('logo-preview-img').src = base64Data;
        document.getElementById('logo-file-name').textContent = file.name;
        document.getElementById('logo-preview-box').style.display = 'flex';
        
        // Save base64 representation to local storage for persistence
        localStorage.setItem('spin_wheels_logo_image', base64Data);
        
        // Redraw wheel
        drawWheel();
      };
      reader.readAsDataURL(file);
    });

    // Remove custom logo
    document.getElementById('remove-logo-btn').addEventListener('click', () => {
      centerLogoImage.src = defaultLogoSrc;
      customLogoLoaded = false;
      document.getElementById('logo-uploader').value = '';
      document.getElementById('logo-preview-box').style.display = 'none';
      localStorage.removeItem('spin_wheels_logo_image');
      drawWheel();
    });

    // Background Image Uploader
    document.getElementById('bg-uploader').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        applyBackgroundImage(base64Data);
        
        // Update UI
        document.getElementById('bg-preview-img').src = base64Data;
        document.getElementById('bg-file-name').textContent = file.name;
        document.getElementById('bg-preview-box').style.display = 'flex';
        
        localStorage.setItem('spin_wheels_bg_image', base64Data);
      };
      reader.readAsDataURL(file);
    });

    // Remove custom background
    document.getElementById('remove-bg-btn').addEventListener('click', () => {
      const overlay = document.getElementById('body-bg-overlay');
      overlay.style.backgroundImage = 'none';
      overlay.style.opacity = 0;
      document.getElementById('bg-uploader').value = '';
      document.getElementById('bg-preview-box').style.display = 'none';
      localStorage.removeItem('spin_wheels_bg_image');
    });
  }

  function applyBackgroundImage(base64Data) {
    const overlay = document.getElementById('body-bg-overlay');
    overlay.style.backgroundImage = `url(${base64Data})`;
    overlay.style.opacity = 1;
  }
});
