/* ══════════════════════════════════════
   PARTICLE BACKGROUND
══════════════════════════════════════ */
(function () {
  const canvas = document.getElementById("particles");
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function createParticle() {
    return {
      x: rand(0, W),
      y: rand(0, H),
      r: rand(0.5, 2.2),
      vx: rand(-0.15, 0.15),
      vy: rand(-0.25, -0.05),
      alpha: rand(0.2, 0.7),
    };
  }

  for (let i = 0; i < 120; i++) particles.push(createParticle());

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167, 139, 250, ${p.alpha})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.0008;

      if (p.y < -10 || p.alpha <= 0) {
        Object.assign(p, createParticle(), { y: H + 10, alpha: rand(0.2, 0.7) });
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();


/* ══════════════════════════════════════
   SCROLL REVEAL (IntersectionObserver)
══════════════════════════════════════ */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));


/* ══════════════════════════════════════
   ANIMATED COUNTER (stats strip)
══════════════════════════════════════ */
function animateCounter(el, target, duration = 1600) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Trigger counter when the stats strip becomes visible
const stripObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.querySelectorAll("[data-count]").forEach((el) => {
          animateCounter(el, parseInt(el.dataset.count, 10));
        });
        stripObserver.unobserve(e.target);
      }
    });
  },
  { threshold: 0.3 }
);
document.querySelectorAll(".stats-strip").forEach((el) => stripObserver.observe(el));


/* ══════════════════════════════════════
   WALLET CONNECTION & TOKEN TRANSFER
   ══════════════════════════════════════ */
const CONTRACT_ADDRESS = "0xdc8b1AC60aA8b3D53Bdda6C9865a1011e5237D76";
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // Chain ID 11155111
let currentWalletAddress = null;
let currentTokenBalance = "0";
let rawTokenBalance = 0n; // Store raw balance as BigInt for exact comparison

// Check if connected network is Sepolia, if not, prompt user to switch
async function checkAndSwitchNetwork() {
  if (typeof window.ethereum === "undefined") return false;
  
  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
        return true;
      } catch (switchError) {
        // Error code 4902 indicates that the network has not been added to MetaMask.
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: SEPOLIA_CHAIN_ID,
                  chainName: "Sepolia Test Network",
                  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                  rpcUrls: ["https://sepolia.infura.io/v3/"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
            return true;
          } catch (addError) {
            console.error("Failed to add Sepolia network:", addError);
            alert("Please switch your MetaMask network to Ethereum Sepolia to interact with SabaToken.");
            return false;
          }
        } else {
          console.error("Failed to switch to Sepolia network:", switchError);
          alert("Please switch your MetaMask network to Ethereum Sepolia to interact with SabaToken.");
          return false;
        }
      }
    }
    return true;
  } catch (err) {
    console.error("Error checking network status:", err);
    return false;
  }
}

// Convert a BigInt raw balance into a user-friendly decimal string without float rounding issues
function formatTokenBalance(balanceBigInt, decimals = 18) {
  const balanceStr = balanceBigInt.toString();
  if (balanceStr === "0") return "0";
  
  if (balanceStr.length <= decimals) {
    const fractional = balanceStr.padStart(decimals, "0");
    const trimmedFractional = fractional.replace(/0+$/, "");
    return trimmedFractional.length > 0 ? `0.${trimmedFractional}` : "0";
  } else {
    const wholePart = balanceStr.slice(0, balanceStr.length - decimals);
    const fractionalPart = balanceStr.slice(balanceStr.length - decimals);
    const trimmedFractional = fractionalPart.replace(/0+$/, "");
    return trimmedFractional.length > 0 ? `${Number(wholePart).toLocaleString()}.${trimmedFractional}` : Number(wholePart).toLocaleString();
  }
}

// Parse a human decimal string (e.g. 1.25) to standard uint256 BigInt format
function parseAmountToBigInt(amountStr, decimals = 18) {
  const cleanStr = amountStr.replace(/,/g, "").trim();
  let [whole, fractional] = cleanStr.split('.');
  if (!whole) whole = '0';
  if (!fractional) fractional = '';
  
  fractional = fractional.slice(0, decimals);
  fractional = fractional.padEnd(decimals, '0');
  
  return BigInt(whole + fractional);
}

