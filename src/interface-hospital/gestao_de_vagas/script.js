// Configuração da rede Monad
const MONAD_CHAIN_ID = "0x279F"; // 10143 decimal
const MONAD_NETWORK = {
    chainId: "0x278F",
    chainName: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: ["https://testnet-rpc.monad.xyz"],
    blockExplorerUrls: ["https://testnet.monadexplorer.com"]
};

async function garantirRedeMonad() {
    const chainAtual = await window.ethereum.request({ method: "eth_chainId" });
    if (chainAtual === MONAD_CHAIN_ID) return; // já está na rede certa

    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: MONAD_CHAIN_ID }]
        });
    } catch (err) {
        // Código 4902 = rede não cadastrada na MetaMask ainda
        if (err.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [MONAD_NETWORK]
            });
        } else {
            throw err;
        }
    }
}

const CONTRACT_ADDRESS = "0x3e33cF43dFb58a34cB8c95B0fdf20814D4f8a82B";

const CONTRACT_ABI = [
    "function atualizarVagas(uint256 hospitalId, uint256 vagasGeral, uint256 vagasPediatria, uint256 vagasOrtopedia, uint256 vagasCardio) external",
    "function obterHospital(uint256 id) external view returns ((uint256 id, string nome, string localizacao, address wallet, (uint256 geral, uint256 pediatria, uint256 ortopedia, uint256 cardio) vagas, uint256 criadoEm))",
    "function totalHospitais() external view returns (uint256)",
    "event VagasAtualizadas(uint256 indexed id, address indexed atualizador, uint256 geral, uint256 pediatria, uint256 ortopedia, uint256 cardio, uint256 atualizadoEm)"
];

// --- UI helpers ---

function setStatus(mensagem, tipo) {
    const el = document.getElementById("statusEnvio");
    el.innerText = mensagem;
    el.style.color = tipo === "erro" ? "#c62828" : tipo === "ok" ? "#2e7d32" : "#22505a";
}

function setBlockchainStatus(estado, texto) {
    document.getElementById("statusDot").className = `status-dot ${estado}`;
    document.getElementById("statusText").textContent = texto;
}

function alterarQuantidade(botao, mudanca) {
    const pai = botao.parentElement;
    const display = pai.querySelector(".number-display");
    const valorAtual = Number.parseInt(display.innerText, 10);
    let novoValor = valorAtual + mudanca;
    if (novoValor < 0) novoValor = 0;
    display.innerText = String(novoValor);
}

function lerDisplay(id) {
    return Number.parseInt(document.getElementById(id).innerText, 10);
}

function escreverDisplay(id, valor) {
    document.getElementById(id).innerText = String(valor);
}

function parseHospitalId() {
    const raw = document.getElementById("hospitalIdInput").value.trim();
    const id = Number.parseInt(raw, 10);
    if (!raw || Number.isNaN(id) || id <= 0) {
        throw new Error("Informe um ID de hospital válido.");
    }
    return id;
}

// --- Verificação de conexão ---

function aguardarEthereum(tentativas = 30) {
    return new Promise((resolve) => {
        if (typeof window.ethereum !== "undefined") return resolve(true);
        let t = 0;
        const iv = setInterval(() => {
            t++;
            if (typeof window.ethereum !== "undefined") { clearInterval(iv); resolve(true); }
            else if (t >= tentativas) { clearInterval(iv); resolve(false); }
        }, 100);
    });
}

async function verificarConexao() {
    try {
        const encontrou = await aguardarEthereum();
        if (!encontrou) throw new Error("MetaMask não encontrada");
        await garantirRedeMonad();
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const total = await contract.totalHospitais();
        setBlockchainStatus("connected", `Blockchain conectada · ${Number(total)} hospital(is) registrado(s)`);
        return true;
    } catch (err) {
        if (!window.ethereum) {
            setBlockchainStatus("error", "MetaMask não encontrada. Instale a extensão para continuar.");
            document.getElementById("btnEnviar").disabled = true;
            document.getElementById("btnCarregar").disabled = true;
        } else {
            setBlockchainStatus("error", "MetaMask encontrada, mas erro na rede. Verifique a rede correta.");
        }
        return false;
    }
}