// Fetch balance from contract using eth_call
async function updateBalance() {
  if (!currentWalletAddress) return;
  try {
    const balanceHex = await window.ethereum.request({
      method: "node_modules" in window ? "eth_call" : "eth_call", // fallback check
      params: [
        {
          to: CONTRACT_ADDRESS,
          data: "0x70a08231" + "000000000000000000000000" + currentWalletAddress.slice(2).toLowerCase(),
        },
        "latest",
      ],
    });

    rawTokenBalance = BigInt(balanceHex || "0x0");
    currentTokenBalance = formatTokenBalance(rawTokenBalance);
    document.getElementById("tokenBalance").textContent = currentTokenBalance;
  } catch (err) {
    console.error("Error fetching SABA balance:", err);
  }
}

async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    alert("MetaMask is not installed. Please install it from https://metamask.io");
    return;
  }
  try {
    const networkSwitched = await checkAndSwitchNetwork();
    if (!networkSwitched) return;

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const userAddress = accounts[0];
    currentWalletAddress = userAddress;

    await updateBalance();

    const short = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
    document.getElementById("walletAddress").textContent = short;
    document.getElementById("connectBtn").textContent = "✅ Connected";
    document.getElementById("connectBtn").disabled = true;
    document.getElementById("walletInfo").classList.remove("hidden");

    // Reveal Transfer form and hide the connect prompt
    const sendFormWrapper = document.getElementById("sendFormWrapper");
    const sendConnectPrompt = document.getElementById("sendConnectPrompt");
    if (sendFormWrapper) sendFormWrapper.classList.remove("hidden");
    if (sendConnectPrompt) sendConnectPrompt.classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("Failed to connect: " + err.message);
  }
}


/* ══════════════════════════════════════
   COPY CONTRACT ADDRESS
══════════════════════════════════════ */
function copyAddress() {
  navigator.clipboard.writeText(CONTRACT_ADDRESS).then(() => {
    const btn = document.querySelector(".copy-btn");
    const original = btn.textContent;
    btn.textContent = "✅ Copied!";
    setTimeout(() => (btn.textContent = original), 2000);
  });
}

// Handle transaction submit to transfer SABA tokens to another address
async function handleTransfer(e) {
  if (e) e.preventDefault();
  
  const recipientInput = document.getElementById("recipientAddress");
  const amountInput = document.getElementById("transferAmount");
  const statusEl = document.getElementById("transferStatus");
  const submitBtn = document.getElementById("sendSubmitBtn");
  
  const recipient = recipientInput.value.trim();
  const amountStr = amountInput.value.trim();
  
  // Clear previous status
  statusEl.className = "status-msg";
  statusEl.innerHTML = "";
  
  // Basic validation: Ethereum Address regex
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(recipient);
  if (!isAddress) {
    statusEl.className = "status-msg error";
    statusEl.textContent = "Error: Invalid recipient address format. It must be a 42-character hex address starting with 0x.";
    return;
  }
  
  // Basic validation: Positive amount
  if (!amountStr || parseFloat(amountStr) <= 0) {
    statusEl.className = "status-msg error";
    statusEl.textContent = "Error: Transfer amount must be greater than zero.";
    return;
  }
  
  const amountBigInt = parseAmountToBigInt(amountStr);
  
  // Validate insufficient balance
  if (amountBigInt > rawTokenBalance) {
    statusEl.className = "status-msg error";
    statusEl.textContent = `Error: Insufficient balance. You are trying to send ${amountStr} SABA but only have ${currentTokenBalance} SABA.`;
    return;
  }
  
  try {
    const networkSwitched = await checkAndSwitchNetwork();
    if (!networkSwitched) return;
    
    // Set loading state
    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ Processing...";
    statusEl.className = "status-msg info";
    statusEl.textContent = "Please confirm the transaction signature request in MetaMask...";
    
    // Encode ERC20 transfer(address,uint256) data payload
    // Method selector: 0xa9059cbb
    const recipientHex = recipient.replace(/^0x/, "").toLowerCase().padStart(64, "0");
    const amountHex = amountBigInt.toString(16).padStart(64, "0");
    const dataHex = "0xa9059cbb" + recipientHex + amountHex;
    
    const transactionParameters = {
      to: CONTRACT_ADDRESS,
      from: currentWalletAddress,
      data: dataHex,
    };
    
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [transactionParameters],
    });
    
    statusEl.className = "status-msg info";
    statusEl.innerHTML = `Transaction submitted! Pending blockchain confirmation...<br><a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank">🔍 View on Sepolia Etherscan ↗</a>`;
    
    // Poll for transaction receipt confirmation (mined status)
    let mined = false;
    let retries = 0;
    
    while (!mined && retries < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries++;
      
      try {
        const receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });
        
        if (receipt) {
          mined = true;
          // Status 0x1 is success
          if (receipt.status === "0x1" || receipt.status === 1) {
            statusEl.className = "status-msg success";
            statusEl.innerHTML = `🎉 Success! Sent ${amountStr} SABA to ${recipient.slice(0, 6)}...${recipient.slice(-4)}.<br><a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank">🔍 View on Sepolia Etherscan ↗</a>`;
            
            // Clear input fields
            recipientInput.value = "";
            amountInput.value = "";
            
            // Refresh balance
            await updateBalance();
          } else {
            statusEl.className = "status-msg error";
            statusEl.innerHTML = `❌ Transaction reverted by the contract.<br><a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank">🔍 View on Sepolia Etherscan ↗</a>`;
          }
        }
      } catch (receiptErr) {
        console.error("Error checking receipt status:", receiptErr);
      }
    }
    
    if (!mined) {
      statusEl.className = "status-msg info";
      statusEl.innerHTML = `Transaction is taking a while to confirm. You can track its status here:<br><a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank">🔍 View on Sepolia Etherscan ↗</a>`;
      recipientInput.value = "";
      amountInput.value = "";
      setTimeout(updateBalance, 5000);
    }
  } catch (err) {
    console.error("Transfer transaction failed:", err);
    statusEl.className = "status-msg error";
    if (err.code === 4001) {
      statusEl.textContent = "Transaction rejected: User denied transaction signature request in MetaMask.";
    } else {
      statusEl.textContent = "Error: " + (err.message || "Failed to submit transaction.");
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "💸 Send Tokens";
  }
}