// --- Carregar dados do hospital da blockchain ---

async function carregarVagasNaTela() {
    if (typeof window.ethereum === "undefined") {
        throw new Error("MetaMask não encontrada.");
    }

    const hospitalId = parseHospitalId();
    await garantirRedeMonad();
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    setStatus("Buscando dados do hospital na blockchain...", "info");
    const hospital = await contract.obterHospital(hospitalId);

    escreverDisplay("displayGeral", Number(hospital.vagas.geral));
    escreverDisplay("displayPediatria", Number(hospital.vagas.pediatria));
    escreverDisplay("displayOrtopedia", Number(hospital.vagas.ortopedia));
    escreverDisplay("displayCardio", Number(hospital.vagas.cardio));

    document.getElementById("hospitalNomeInfo").textContent =
        `📋 ${hospital.nome} · ${hospital.localizacao}`;

    setStatus(`✅ Dados de ${hospital.nome} carregados com sucesso.`, "ok");
}

// --- Atualizar vagas na blockchain ---

async function atualizarVagasNaBlockchain() {
    if (typeof window.ethereum === "undefined") {
        throw new Error("MetaMask não encontrada.");
    }

    const hospitalId = parseHospitalId();

    const vagasGeral = lerDisplay("displayGeral");
    const vagasPediatria = lerDisplay("displayPediatria");
    const vagasOrtopedia = lerDisplay("displayOrtopedia");
    const vagasCardio = lerDisplay("displayCardio");

    setStatus("Solicitando conexão com a MetaMask...", "info");

    await garantirRedeMonad();
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    setStatus("Enviando transação para atualizar vagas...", "info");

    const tx = await contract.atualizarVagas(
        hospitalId,
        vagasGeral,
        vagasPediatria,
        vagasOrtopedia,
        vagasCardio
    );

    setStatus(`Transação enviada: ${tx.hash} · Aguardando confirmação...`, "info");
    const receipt = await tx.wait();
    setStatus(`✅ Vagas atualizadas no bloco ${receipt.blockNumber}!`, "ok");
}

// --- Event listeners ---

document.getElementById("btnCarregar").addEventListener("click", async () => {
    document.getElementById("btnCarregar").disabled = true;
    try {
        await carregarVagasNaTela();
    } catch (error) {
        const msg = error && error.message ? error.message : "Falha ao carregar dados do hospital.";
        setStatus(`❌ ${msg}`, "erro");
    } finally {
        document.getElementById("btnCarregar").disabled = false;
    }
});

document.getElementById("btnEnviar").addEventListener("click", async () => {
    document.getElementById("btnEnviar").disabled = true;
    try {
        await atualizarVagasNaBlockchain();
    } catch (error) {
        const msg = error && error.message ? error.message : "Falha ao atualizar vagas na blockchain.";
        setStatus(`❌ ${msg}`, "erro");
    } finally {
        document.getElementById("btnEnviar").disabled = false;
    }
});

// --- Inicialização: pré-preenche ID via URL param ou localStorage ---

async function inicializar() {
    await verificarConexao();

    // Tenta pegar ID via query string (?hospitalId=3)
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("hospitalId");

    // Fallback: ID salvo pelo cadastro
    const idStorage = localStorage.getItem("hospitalIdCadastrado");

    const idParaUsar = idParam || idStorage;

    if (idParaUsar) {
        document.getElementById("hospitalIdInput").value = idParaUsar;
        // Auto-carrega os dados se tiver MetaMask disponível
        try {
            await carregarVagasNaTela();
        } catch (_) {
            // Silencia — o usuário pode carregar manualmente
        }
    }
}

inicializar();