// Listen to MetaMask account and chain changes automatically to sync interface
if (typeof window.ethereum !== "undefined") {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length === 0) {
      currentWalletAddress = null;
      document.getElementById("walletInfo").classList.add("hidden");
      document.getElementById("connectBtn").textContent = "🔗 Connect Wallet";
      document.getElementById("connectBtn").disabled = false;
      
      const sendFormWrapper = document.getElementById("sendFormWrapper");
      const sendConnectPrompt = document.getElementById("sendConnectPrompt");
      if (sendFormWrapper) sendFormWrapper.classList.add("hidden");
      if (sendConnectPrompt) sendConnectPrompt.classList.remove("hidden");
    } else {
      currentWalletAddress = accounts[0];
      const short = currentWalletAddress.slice(0, 6) + "..." + currentWalletAddress.slice(-4);
      document.getElementById("walletAddress").textContent = short;
      
      const sendFormWrapper = document.getElementById("sendFormWrapper");
      const sendConnectPrompt = document.getElementById("sendConnectPrompt");
      if (sendFormWrapper) sendFormWrapper.classList.remove("hidden");
      if (sendConnectPrompt) sendConnectPrompt.classList.add("hidden");
      
      updateBalance();
    }
  });

  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
}


/* ══════════════════════════════════════
   AI CHATBOT LOGIC
══════════════════════════════════════ */
let chatHistory = [];
let isChatOpen = false;

// DOM Elements
const chatWidget = document.getElementById("chatWidget");
const chatWindow = document.getElementById("chatWindow");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatForm = document.getElementById("chatForm");

// Client-side Gemini API Key placeholder (injected at build time by Vercel)
const GEMINI_API_KEY = "__GEMINI_API_KEY__";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function toggleChat() {
  isChatOpen = !isChatOpen;
  if (isChatOpen) {
    chatWindow.classList.remove("hidden");
    
    // Welcome message if chat is empty
    if (chatMessages.children.length === 0) {
      appendMessage("ai", "Hello! I am your SabaToken AI Assistant. How can I help you today?");
    }
  } else {
    chatWindow.classList.add("hidden");
  }
}

function appendMessage(sender, text) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${sender}`;

  const bubbleElement = document.createElement("div");
  bubbleElement.className = "message-bubble";
  
  if (sender === "ai") {
    bubbleElement.innerHTML = parseMarkdown(text);
  } else {
    bubbleElement.textContent = text;
  }

  const timeElement = document.createElement("div");
  timeElement.className = "message-time";
  const now = new Date();
  timeElement.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  messageElement.appendChild(bubbleElement);
  messageElement.appendChild(timeElement);
  chatMessages.appendChild(messageElement);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "chat-message ai typing-indicator-container";
  indicator.innerHTML = `
    <div class="message-bubble typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return indicator;
}

async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  appendMessage("user", text);
  chatHistory.push({ role: "user", parts: [{ text: text }] });

  await getAIResponse(text);
}

function sendSuggestion(text) {
  appendMessage("user", text);
  chatHistory.push({ role: "user", parts: [{ text: text }] });
  getAIResponse(text);
}

async function getAIResponse(userQuery) {
  const typingIndicator = showTypingIndicator();

  // Create the system prompt
  const SYSTEM_PROMPT = `You are the SabaToken AI Assistant, a friendly and knowledgeable AI chatbot integrated into the official SabaToken (SABA) website. Your goal is to assist visitors, answer questions about SabaToken, and provide smart contract details in a helpful and engaging way.

SabaToken Details:
- Name: SabaToken
- Symbol: SABA
- Contract Address: 0xdc8b1AC60aA8b3D53Bdda6C9865a1011e5237D76
- Etherscan link: https://sepolia.etherscan.io/address/0xdc8b1AC60aA8b3D53Bdda6C9865a1011e5237D76
- Decimals: 18
- Network: Ethereum Sepolia testnet
- Total Supply: 1,000,000 SABA (initially, can be minted more by owner).
- Standard: ERC-20 via OpenZeppelin.
- Built by Saba using Solidity, OpenZeppelin, Hardhat, Alchemy.
- Deployed on Sepolia testnet, hosted on Cloudflare Pages.
- Sending SABA: The website has a "Send SabaToken (SABA)" form right under the Contract Address section. Connected users can enter a recipient address and amount to transfer SABA tokens directly through MetaMask.

User Wallet Status:
${currentWalletAddress ? `- Connected Wallet Address: ${currentWalletAddress}\n- SABA Token Balance: ${currentTokenBalance} SABA` : '- No wallet connected yet. They can click "Connect Wallet" at the top of the page to connect MetaMask.'}

Guidelines:
1. Be concise, engaging, and professional. Keep answers focused on SabaToken and web3 context if possible.
2. Use markdown formatting (bolding, lists, code snippets) where helpful, but keep responses relatively short to fit well in a chat window.
3. If users ask how to get tokens, explain that the owner can mint them, or they can view the contract on Sepolia Etherscan.
4. Keep the context of the conversation.
5. Refer to the user's connected wallet address and balance if they ask about their balance, transactions, or wallet status.
6. The model you are running on is Gemini 2.5 Flash.`;

  try {
    let url = API_URL;
    const isKeyPlaceholder = GEMINI_API_KEY === "__GEMINI_API_KEY__" || GEMINI_API_KEY === "undefined" || !GEMINI_API_KEY;

    if (isKeyPlaceholder) {
      url = "/api/chat";
      // If run locally via file:// protocol or a different port (e.g. port 5500 Live Server), target the proxy port explicitly.
      if (location.protocol === "file:" || (location.hostname === "localhost" && location.port !== "3001" && location.port !== "")) {
        url = "http://localhost:3001/api/chat";
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: chatHistory,
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      })
    });

    typingIndicator.remove();

    if (!response.ok) {
      const errData = await response.json();
      const errMsg = errData.error?.message || "Unknown error";
      appendMessage("ai", `Oops, I encountered an error communicating with Gemini API: "${errMsg}".`);
      return;
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
      const replyText = data.candidates[0].content.parts[0].text;
      appendMessage("ai", replyText);
      chatHistory.push({ role: "model", parts: [{ text: replyText }] });
    } else {
      appendMessage("ai", "I received an unexpected empty response from the AI. Let's try again.");
    }
  } catch (error) {
    typingIndicator.remove();
    console.error("Gemini API Error:", error);
    appendMessage("ai", "Sorry, I couldn't reach the AI service. Please check your network connection and try again.");
  }
}

function parseMarkdown(text) {
  // Escape HTML to prevent XSS, but preserve formatting tags we generate
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold text: **text**
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Code blocks: ```code```
  escaped = escaped.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Inline code: `code`
  escaped = escaped.replace(/`(.*?)`/g, "<code>$1</code>");

  // Links: [text](url)
  escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Bullet points: lines starting with * or - followed by space
  const lines = escaped.split("\n");
  let inList = false;
  let result = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (!inList) {
        result.push("<ul>");
        inList = true;
      }
      result.push(`<li>${trimmed.substring(2)}</li>`);
    } else {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(line);
    }
  }
  if (inList) {
    result.push("</ul>");
  }

  return result.join("<br>");
}
